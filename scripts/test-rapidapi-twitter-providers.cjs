#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "scripts", "rapidapi-twitter-provider-test-report.json");

const PROVIDERS = [
  {
    key: "twitter241",
    owner: "davethebeast",
    api: "twitter241",
    host: "twitter241.p.rapidapi.com",
    overviewUrl: "https://rapidapi.com/davethebeast/api/twitter241",
    focusEndpointId: "apiendpoint_199bb6b4-ae15-4fe7-a82f-4089a6bb7f5b",
  },
  {
    key: "twitter154",
    owner: "datahungrybeast",
    api: "twitter154",
    host: "twitter154.p.rapidapi.com",
    overviewUrl: "https://rapidapi.com/datahungrybeast/api/twitter154",
    focusEndpointId: "apiendpoint_af0bdcd4-8d4d-42ca-9ee1-f828a049abcf",
  },
];

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/g);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

function unescapeRapidText(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003d/g, "=")
    .replace(/\\u003f/g, "?")
    .replace(/\\u0025/g, "%")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function payloadToText(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function classifyResult(status, payload) {
  const text = payloadToText(payload).toLowerCase();

  if (status >= 200 && status < 300) {
    if (text.includes("\"error\"") || text.includes("\"errors\"") || text.includes("exception")) {
      return "soft-error";
    }
    return "success";
  }

  if (status === 401 || status === 403) return "auth-error";
  if (status === 402 || status === 429 || text.includes("credit") || text.includes("quota") || text.includes("limit")) {
    return "plan-or-rate-limit";
  }
  if (status === 400 || text.includes("required") || text.includes("missing") || text.includes("invalid")) {
    return "validation-error";
  }
  if (status >= 500) return "provider-error";
  return "other-error";
}

function buildSeedValues() {
  return {
    username: "MrBeast",
    user: "44196397",
    user_id: "44196397",
    id: "44196397",
    tweet_id: "1924684020107116709",
    tweetId: "1924684020107116709",
    list_id: "1494877848083369984",
    community_id: "1671323833200054285",
    query: "AI",
    q: "AI",
    text: "AI",
    keyword: "AI",
    woeid: "1",
    count: "20",
    limit: "20",
    cursor: "",
    continuation_token: "",
    continuation: "",
    type: "Top",
    sort: "Top",
  };
}

function looksLikeRouteNeedsParam(route, token) {
  return route.includes(token);
}

function buildQueryForRoute(route, method, seed, providerKey) {
  const q = {};

  if (looksLikeRouteNeedsParam(route, "search") || looksLikeRouteNeedsParam(route, "job")) {
    q.query = seed.query;
  }

  if (looksLikeRouteNeedsParam(route, "trends-by-location")) {
    q.woeid = seed.woeid;
  }

  if (looksLikeRouteNeedsParam(route, "list-")) {
    q.list_id = seed.list_id;
  }

  if (looksLikeRouteNeedsParam(route, "community")) {
    q.community_id = seed.community_id;
  }

  if (looksLikeRouteNeedsParam(route, "tweet") || looksLikeRouteNeedsParam(route, "quotes") || looksLikeRouteNeedsParam(route, "comments") || looksLikeRouteNeedsParam(route, "retweets") || looksLikeRouteNeedsParam(route, "likes")) {
    q.tweet_id = seed.tweet_id;
  }

  if (looksLikeRouteNeedsParam(route, "user") || looksLikeRouteNeedsParam(route, "followers") || looksLikeRouteNeedsParam(route, "following") || looksLikeRouteNeedsParam(route, "highlights")) {
    q.user = seed.user;
  }

  // twitter154 prefers user_id instead of user for many user/* routes.
  if (providerKey === "twitter154" && route.startsWith("/user/")) {
    q.user_id = seed.user;
  }

  if (route === "/user") {
    q.username = seed.username;
    delete q.user;
  }

  if (route.includes("users") && route.includes("ids")) {
    q.user_ids = `${seed.user},783214`;
  }

  if (route.includes("tweet-by-ids")) {
    q.tweet_ids = `${seed.tweet_id},1924684020107116709`;
  }

  if (route.includes("details") && route.includes("tweet")) {
    q.tweet_id = seed.tweet_id;
  }

  if (route.includes("replies") && !q.tweet_id) {
    q.tweet_id = seed.tweet_id;
  }

  if (route.includes("by-username") || route.includes("/user")) {
    q.username = q.username || seed.username;
  }

  if (providerKey === "twitter154" && route === "/user/details") {
    delete q.username;
    q.user_id = seed.user;
  }

  if (method === "POST" && Object.keys(q).length === 0) {
    q.tweet_id = seed.tweet_id;
  }

  return q;
}

function stripLargePayload(payload, maxLength = 1600) {
  const raw = payloadToText(payload);
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}...<trimmed ${raw.length - maxLength} chars>`;
}

async function fetchOverview(provider) {
  const response = await fetch(provider.overviewUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${provider.key} overview: ${response.status}`);
  }
  return response.text();
}

function extractEndpointsFromOverview(html) {
  const endpoints = new Map();
  const pattern = /\\"id\\":\\"(apiendpoint_[0-9a-f-]+)\\"[\s\S]{0,700}?\\"route\\":\\"([^\\"]+)\\"[\s\S]{0,220}?\\"method\\":\\"([A-Z]+)\\"[\s\S]{0,700}?\\"name\\":\\"([^\\"]+)\\"/g;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const id = unescapeRapidText(match[1]);
    const route = unescapeRapidText(match[2]);
    const method = unescapeRapidText(match[3]);
    const name = unescapeRapidText(match[4]);

    if (!id.startsWith("apiendpoint_")) continue;
    if (!route.startsWith("/")) continue;

    endpoints.set(id, {
      id,
      route,
      method,
      name,
    });
  }

  return Array.from(endpoints.values());
}

async function callEndpoint({ provider, endpoint, apiKey, seed }) {
  const query = buildQueryForRoute(endpoint.route, endpoint.method, seed, provider.key);
  const url = new URL(`https://${provider.host}${endpoint.route}`);

  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const headers = {
    "x-rapidapi-key": apiKey,
    "x-rapidapi-host": provider.host,
    "Content-Type": "application/json",
  };

  const init = {
    method: endpoint.method,
    headers,
    cache: "no-store",
  };

  if (endpoint.method === "POST" || endpoint.method === "PUT" || endpoint.method === "PATCH") {
    init.body = JSON.stringify(query);
  }

  const started = Date.now();
  const response = await fetch(url, init);
  const text = await response.text();
  const json = parseJsonSafe(text);
  const payload = json || text;

  return {
    provider: provider.key,
    endpointId: endpoint.id,
    name: endpoint.name,
    method: endpoint.method,
    route: endpoint.route,
    url: url.toString(),
    query,
    status: response.status,
    statusText: response.statusText,
    category: classifyResult(response.status, payload),
    durationMs: Date.now() - started,
    payloadPreview: stripLargePayload(payload),
  };
}

function hashResponseForCompare(value) {
  const raw = payloadToText(value);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function runComparisonPairs(provider, endpoints, apiKey, seed) {
  const groups = new Map();

  for (const ep of endpoints) {
    const key = ep.route;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ep);
  }

  const pairs = [];

  for (const [route, group] of groups.entries()) {
    const getEp = group.find((e) => e.method === "GET");
    const postEp = group.find((e) => e.method === "POST");
    if (!getEp || !postEp) continue;

    const getRes = await callEndpoint({ provider, endpoint: getEp, apiKey, seed });
    await sleep(150);
    const postRes = await callEndpoint({ provider, endpoint: postEp, apiKey, seed });

    const equivalent =
      getRes.status === postRes.status
      && getRes.category === postRes.category
      && hashResponseForCompare(getRes.payloadPreview) === hashResponseForCompare(postRes.payloadPreview);

    pairs.push({
      route,
      getEndpointId: getEp.id,
      postEndpointId: postEp.id,
      getStatus: getRes.status,
      postStatus: postRes.status,
      getCategory: getRes.category,
      postCategory: postRes.category,
      equivalent,
      getUrl: getRes.url,
      postUrl: postRes.url,
      getPreview: getRes.payloadPreview,
      postPreview: postRes.payloadPreview,
    });

    await sleep(200);
  }

  return pairs;
}

function summarize(results) {
  const stats = {
    total: results.length,
    success: 0,
    softError: 0,
    validationError: 0,
    planOrRateLimit: 0,
    authError: 0,
    providerError: 0,
    otherError: 0,
  };

  for (const r of results) {
    if (r.category === "success") stats.success += 1;
    else if (r.category === "soft-error") stats.softError += 1;
    else if (r.category === "validation-error") stats.validationError += 1;
    else if (r.category === "plan-or-rate-limit") stats.planOrRateLimit += 1;
    else if (r.category === "auth-error") stats.authError += 1;
    else if (r.category === "provider-error") stats.providerError += 1;
    else stats.otherError += 1;
  }

  return stats;
}

async function main() {
  const env = parseEnvFile(path.join(ROOT, ".env"));
  const apiKey = process.env.RAPID_API_KEY || env.RAPID_API_KEY || process.env.RAPIDAPI_KEY || env.RAPIDAPI_KEY;

  if (!apiKey) {
    throw new Error("RAPID_API_KEY not found in environment or .env");
  }

  const startedAt = new Date().toISOString();
  const seed = buildSeedValues();

  const report = {
    startedAt,
    finishedAt: null,
    providers: {},
    postVsGetChecks: {},
  };

  for (const provider of PROVIDERS) {
    const overviewHtml = await fetchOverview(provider);
    const endpoints = extractEndpointsFromOverview(overviewHtml);

    const unique = endpoints
      .filter((ep) => ep.route && ep.method)
      .sort((a, b) => `${a.route}:${a.method}`.localeCompare(`${b.route}:${b.method}`));

    const providerResults = [];
    for (const endpoint of unique) {
      try {
        const result = await callEndpoint({ provider, endpoint, apiKey, seed });
        providerResults.push(result);
      } catch (error) {
        providerResults.push({
          provider: provider.key,
          endpointId: endpoint.id,
          name: endpoint.name,
          method: endpoint.method,
          route: endpoint.route,
          url: `https://${provider.host}${endpoint.route}`,
          query: buildQueryForRoute(endpoint.route, endpoint.method, seed, provider.key),
          status: 0,
          statusText: "REQUEST_FAILED",
          category: "other-error",
          durationMs: 0,
          payloadPreview: error instanceof Error ? error.message : String(error),
        });
      }

      await sleep(160);
    }

    report.providers[provider.key] = {
      host: provider.host,
      endpointCount: unique.length,
      summary: summarize(providerResults),
      endpoints: providerResults,
    };

    if (provider.key === "twitter154") {
      const pairs = await runComparisonPairs(provider, unique, apiKey, seed);
      const focus = pairs.find((p) => p.getEndpointId === provider.focusEndpointId || p.postEndpointId === provider.focusEndpointId) || null;

      report.postVsGetChecks[provider.key] = {
        comparedRoutePairs: pairs.length,
        equivalentPairs: pairs.filter((p) => p.equivalent).length,
        nonEquivalentPairs: pairs.filter((p) => !p.equivalent).length,
        focusEndpointPair: focus,
        pairs,
      };
    }
  }

  report.finishedAt = new Date().toISOString();

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log("RapidAPI provider test complete.");
  console.log(`Report written to: ${REPORT_PATH}`);

  for (const [provider, data] of Object.entries(report.providers)) {
    console.log(`\nProvider: ${provider}`);
    console.log(`- Endpoints tested: ${data.endpointCount}`);
    console.log(`- Success: ${data.summary.success}`);
    console.log(`- Soft errors: ${data.summary.softError}`);
    console.log(`- Validation errors: ${data.summary.validationError}`);
    console.log(`- Plan/rate limit: ${data.summary.planOrRateLimit}`);
    console.log(`- Auth errors: ${data.summary.authError}`);
    console.log(`- Provider errors: ${data.summary.providerError}`);
    console.log(`- Other errors: ${data.summary.otherError}`);
  }

  if (report.postVsGetChecks.twitter154) {
    const c = report.postVsGetChecks.twitter154;
    console.log("\nTwitter154 GET-vs-POST check:");
    console.log(`- Route pairs compared: ${c.comparedRoutePairs}`);
    console.log(`- Equivalent pairs: ${c.equivalentPairs}`);
    console.log(`- Non-equivalent pairs: ${c.nonEquivalentPairs}`);
    if (c.focusEndpointPair) {
      console.log(`- Focus pair route: ${c.focusEndpointPair.route}`);
      console.log(`- Focus GET status: ${c.focusEndpointPair.getStatus}`);
      console.log(`- Focus POST status: ${c.focusEndpointPair.postStatus}`);
      console.log(`- Focus equivalent: ${c.focusEndpointPair.equivalent}`);
    }
  }
}

main().catch((error) => {
  console.error("RapidAPI provider test failed:");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
