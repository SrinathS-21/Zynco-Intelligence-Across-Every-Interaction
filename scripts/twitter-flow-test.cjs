#!/usr/bin/env node

/**
 * End-to-end Twitter flow test runner for local API routes.
 *
 * Usage examples:
 *   node scripts/twitter-flow-test.cjs
 *   node scripts/twitter-flow-test.cjs --email you@example.com --password secret
 *   node scripts/twitter-flow-test.cjs --base-url http://localhost:3000 --target-tweet-id 1234567890
 *
 * Environment variables:
 *   TWITTER_FLOW_BASE_URL=http://localhost:3000
 *   TWITTER_FLOW_EMAIL=you@example.com
 *   TWITTER_FLOW_PASSWORD=secret
 *   TWITTER_FLOW_SESSION_COOKIE=<session token value or full cookie pair>
 *   TWITTER_FLOW_SESSION_COOKIE_NAME=mail_agent_session
 *   TWITTER_FLOW_TARGET_TWEET_ID=<tweet id for like/retweet/reply tests>
 */

const crypto = require("node:crypto");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;

    const key = raw.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }

    out[key] = next;
    i += 1;
  }
  return out;
}

function toBoolean(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "y";
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function parseCookiePair(cookieValue, cookieName) {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const trimmed = cookieValue.trim();
  if (!trimmed) return null;

  if (trimmed.includes("=")) {
    const firstPair = trimmed.split(";")[0].trim();
    const idx = firstPair.indexOf("=");
    if (idx <= 0) return null;
    return {
      name: firstPair.slice(0, idx).trim(),
      value: firstPair.slice(idx + 1).trim(),
    };
  }

  return {
    name: cookieName,
    value: trimmed,
  };
}

class HttpClient {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl || "").replace(/\/$/, "");
    this.cookieJar = new Map();
  }

  setCookie(name, value) {
    if (!name) return;
    this.cookieJar.set(name, value || "");
  }

  cookieHeader() {
    if (this.cookieJar.size === 0) return "";
    return Array.from(this.cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  mergeSetCookie(response) {
    const getSetCookie = response && response.headers && typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : null;

    const rawCookies = Array.isArray(getSetCookie) && getSetCookie.length > 0
      ? getSetCookie
      : (() => {
        const single = response.headers.get("set-cookie");
        return single ? [single] : [];
      })();

    for (const rawCookie of rawCookies) {
      const pair = String(rawCookie || "").split(";")[0].trim();
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookieJar.set(name, value);
    }
  }

  async request(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = Object.assign({}, options.headers || {});
    const query = options.query || null;

    const url = new URL(path.startsWith("http") ? path : `${this.baseUrl}${path}`);
    if (query && typeof query === "object") {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const cookieHeader = this.cookieHeader();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    let body = undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    } else if (typeof options.body === "string") {
      body = options.body;
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      redirect: options.redirect || "follow",
      cache: "no-store",
    });

    this.mergeSetCookie(response);

    const text = await response.text();
    const json = parseJsonSafe(text);

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      text,
      json,
      url: url.toString(),
    };
  }
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function makeStep(name, fn, opts = {}) {
  return { name, fn, required: opts.required !== false };
}

async function runSteps(steps) {
  const results = [];
  for (const step of steps) {
    const startedAt = Date.now();
    try {
      const value = await step.fn();
      const status = value && value.status ? value.status : "passed";
      const detail = value && value.detail ? value.detail : "ok";
      results.push({
        name: step.name,
        required: step.required,
        status,
        detail,
        data: value && value.data ? value.data : null,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: step.name,
        required: step.required,
        status: "failed",
        detail: message,
        data: null,
        durationMs: Date.now() - startedAt,
      });
    }
  }
  return results;
}

function printSection(title) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function printSummary(results) {
  const passCount = results.filter((r) => r.status === "passed").length;
  const failCount = results.filter((r) => r.status === "failed").length;
  const skipCount = results.filter((r) => r.status === "skipped").length;
  const requiredFailed = results.filter((r) => r.status === "failed" && r.required).length;

  printSection("Twitter Flow Test Summary");
  for (const result of results) {
    const marker = result.status === "passed" ? "PASS" : result.status === "skipped" ? "SKIP" : "FAIL";
    console.log(`[${marker}] ${result.name} (${formatDuration(result.durationMs)})`);
    if (result.detail) {
      console.log(`       ${result.detail}`);
    }
  }

  console.log("\nTotals:");
  console.log(`- Passed: ${passCount}`);
  console.log(`- Failed: ${failCount}`);
  console.log(`- Skipped: ${skipCount}`);
  console.log(`- Required failures: ${requiredFailed}`);

  return requiredFailed === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = args["base-url"] || process.env.TWITTER_FLOW_BASE_URL || "http://localhost:3000";
  const email = args.email || process.env.TWITTER_FLOW_EMAIL || process.env.DEMO_USER_EMAIL || "";
  const password = args.password || process.env.TWITTER_FLOW_PASSWORD || process.env.DEMO_USER_PASSWORD || "";

  const sessionCookieName =
    args["session-cookie-name"]
    || process.env.TWITTER_FLOW_SESSION_COOKIE_NAME
    || process.env.SESSION_COOKIE_NAME
    || "mail_agent_session";

  const sessionCookieRaw = args["session-cookie"] || process.env.TWITTER_FLOW_SESSION_COOKIE || "";
  const targetTweetIdArg = args["target-tweet-id"] || process.env.TWITTER_FLOW_TARGET_TWEET_ID || "";
  const skipWrites = toBoolean(args["skip-writes"] || process.env.TWITTER_FLOW_SKIP_WRITES || "false");

  const runId = crypto.randomBytes(4).toString("hex");
  const tweetText = `Zynco Twitter flow test ${new Date().toISOString()} #${runId}`;
  const replyText = `Reply test ${new Date().toISOString()} #${runId}`;

  const client = new HttpClient(baseUrl);

  const suppliedCookie = parseCookiePair(sessionCookieRaw, sessionCookieName);
  if (suppliedCookie) {
    client.setCookie(suppliedCookie.name, suppliedCookie.value);
  }

  printSection("Twitter Flow Test Runner");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Session cookie name: ${sessionCookieName}`);
  console.log(`Using supplied session cookie: ${suppliedCookie ? "yes" : "no"}`);
  console.log(`Skip write operations: ${skipWrites ? "yes" : "no"}`);

  let capabilities = null;
  let mePayload = null;
  let ownTweetsPayload = null;

  let createdTweetId = "";
  let replyTweetId = "";
  let interactionTweetId = targetTweetIdArg;

  const steps = [];

  steps.push(
    makeStep("auth: verify session or login", async () => {
      const probe = await client.request("/api/auth/me", { method: "GET" });
      if (probe.ok) {
        return { status: "passed", detail: "Active session detected" };
      }

      if (!email || !password) {
        throw new Error(
          "No active session and no credentials provided. Set TWITTER_FLOW_EMAIL/TWITTER_FLOW_PASSWORD or TWITTER_FLOW_SESSION_COOKIE.",
        );
      }

      const login = await client.request("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });

      if (!login.ok) {
        const msg = login.json && login.json.error ? login.json.error : `Login failed with status ${login.status}`;
        throw new Error(msg);
      }

      const verify = await client.request("/api/auth/me", { method: "GET" });
      if (!verify.ok) {
        throw new Error(`Login succeeded but /api/auth/me returned ${verify.status}`);
      }

      return { status: "passed", detail: "Logged in successfully" };
    }),
  );

  steps.push(
    makeStep("twitter: capabilities", async () => {
      const res = await client.request("/api/twitter/capabilities", { method: "GET" });
      if (!res.ok) {
        throw new Error(`Capabilities request failed (${res.status})`);
      }

      capabilities = res.json;
      const authState = capabilities && capabilities.auth ? capabilities.auth.state : "unknown";
      return {
        status: "passed",
        detail: `auth.state=${authState}`,
      };
    }),
  );

  steps.push(
    makeStep("twitter: oauth start endpoint responds", async () => {
      const res = await client.request("/api/twitter/auth", {
        method: "GET",
        redirect: "manual",
      });

      const location = res.headers.get("location") || "";
      const redirected = res.status >= 300 && res.status < 400 && Boolean(location);
      if (!redirected) {
        throw new Error(`Expected redirect from /api/twitter/auth, got ${res.status}`);
      }

      return {
        status: "passed",
        detail: `redirected to ${location}`,
      };
    }, { required: false }),
  );

  steps.push(
    makeStep("twitter: me", async () => {
      const res = await client.request("/api/twitter/me", { method: "GET" });
      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Twitter me failed (${res.status})`;
        throw new Error(msg);
      }

      mePayload = res.json;
      const username = mePayload && mePayload.profile ? mePayload.profile.username : null;
      return {
        status: "passed",
        detail: `username=${username || "unknown"}`,
      };
    }),
  );

  steps.push(
    makeStep("twitter: read own tweets", async () => {
      const res = await client.request("/api/twitter/tweets/me", {
        method: "GET",
        query: { max_results: "10" },
      });
      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Tweets/me failed (${res.status})`;
        throw new Error(msg);
      }

      ownTweetsPayload = res.json;
      const items = Array.isArray(ownTweetsPayload && ownTweetsPayload.items) ? ownTweetsPayload.items : [];

      if (!interactionTweetId && items.length > 0 && items[0] && typeof items[0].id === "string") {
        interactionTweetId = items[0].id;
      }

      return {
        status: "passed",
        detail: `retrieved ${items.length} tweet(s)`,
      };
    }),
  );

  steps.push(
    makeStep("twitter: history read", async () => {
      const res = await client.request("/api/twitter/history", { method: "GET" });
      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `History failed (${res.status})`;
        throw new Error(msg);
      }

      const count = Array.isArray(res.json) ? res.json.length : 0;
      return {
        status: "passed",
        detail: `history items=${count}`,
      };
    }),
  );

  steps.push(
    makeStep("twitter: create tweet", async () => {
      if (skipWrites) {
        return { status: "skipped", detail: "Skipped because TWITTER_FLOW_SKIP_WRITES=true" };
      }

      const canCreate = Boolean(capabilities && capabilities.operations && capabilities.operations.createTweet);
      if (!canCreate) {
        return { status: "skipped", detail: "Capabilities report createTweet=false" };
      }

      const res = await client.request("/api/twitter/post", {
        method: "POST",
        json: {
          title: "Twitter Flow Test",
          text: tweetText,
        },
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Create tweet failed (${res.status})`;
        throw new Error(msg);
      }

      const post = res.json && res.json.post ? res.json.post : null;
      createdTweetId = post && typeof post.tweet_id === "string" ? post.tweet_id : "";

      if (!createdTweetId) {
        throw new Error("Tweet creation returned success but tweet_id was missing");
      }

      if (!interactionTweetId) {
        interactionTweetId = createdTweetId;
      }

      return {
        status: "passed",
        detail: `created tweet id=${createdTweetId}`,
      };
    }),
  );

  steps.push(
    makeStep("twitter: read tweet by id", async () => {
      const canRead = Boolean(capabilities && capabilities.operations && capabilities.operations.readTweetById);
      if (!canRead) {
        return { status: "skipped", detail: "Capabilities report readTweetById=false" };
      }

      const tweetId = createdTweetId || interactionTweetId;
      if (!tweetId) {
        return { status: "skipped", detail: "No tweet id available to read" };
      }

      const res = await client.request(`/api/twitter/tweets/${encodeURIComponent(tweetId)}`, {
        method: "GET",
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Read tweet by id failed (${res.status})`;
        throw new Error(msg);
      }

      return {
        status: "passed",
        detail: `read tweet id=${tweetId}`,
      };
    }),
  );

  steps.push(
    makeStep("twitter: reply", async () => {
      if (skipWrites) {
        return { status: "skipped", detail: "Skipped because TWITTER_FLOW_SKIP_WRITES=true" };
      }

      const canReply = Boolean(capabilities && capabilities.operations && capabilities.operations.reply);
      if (!canReply) {
        return { status: "skipped", detail: "Capabilities report reply=false" };
      }

      const tweetId = interactionTweetId || createdTweetId;
      if (!tweetId) {
        return { status: "skipped", detail: "No tweet id available for reply" };
      }

      const res = await client.request(`/api/twitter/tweets/${encodeURIComponent(tweetId)}/reply`, {
        method: "POST",
        json: { text: replyText },
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Reply failed (${res.status})`;
        throw new Error(msg);
      }

      const data = res.json && res.json.data ? res.json.data : null;
      replyTweetId = data && typeof data.id === "string" ? data.id : "";

      return {
        status: "passed",
        detail: `replied to ${tweetId}${replyTweetId ? `, reply id=${replyTweetId}` : ""}`,
      };
    }),
  );

  steps.push(
    makeStep("twitter: like", async () => {
      if (skipWrites) {
        return { status: "skipped", detail: "Skipped because TWITTER_FLOW_SKIP_WRITES=true" };
      }

      const canLike = Boolean(capabilities && capabilities.operations && capabilities.operations.likeUnlike);
      if (!canLike) {
        return { status: "skipped", detail: "Capabilities report likeUnlike=false" };
      }

      const tweetId = targetTweetIdArg || interactionTweetId || createdTweetId;
      if (!tweetId) {
        return { status: "skipped", detail: "No tweet id available for like test" };
      }

      const res = await client.request(`/api/twitter/tweets/${encodeURIComponent(tweetId)}/like`, {
        method: "POST",
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Like failed (${res.status})`;
        throw new Error(msg);
      }

      return {
        status: "passed",
        detail: `liked tweet id=${tweetId}`,
      };
    }, { required: false }),
  );

  steps.push(
    makeStep("twitter: unlike", async () => {
      if (skipWrites) {
        return { status: "skipped", detail: "Skipped because TWITTER_FLOW_SKIP_WRITES=true" };
      }

      const canLike = Boolean(capabilities && capabilities.operations && capabilities.operations.likeUnlike);
      if (!canLike) {
        return { status: "skipped", detail: "Capabilities report likeUnlike=false" };
      }

      const tweetId = targetTweetIdArg || interactionTweetId || createdTweetId;
      if (!tweetId) {
        return { status: "skipped", detail: "No tweet id available for unlike test" };
      }

      const res = await client.request(`/api/twitter/tweets/${encodeURIComponent(tweetId)}/like`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Unlike failed (${res.status})`;
        throw new Error(msg);
      }

      return {
        status: "passed",
        detail: `unliked tweet id=${tweetId}`,
      };
    }, { required: false }),
  );

  steps.push(
    makeStep("twitter: retweet", async () => {
      if (skipWrites) {
        return { status: "skipped", detail: "Skipped because TWITTER_FLOW_SKIP_WRITES=true" };
      }

      const canRetweet = Boolean(capabilities && capabilities.operations && capabilities.operations.retweetUnretweet);
      if (!canRetweet) {
        return { status: "skipped", detail: "Capabilities report retweetUnretweet=false" };
      }

      const tweetId = targetTweetIdArg || interactionTweetId || createdTweetId;
      if (!tweetId) {
        return { status: "skipped", detail: "No tweet id available for retweet test" };
      }

      const res = await client.request(`/api/twitter/tweets/${encodeURIComponent(tweetId)}/retweet`, {
        method: "POST",
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Retweet failed (${res.status})`;
        throw new Error(msg);
      }

      return {
        status: "passed",
        detail: `retweeted tweet id=${tweetId}`,
      };
    }, { required: false }),
  );

  steps.push(
    makeStep("twitter: unretweet", async () => {
      if (skipWrites) {
        return { status: "skipped", detail: "Skipped because TWITTER_FLOW_SKIP_WRITES=true" };
      }

      const canRetweet = Boolean(capabilities && capabilities.operations && capabilities.operations.retweetUnretweet);
      if (!canRetweet) {
        return { status: "skipped", detail: "Capabilities report retweetUnretweet=false" };
      }

      const tweetId = targetTweetIdArg || interactionTweetId || createdTweetId;
      if (!tweetId) {
        return { status: "skipped", detail: "No tweet id available for unretweet test" };
      }

      const res = await client.request(`/api/twitter/tweets/${encodeURIComponent(tweetId)}/retweet`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Unretweet failed (${res.status})`;
        throw new Error(msg);
      }

      return {
        status: "passed",
        detail: `unretweeted tweet id=${tweetId}`,
      };
    }, { required: false }),
  );

  steps.push(
    makeStep("twitter: history read after writes", async () => {
      const res = await client.request("/api/twitter/history", { method: "GET" });
      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `History-after failed (${res.status})`;
        throw new Error(msg);
      }

      const count = Array.isArray(res.json) ? res.json.length : 0;
      return {
        status: "passed",
        detail: `history items=${count}`,
      };
    }),
  );

  steps.push(
    makeStep("cleanup: delete reply tweet", async () => {
      if (!replyTweetId) {
        return { status: "skipped", detail: "No reply tweet to delete" };
      }

      const canDelete = Boolean(capabilities && capabilities.operations && capabilities.operations.deleteTweet);
      if (!canDelete) {
        return { status: "skipped", detail: "Capabilities report deleteTweet=false" };
      }

      const res = await client.request(`/api/twitter/tweets/${encodeURIComponent(replyTweetId)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Reply cleanup delete failed (${res.status})`;
        throw new Error(msg);
      }

      return {
        status: "passed",
        detail: `deleted reply id=${replyTweetId}`,
      };
    }, { required: false }),
  );

  steps.push(
    makeStep("cleanup: delete created tweet", async () => {
      if (!createdTweetId) {
        return { status: "skipped", detail: "No created tweet to delete" };
      }

      const canDelete = Boolean(capabilities && capabilities.operations && capabilities.operations.deleteTweet);
      if (!canDelete) {
        return { status: "skipped", detail: "Capabilities report deleteTweet=false" };
      }

      const res = await client.request(`/api/twitter/tweets/${encodeURIComponent(createdTweetId)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const msg = res.json && res.json.error ? res.json.error : `Tweet cleanup delete failed (${res.status})`;
        throw new Error(msg);
      }

      return {
        status: "passed",
        detail: `deleted tweet id=${createdTweetId}`,
      };
    }, { required: false }),
  );

  const results = await runSteps(steps);
  const ok = printSummary(results);

  const failedSteps = results.filter((r) => r.status === "failed");
  if (failedSteps.length > 0) {
    printSection("Failure Details");
    for (const fail of failedSteps) {
      console.log(`- ${fail.name}: ${fail.detail}`);
    }
  }

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error("Fatal error running twitter flow test:");
  console.error(message);
  process.exit(1);
});
