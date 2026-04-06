export interface TwitterSnapshotCheck {
  label: string;
  ok: boolean;
  status: number;
  note: string;
}

export interface TwitterLiveAutocompleteUser {
  name: string;
  handle: string;
  bio: string;
}

export interface TwitterLiveTrend {
  name: string;
  volume: number | null;
  volumeLabel: string;
}

export interface TwitterLiveAboutOverview {
  name: string;
  handle: string;
  bio: string;
  location: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
}

export interface TwitterLiveRecentTweet {
  id: string;
  text: string;
  timestamp: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
}

export interface TwitterLiveProfileSnapshot {
  name: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  source: "rapidapi" | "official" | "unknown";
}

export interface TwitterLiveSnapshot {
  fetchedAt: string;
  username: string;
  profile: TwitterLiveProfileSnapshot | null;
  recentTweets: TwitterLiveRecentTweet[];
  signals: {
    autocompleteUsers: TwitterLiveAutocompleteUser[];
    trends: TwitterLiveTrend[];
    about: TwitterLiveAboutOverview;
  };
  checks: TwitterSnapshotCheck[];
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

function collectObjectNodes(input: unknown, limit = 800) {
  const nodes: Record<string, unknown>[] = [];

  walkObjects(input, (node) => {
    if (nodes.length < limit) {
      nodes.push(node);
    }
  });

  return nodes;
}

function pickFirstString(node: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = node[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function pickFirstCount(node: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const parsed = Number(node[key]);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function toCount(input: unknown) {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isNoisyText(value: string) {
  const lower = value.toLowerCase();
  return (
    !lower
    || lower === "undefined"
    || lower === "null"
    || lower.includes("cannot be blank")
    || lower.includes("@undefined")
  );
}

function sanitizeHandle(raw: string) {
  const cleaned = raw.replace(/^@+/, "").trim();
  if (!/^[a-zA-Z0-9_]{2,15}$/.test(cleaned)) {
    return "";
  }
  return cleaned;
}

export function normalizeRapidProfileSnapshot(payload: unknown, fallbackUsername: string): TwitterLiveProfileSnapshot {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const metrics = data.public_metrics && typeof data.public_metrics === "object"
    ? (data.public_metrics as Record<string, unknown>)
    : {};

  const username = (typeof data.username === "string" ? data.username : fallbackUsername).replace(/^@+/, "").trim();

  return {
    name: (typeof data.name === "string" && data.name.trim()) ? data.name.trim() : username || fallbackUsername,
    handle: username ? `@${username}` : `@${fallbackUsername}`,
    avatarUrl: typeof data.profile_image_url === "string" ? data.profile_image_url : "",
    bio: typeof data.description === "string" ? data.description : "",
    followersCount: toCount(metrics.followers_count),
    followingCount: toCount(metrics.following_count),
    tweetsCount: toCount(metrics.tweet_count),
    source: (typeof data.source === "string" && data.source === "rapidapi") ? "rapidapi" : "unknown",
  };
}

export function normalizeRapidSnapshotTweets(items: unknown, limit = 8): TwitterLiveRecentTweet[] {
  const rows = Array.isArray(items) ? items : [];

  return rows
    .map((item, index) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const metrics = record.public_metrics && typeof record.public_metrics === "object"
        ? (record.public_metrics as Record<string, unknown>)
        : {};

      const id =
        (typeof record.id === "string" && record.id.trim())
        || (typeof record.id_str === "string" && record.id_str.trim())
        || `tweet-${index + 1}`;

      const text =
        (typeof record.text === "string" && record.text.trim())
        || (typeof record.full_text === "string" && record.full_text.trim())
        || "No content";

      const timestamp =
        (typeof record.created_at === "string" && record.created_at)
        || (typeof record.timestamp === "string" && record.timestamp)
        || "";

      return {
        id,
        text,
        timestamp,
        likeCount: toCount(metrics.like_count ?? record.like_count),
        retweetCount: toCount(metrics.retweet_count ?? record.retweet_count),
        replyCount: toCount(metrics.reply_count ?? record.reply_count),
      };
    })
    .slice(0, Math.max(1, limit));
}

export function normalizeRapidAutocompleteUsers(payload: unknown, limit = 8): TwitterLiveAutocompleteUser[] {
  const rows: TwitterLiveAutocompleteUser[] = [];
  const seen = new Set<string>();
  const nodes = collectObjectNodes(payload);

  for (const node of nodes) {
    const handleRaw = sanitizeHandle(pickFirstString(node, ["screen_name", "username", "userName", "handle", "user_handle"]));
    const rawName = compactText(pickFirstString(node, ["name", "display_name", "displayName"]));
    const rawBio = compactText(pickFirstString(node, ["description", "bio", "legacy_description", "location"]));

    const name = !isNoisyText(rawName)
      ? rawName
      : handleRaw;

    const bio = !isNoisyText(rawBio)
      ? rawBio
      : "";

    if (!handleRaw && !name) {
      continue;
    }

    const key = `${handleRaw.toLowerCase()}|${name.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    rows.push({
      name: name || "User",
      handle: handleRaw ? `@${handleRaw}` : "-",
      bio,
    });

    if (rows.length >= limit) {
      break;
    }
  }

  return rows;
}

export function normalizeRapidTrends(payload: unknown, limit = 10): TwitterLiveTrend[] {
  const rows: TwitterLiveTrend[] = [];
  const seen = new Set<string>();
  const nodes = collectObjectNodes(payload);

  for (const node of nodes) {
    const rawName = pickFirstString(node, ["name", "trend_name", "topic_name", "query"]);
    if (!rawName) {
      continue;
    }

    const trendName = rawName.startsWith("#") ? rawName : `#${rawName}`;
    const trendKey = trendName.toLowerCase();
    if (seen.has(trendKey)) {
      continue;
    }
    seen.add(trendKey);

    const volume = pickFirstCount(node, ["tweet_volume", "tweetVolume", "post_count", "posts", "count", "volume"]);
    rows.push({
      name: trendName,
      volume,
      volumeLabel: volume !== null ? `${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(volume)} posts` : "Live trend",
    });

    if (rows.length >= limit) {
      break;
    }
  }

  return rows;
}

export function normalizeRapidAboutOverview(
  payload: unknown,
  fallback: TwitterLiveAboutOverview,
): TwitterLiveAboutOverview {
  const nodes = collectObjectNodes(payload);
  const target = nodes.find((node) => {
    return Boolean(
      pickFirstString(node, ["name", "screen_name", "username", "description", "bio", "location"])
      || pickFirstCount(node, ["followers_count", "friends_count", "following_count", "statuses_count", "tweet_count"]),
    );
  });

  if (!target) {
    return fallback;
  }

  const handle = pickFirstString(target, ["screen_name", "username", "userName"]).replace(/^@+/, "");
  const followers = pickFirstCount(target, ["followers_count", "followers"]);
  const following = pickFirstCount(target, ["friends_count", "following_count", "following"]);
  const tweets = pickFirstCount(target, ["statuses_count", "tweet_count", "tweets_count"]);

  return {
    name: pickFirstString(target, ["name", "display_name", "displayName"]) || fallback.name,
    handle: handle ? `@${handle}` : fallback.handle,
    bio: pickFirstString(target, ["description", "bio", "legacy_description"]) || fallback.bio,
    location: pickFirstString(target, ["location", "country", "city"]) || fallback.location,
    followersCount: followers ?? fallback.followersCount,
    followingCount: following ?? fallback.followingCount,
    tweetsCount: tweets ?? fallback.tweetsCount,
  };
}
