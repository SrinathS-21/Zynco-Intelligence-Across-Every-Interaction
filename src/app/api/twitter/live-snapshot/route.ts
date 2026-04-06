import { NextRequest, NextResponse } from "next/server";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { requireUser } from "@/lib/auth";
import {
  callRapidByEndpoint,
  fetchRapidProfileByUsername,
  fetchRapidTweetsByUsername,
  resolveConnectedTwitterUsername,
} from "@/lib/twitter/rapidapi-client";
import {
  normalizeRapidAboutOverview,
  normalizeRapidAutocompleteUsers,
  normalizeRapidProfileSnapshot,
  normalizeRapidSnapshotTweets,
  normalizeRapidTrends,
  type TwitterLiveSnapshot,
  type TwitterSnapshotCheck,
} from "@/lib/twitter/live-snapshot";

type SnapshotCacheEntry = {
  snapshot: TwitterLiveSnapshot;
  freshUntil: number;
  staleUntil: number;
};

const snapshotCache = new Map<string, SnapshotCacheEntry>();

function readFreshTtlMs() {
  const parsed = Number(process.env.TWITTER_LIVE_SNAPSHOT_FRESH_MS || "120000");
  if (!Number.isFinite(parsed)) return 120000;
  return Math.max(30000, Math.trunc(parsed));
}

function readStaleTtlMs() {
  const parsed = Number(process.env.TWITTER_LIVE_SNAPSHOT_STALE_MS || "1800000");
  if (!Number.isFinite(parsed)) return 1800000;
  return Math.max(120000, Math.trunc(parsed));
}

function buildCacheKey(userId: string, username: string) {
  return `${userId}:${username.toLowerCase()}`;
}

function readCachedSnapshot(cacheKey: string) {
  const entry = snapshotCache.get(cacheKey);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.staleUntil) {
    snapshotCache.delete(cacheKey);
    return null;
  }

  return {
    snapshot: entry.snapshot,
    stale: now > entry.freshUntil,
  };
}

function storeCachedSnapshot(cacheKey: string, snapshot: TwitterLiveSnapshot) {
  const now = Date.now();
  const freshTtlMs = readFreshTtlMs();
  const staleTtlMs = readStaleTtlMs();

  snapshotCache.set(cacheKey, {
    snapshot,
    freshUntil: now + freshTtlMs,
    staleUntil: now + staleTtlMs,
  });
}

function isRateLimited(status: number, error: unknown) {
  if (status === 429) return true;
  const text = typeof error === "string" ? error.toLowerCase() : "";
  return text.includes("rate") || text.includes("quota") || text.includes("basic");
}

function parsePositiveInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function readFailure(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

function check(label: string, ok: boolean, status: number, note: string): TwitterSnapshotCheck {
  return {
    label,
    ok,
    status,
    note,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const agent = await getOrCreateDefaultAgent(user.id);
    const config = getConfig(agent);

    const username = resolveConnectedTwitterUsername(config);
    if (!username) {
      return NextResponse.json(
        { error: "Twitter account is not connected. Connect Twitter first." },
        { status: 400 },
      );
    }

    const autocompleteQuery = request.nextUrl.searchParams.get("query")?.trim() || username || "AI";
    const woeid = request.nextUrl.searchParams.get("woeid")?.trim() || "1";
    const recentLimit = parsePositiveInteger(request.nextUrl.searchParams.get("max_results"), 8, 1, 20);
    const forceRefresh = request.nextUrl.searchParams.get("force") === "1";
    const cacheKey = buildCacheKey(user.id, username);
    const cached = forceRefresh ? null : readCachedSnapshot(cacheKey);

    if (cached && !cached.stale) {
      return NextResponse.json({
        success: true,
        snapshot: cached.snapshot,
        meta: {
          cached: true,
          stale: false,
          fallbackUsed: false,
        },
      });
    }

    const [profileResult, tweetsResult, autocompleteResult, trendsResult, aboutResult] = await Promise.all([
      fetchRapidProfileByUsername(username),
      fetchRapidTweetsByUsername(username, recentLimit, "tweets"),
      callRapidByEndpoint("GET", "/autocomplete", { query: autocompleteQuery }),
      callRapidByEndpoint("GET", "/trends-by-location", { woeid }),
      callRapidByEndpoint("GET", "/about-account", {}),
    ]);

    const liveProfile = profileResult.ok && profileResult.profile
      ? normalizeRapidProfileSnapshot(profileResult.profile, username)
      : null;

    const profile = liveProfile || cached?.snapshot.profile || null;
    const usedProfileCache = !liveProfile && Boolean(cached?.snapshot.profile);

    const liveRecentTweets = tweetsResult.ok
      ? normalizeRapidSnapshotTweets(tweetsResult.items, recentLimit)
      : [];

    const recentTweets = liveRecentTweets.length > 0
      ? liveRecentTweets
      : (cached?.snapshot.recentTweets || []);
    const usedTweetsCache = liveRecentTweets.length === 0 && Boolean(cached?.snapshot.recentTweets?.length);

    const liveAutocompleteUsers = autocompleteResult.ok && autocompleteResult.result
      ? normalizeRapidAutocompleteUsers(autocompleteResult.result.data)
      : [];

    const autocompleteUsers = liveAutocompleteUsers.length > 0
      ? liveAutocompleteUsers
      : (cached?.snapshot.signals.autocompleteUsers || []);
    const usedAutocompleteCache = liveAutocompleteUsers.length === 0 && Boolean(cached?.snapshot.signals.autocompleteUsers?.length);

    const liveTrends = trendsResult.ok && trendsResult.result
      ? normalizeRapidTrends(trendsResult.result.data)
      : [];

    const trends = liveTrends.length > 0
      ? liveTrends
      : (cached?.snapshot.signals.trends || []);
    const usedTrendsCache = liveTrends.length === 0 && Boolean(cached?.snapshot.signals.trends?.length);

    const aboutFallback = {
      name: profile?.name || username,
      handle: profile?.handle || `@${username}`,
      bio: profile?.bio || "No profile summary returned",
      location: "-",
      followersCount: profile?.followersCount || 0,
      followingCount: profile?.followingCount || 0,
      tweetsCount: profile?.tweetsCount || recentTweets.length,
    };

    const liveAbout = normalizeRapidAboutOverview(
      aboutResult.ok && aboutResult.result ? aboutResult.result.data : null,
      aboutFallback,
    );

    const about = aboutResult.ok
      ? liveAbout
      : (cached?.snapshot.signals.about || liveAbout);
    const usedAboutCache = !aboutResult.ok && Boolean(cached?.snapshot.signals.about);

    const checks: TwitterSnapshotCheck[] = [
      check(
        "Profile",
        profileResult.ok || usedProfileCache,
        profileResult.status,
        profileResult.ok
          ? "Profile payload loaded"
          : usedProfileCache
            ? (isRateLimited(profileResult.status, profileResult.error)
              ? "Rate-limited on live profile call. Showing cached profile."
              : "Live profile call failed. Showing cached profile.")
            : readFailure(profileResult.error, "Profile request failed"),
      ),
      check(
        "Recent Tweets",
        tweetsResult.ok || usedTweetsCache,
        tweetsResult.status,
        tweetsResult.ok
          ? `${liveRecentTweets.length} tweets normalized`
          : usedTweetsCache
            ? (isRateLimited(tweetsResult.status, tweetsResult.error)
              ? "Rate-limited on live tweets call. Showing cached tweets."
              : "Live tweets call failed. Showing cached tweets.")
            : readFailure(tweetsResult.error, "Tweets request failed"),
      ),
      check(
        "Autocomplete Users",
        autocompleteResult.ok || usedAutocompleteCache,
        autocompleteResult.status,
        autocompleteResult.ok
          ? `${liveAutocompleteUsers.length} user suggestions`
          : usedAutocompleteCache
            ? (isRateLimited(autocompleteResult.status, autocompleteResult.error)
              ? "Rate-limited on live autocomplete call. Showing cached suggestions."
              : "Live autocomplete call failed. Showing cached suggestions.")
            : readFailure(autocompleteResult.error, "Autocomplete request failed"),
      ),
      check(
        "Trends by Location",
        trendsResult.ok || usedTrendsCache,
        trendsResult.status,
        trendsResult.ok
          ? `${liveTrends.length} trends normalized`
          : usedTrendsCache
            ? (isRateLimited(trendsResult.status, trendsResult.error)
              ? "Rate-limited on live trends call. Showing cached trends."
              : "Live trends call failed. Showing cached trends.")
            : readFailure(trendsResult.error, "Trends request failed"),
      ),
      check(
        "About Account",
        aboutResult.ok || usedAboutCache,
        aboutResult.status,
        aboutResult.ok
          ? "About payload normalized"
          : usedAboutCache
            ? (isRateLimited(aboutResult.status, aboutResult.error)
              ? "Rate-limited on live account overview call. Showing cached overview."
              : "Live account overview call failed. Showing cached overview.")
            : readFailure(aboutResult.error, "About request failed"),
      ),
    ];

    const snapshot: TwitterLiveSnapshot = {
      fetchedAt: new Date().toISOString(),
      username,
      profile,
      recentTweets,
      signals: {
        autocompleteUsers,
        trends,
        about,
      },
      checks,
    };

    storeCachedSnapshot(cacheKey, snapshot);

    const fallbackUsed = usedProfileCache || usedTweetsCache || usedAutocompleteCache || usedTrendsCache || usedAboutCache;

    return NextResponse.json({
      success: true,
      snapshot,
      meta: {
        cached: false,
        stale: false,
        fallbackUsed,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to load Twitter live snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
