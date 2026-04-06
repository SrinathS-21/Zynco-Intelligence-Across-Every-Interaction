import type { AgentConfig } from "@/lib/types";
import {
  type RapidTwitterEndpointPolicy,
  type RapidTwitterProvider,
  getRapidTwitterEndpointPolicy,
} from "@/lib/twitter/rapidapi-policy";

const RAPID_HOSTS: Record<RapidTwitterProvider, string> = {
  twitter241: "twitter241.p.rapidapi.com",
  twitter154: "twitter154.p.rapidapi.com",
};

const providerRequestQueues = new Map<RapidTwitterProvider, Promise<void>>();
const providerLastRequestAt = new Map<RapidTwitterProvider, number>();

function readRapidMinIntervalMs() {
  const parsed = Number(process.env.TWITTER_RAPID_MIN_INTERVAL_MS || "1100");
  if (!Number.isFinite(parsed)) return 1100;
  return Math.max(300, Math.trunc(parsed));
}

async function runWithProviderThrottle<T>(provider: RapidTwitterProvider, operation: () => Promise<T>): Promise<T> {
  const previous = providerRequestQueues.get(provider) || Promise.resolve();

  let releaseQueue: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  providerRequestQueues.set(provider, previous.then(() => gate));

  await previous;

  try {
    const minIntervalMs = readRapidMinIntervalMs();
    const lastRequestAt = providerLastRequestAt.get(provider) || 0;
    const elapsed = Date.now() - lastRequestAt;

    if (elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }

    const result = await operation();
    providerLastRequestAt.set(provider, Date.now());
    return result;
  } finally {
    releaseQueue();
  }
}

export type TwitterReadProviderMode = "official" | "rapidapi" | "auto";

export type RapidTwitterCallResult = {
  ok: boolean;
  status: number;
  provider: RapidTwitterProvider;
  route: string;
  data: unknown;
  error: string | null;
  category: "success" | "rate-limit" | "auth" | "other";
};

function parseJsonSafe(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function payloadToText(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function classify(status: number, payload: unknown): RapidTwitterCallResult["category"] {
  const text = payloadToText(payload).toLowerCase();
  if (status >= 200 && status < 300) return "success";
  if (status === 429 || text.includes("rate limit") || text.includes("quota") || text.includes("basic")) return "rate-limit";
  if (status === 401 || status === 403) return "auth";
  return "other";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readRapidApiKey() {
  return (
    process.env.RAPID_API_KEY
    || process.env.RAPIDAPI_KEY
    || ""
  ).trim();
}

export function getTwitterReadProviderMode(): TwitterReadProviderMode {
  const raw = (process.env.TWITTER_READ_PROVIDER || "rapidapi").trim().toLowerCase();
  if (raw === "official") return "official";
  if (raw === "auto") return "auto";
  return "rapidapi";
}

export function resolveConnectedTwitterUsername(config: AgentConfig | null | undefined) {
  return String(config?.socialConnections?.twitter?.username || config?.socialConnections?.twitter?.accountId || "")
    .replace(/^@+/, "")
    .trim();
}

function extractRapidError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as Record<string, unknown>;
  const direct = ["message", "error", "detail", "title"]
    .map((key) => candidate[key])
    .find((value) => typeof value === "string" && String(value).trim());

  if (typeof direct === "string") return direct.trim();
  return fallback;
}

function walkObjects(value: unknown, visit: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry) => walkObjects(entry, visit));
    return;
  }

  const node = value as Record<string, unknown>;
  visit(node);
  Object.values(node).forEach((entry) => walkObjects(entry, visit));
}

function firstStringByKeys(payload: unknown, keys: string[]) {
  let found = "";
  walkObjects(payload, (node) => {
    if (found) return;
    for (const key of keys) {
      const value = node[key];
      if (typeof value === "string" && value.trim()) {
        found = value.trim();
        return;
      }
    }
  });
  return found;
}

function firstNumberByKeys(payload: unknown, keys: string[]) {
  let found: number | null = null;
  walkObjects(payload, (node) => {
    if (found !== null) return;
    for (const key of keys) {
      const value = node[key];
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        found = Math.trunc(parsed);
        return;
      }
    }
  });
  return found;
}

export async function callRapidTwitterEndpoint(
  policy: RapidTwitterEndpointPolicy,
  query: Record<string, string> = {},
  body: unknown = undefined,
): Promise<RapidTwitterCallResult> {
  const apiKey = readRapidApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      provider: policy.provider,
      route: policy.route,
      data: null,
      error: "RAPID_API_KEY is not configured",
      category: "other",
    };
  }

  const host = RAPID_HOSTS[policy.provider];
  const url = new URL(`https://${host}${policy.route}`);
  Object.entries(query).forEach(([key, value]) => {
    if (!value) return;
    url.searchParams.set(key, value);
  });

  let response: Response | null = null;
  let payload: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await runWithProviderThrottle(policy.provider, async () => {
      return fetch(url.toString(), {
        method: policy.method,
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": host,
          "Content-Type": "application/json",
        },
        body:
          (policy.method === "POST" && body !== undefined)
            ? JSON.stringify(body)
            : undefined,
        cache: "no-store",
      });
    });

    const text = await response.text();
    payload = parseJsonSafe(text);

    if (response.status !== 429 || attempt === 2) {
      break;
    }

    await sleep(250 * (attempt + 1));
  }

  const status = response ? response.status : 500;
  const category = classify(status, payload);

  return {
    ok: status >= 200 && status < 300,
    status,
    provider: policy.provider,
    route: policy.route,
    data: payload,
    error: status >= 200 && status < 300 ? null : extractRapidError(payload, "RapidAPI request failed"),
    category,
  };
}

export async function callRapidByEndpoint(method: string, endpoint: string, query: Record<string, string>, body?: unknown) {
  const policy = getRapidTwitterEndpointPolicy(method, endpoint);
  if (!policy) {
    return {
      ok: false,
      status: 404,
      error: `Unsupported RapidAPI Twitter endpoint: ${method.toUpperCase()} ${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`,
      policy: null,
      result: null,
    };
  }

  if (policy.status !== "enabled") {
    return {
      ok: false,
      status: 409,
      error: `${policy.method} ${policy.route} is on hold (${policy.status}). ${policy.note}`,
      policy,
      result: null,
    };
  }

  const result = await callRapidTwitterEndpoint(policy, query, body);
  return {
    ok: result.ok,
    status: result.status,
    error: result.error,
    policy,
    result,
  };
}

export function normalizeRapidProfile(payload: unknown, fallbackUsername: string) {
  const username =
    firstStringByKeys(payload, ["screen_name", "username", "userName"]).replace(/^@+/, "")
    || fallbackUsername;

  const displayName =
    firstStringByKeys(payload, ["name", "display_name", "displayName"]) || username;

  const profileImage = firstStringByKeys(payload, [
    "profile_image_url_https",
    "profile_image_url",
    "profileImageUrl",
    "avatar",
  ]);

  const description = firstStringByKeys(payload, ["description", "bio", "legacy_description"]);
  const id = firstStringByKeys(payload, ["rest_id", "id_str", "id", "user_id"]);

  const followers = firstNumberByKeys(payload, ["followers_count", "followers"]);
  const following = firstNumberByKeys(payload, ["friends_count", "following_count", "following"]);
  const tweets = firstNumberByKeys(payload, ["statuses_count", "tweet_count", "tweets_count"]);

  return {
    id: id || null,
    username: username || fallbackUsername,
    name: displayName || fallbackUsername,
    profile_image_url: profileImage || null,
    description: description || null,
    public_metrics: {
      followers_count: followers ?? 0,
      following_count: following ?? 0,
      tweet_count: tweets ?? 0,
    },
    source: "rapidapi",
    raw: payload,
  };
}

export function normalizeRapidTweets(payload: unknown, maxItems: number) {
  const items: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  walkObjects(payload, (node) => {
    const text =
      (typeof node.full_text === "string" && node.full_text.trim())
      || (typeof node.text === "string" && node.text.trim())
      || (typeof node.tweet_text === "string" && node.tweet_text.trim())
      || "";

    if (!text) return;

    const id =
      (typeof node.id_str === "string" && node.id_str.trim())
      || (typeof node.rest_id === "string" && node.rest_id.trim())
      || (typeof node.id === "string" && node.id.trim())
      || "";

    const safeId = id || `rapid-${items.length + 1}`;
    if (seen.has(safeId)) return;
    seen.add(safeId);

    const createdAt =
      (typeof node.created_at === "string" && node.created_at)
      || (typeof node.timestamp === "string" && node.timestamp)
      || "";

    items.push({
      id: safeId,
      text,
      created_at: createdAt,
      public_metrics: {
        reply_count: Number(node.reply_count || 0) || 0,
        retweet_count: Number(node.retweet_count || 0) || 0,
        like_count: Number(node.favorite_count || node.like_count || 0) || 0,
        quote_count: Number(node.quote_count || 0) || 0,
        impression_count: Number(node.view_count || node.impression_count || 0) || 0,
      },
      lang: typeof node.lang === "string" ? node.lang : "",
      raw: node,
    });
  });

  return items.slice(0, Math.max(1, maxItems));
}

export async function fetchRapidProfileByUsername(username: string) {
  const policy = getRapidTwitterEndpointPolicy("GET", "/user");
  if (!policy || policy.status !== "enabled") {
    return {
      ok: false,
      status: 409,
      error: "GET /user is not enabled in policy",
      profile: null as ReturnType<typeof normalizeRapidProfile> | null,
      provider: "twitter241" as RapidTwitterProvider,
      route: "/user",
    };
  }

  const result = await callRapidTwitterEndpoint(policy, { username });
  return {
    ok: result.ok,
    status: result.status,
    error: result.error,
    profile: result.ok ? normalizeRapidProfile(result.data, username) : null,
    provider: result.provider,
    route: result.route,
  };
}

export async function fetchRapidTweetsByUsername(username: string, maxResults: number, mode: "tweets" | "replies" | "media" = "tweets") {
  const route = mode === "media" ? "/user-media" : mode === "replies" ? "/user-replies" : "/user-tweets";
  const policy = getRapidTwitterEndpointPolicy("GET", route);

  if (!policy || policy.status !== "enabled") {
    return {
      ok: false,
      status: 409,
      error: `GET ${route} is not enabled in policy`,
      items: [] as Array<Record<string, unknown>>,
      provider: "twitter241" as RapidTwitterProvider,
      route,
      raw: null as unknown,
    };
  }

  const result = await callRapidTwitterEndpoint(policy, {
    username,
    user: username,
    count: String(maxResults),
    limit: String(maxResults),
  });

  return {
    ok: result.ok,
    status: result.status,
    error: result.error,
    items: result.ok ? normalizeRapidTweets(result.data, maxResults) : [],
    provider: result.provider,
    route: result.route,
    raw: result.data,
  };
}
