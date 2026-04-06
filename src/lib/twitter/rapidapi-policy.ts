export type RapidTwitterProvider = "twitter241" | "twitter154";
export type RapidTwitterPhase = "phase1" | "phase2";
export type RapidTwitterPolicyStatus = "enabled" | "hold-rate-limit" | "hold-auth";
export type RapidTwitterRisk = "low" | "low-med" | "med" | "high";

export interface RapidTwitterEndpointPolicy {
  phase: RapidTwitterPhase;
  priority: string;
  provider: RapidTwitterProvider;
  method: "GET" | "POST";
  route: string;
  status: RapidTwitterPolicyStatus;
  risk: RapidTwitterRisk;
  note: string;
}

const PHASE1_ENABLED: RapidTwitterEndpointPolicy[] = [
  { phase: "phase1", priority: "P1-A", provider: "twitter241", method: "GET", route: "/user", status: "enabled", risk: "low", note: "Username lookup anchor endpoint" },
  { phase: "phase1", priority: "P1-A", provider: "twitter241", method: "GET", route: "/user-tweets", status: "enabled", risk: "low", note: "Core timeline read" },
  { phase: "phase1", priority: "P1-A", provider: "twitter241", method: "GET", route: "/user-replies", status: "enabled", risk: "low", note: "Replies feed" },
  { phase: "phase1", priority: "P1-A", provider: "twitter241", method: "GET", route: "/user-replies-v2", status: "enabled", risk: "low", note: "Replies alt version" },
  { phase: "phase1", priority: "P1-A", provider: "twitter241", method: "GET", route: "/user-media", status: "enabled", risk: "low", note: "Media feed" },
  { phase: "phase1", priority: "P1-A", provider: "twitter241", method: "GET", route: "/autocomplete", status: "enabled", risk: "low", note: "Search assist" },
  { phase: "phase1", priority: "P1-A", provider: "twitter241", method: "GET", route: "/trends-locations", status: "enabled", risk: "low", note: "Location metadata" },
  { phase: "phase1", priority: "P1-A", provider: "twitter241", method: "GET", route: "/trends-by-location", status: "enabled", risk: "low", note: "Trends read" },
  { phase: "phase1", priority: "P1-B", provider: "twitter241", method: "GET", route: "/jobs-search", status: "enabled", risk: "low-med", note: "Jobs vertical" },
  { phase: "phase1", priority: "P1-B", provider: "twitter241", method: "GET", route: "/about-account", status: "enabled", risk: "low-med", note: "Account about block" },
  { phase: "phase1", priority: "P1-B", provider: "twitter241", method: "GET", route: "/verified-followers", status: "enabled", risk: "low-med", note: "Follower segment" },
  { phase: "phase1", priority: "P1-B", provider: "twitter154", method: "GET", route: "/user/about", status: "enabled", risk: "low", note: "Stable profile read" },
  { phase: "phase1", priority: "P1-B", provider: "twitter154", method: "GET", route: "/user/medias", status: "enabled", risk: "low", note: "Stable media read" },
  { phase: "phase1", priority: "P1-B", provider: "twitter154", method: "GET", route: "/ai/topic-classification", status: "enabled", risk: "low-med", note: "AI utility endpoint" },
  { phase: "phase1", priority: "P1-B", provider: "twitter154", method: "POST", route: "/translate/detect", status: "enabled", risk: "low-med", note: "Language detect utility" },
];

const PHASE2_HOLD_RATE_LIMIT: Array<{ provider: RapidTwitterProvider; method: "GET" | "POST"; route: string }> = [
  { provider: "twitter241", method: "GET", route: "/community-members" },
  { provider: "twitter241", method: "GET", route: "/community-members-v2" },
  { provider: "twitter241", method: "GET", route: "/community-moderators" },
  { provider: "twitter241", method: "GET", route: "/community-tweets" },
  { provider: "twitter241", method: "GET", route: "/followers" },
  { provider: "twitter241", method: "GET", route: "/followers-ids" },
  { provider: "twitter241", method: "GET", route: "/highlights" },
  { provider: "twitter241", method: "GET", route: "/jobs-locations-suggest" },
  { provider: "twitter241", method: "GET", route: "/list-details" },
  { provider: "twitter241", method: "GET", route: "/list-followers" },
  { provider: "twitter241", method: "GET", route: "/list-timeline" },
  { provider: "twitter241", method: "GET", route: "/search" },
  { provider: "twitter241", method: "GET", route: "/search-community" },
  { provider: "twitter241", method: "GET", route: "/search-lists" },
  { provider: "twitter241", method: "GET", route: "/search-v2" },
  { provider: "twitter241", method: "GET", route: "/user-likes" },
  { provider: "twitter154", method: "GET", route: "/hashtag/hashtag" },
  { provider: "twitter154", method: "POST", route: "/hashtag/hashtag" },
  { provider: "twitter154", method: "GET", route: "/hashtag/hashtag/continuation" },
  { provider: "twitter154", method: "POST", route: "/hashtag/hashtag/continuation" },
  { provider: "twitter154", method: "GET", route: "/lists/details" },
  { provider: "twitter154", method: "GET", route: "/lists/tweets" },
  { provider: "twitter154", method: "GET", route: "/search/geo" },
  { provider: "twitter154", method: "GET", route: "/search/search" },
  { provider: "twitter154", method: "POST", route: "/search/search" },
  { provider: "twitter154", method: "GET", route: "/search/search/continuation" },
  { provider: "twitter154", method: "POST", route: "/search/search/continuation" },
  { provider: "twitter154", method: "GET", route: "/trends/" },
  { provider: "twitter154", method: "GET", route: "/trends/available" },
  { provider: "twitter154", method: "GET", route: "/tweet/details" },
  { provider: "twitter154", method: "POST", route: "/tweet/details" },
  { provider: "twitter154", method: "GET", route: "/tweet/favoriters" },
  { provider: "twitter154", method: "GET", route: "/tweet/favoriters/continuation" },
  { provider: "twitter154", method: "GET", route: "/tweet/replies" },
  { provider: "twitter154", method: "POST", route: "/tweet/replies" },
  { provider: "twitter154", method: "GET", route: "/tweet/replies/continuation" },
  { provider: "twitter154", method: "POST", route: "/tweet/replies/continuation" },
  { provider: "twitter154", method: "GET", route: "/user/details" },
  { provider: "twitter154", method: "POST", route: "/user/details" },
  { provider: "twitter154", method: "GET", route: "/user/followers" },
  { provider: "twitter154", method: "POST", route: "/user/followers" },
  { provider: "twitter154", method: "GET", route: "/user/followers/continuation" },
  { provider: "twitter154", method: "POST", route: "/user/followers/continuation" },
  { provider: "twitter154", method: "GET", route: "/user/following" },
  { provider: "twitter154", method: "POST", route: "/user/following" },
  { provider: "twitter154", method: "GET", route: "/user/following/continuation" },
  { provider: "twitter154", method: "POST", route: "/user/following/continuation" },
  { provider: "twitter154", method: "GET", route: "/user/likes" },
  { provider: "twitter154", method: "POST", route: "/user/likes" },
  { provider: "twitter154", method: "GET", route: "/user/likes/continuation" },
  { provider: "twitter154", method: "POST", route: "/user/likes/continuation" },
  { provider: "twitter154", method: "GET", route: "/user/tweets" },
  { provider: "twitter154", method: "POST", route: "/user/tweets" },
  { provider: "twitter154", method: "GET", route: "/user/tweets/continuation" },
  { provider: "twitter154", method: "POST", route: "/user/tweets/continuation" },
];

const PHASE2_HOLD_AUTH: Array<{ provider: RapidTwitterProvider; method: "GET" | "POST"; route: string }> = [
  { provider: "twitter154", method: "GET", route: "/ai/named-entity-recognition" },
  { provider: "twitter154", method: "GET", route: "/ai/sentiment-analysis" },
  { provider: "twitter154", method: "POST", route: "/translate" },
  { provider: "twitter154", method: "GET", route: "/tweet/retweets" },
  { provider: "twitter154", method: "GET", route: "/tweet/retweets/continuation" },
];

function toPolicy(
  source: Array<{ provider: RapidTwitterProvider; method: "GET" | "POST"; route: string }>,
  status: RapidTwitterPolicyStatus,
  note: string,
): RapidTwitterEndpointPolicy[] {
  return source.map((item) => ({
    phase: "phase2",
    priority: "HOLD",
    provider: item.provider,
    method: item.method,
    route: item.route,
    status,
    risk: "high",
    note,
  }));
}

export const RAPID_TWITTER_ENDPOINT_POLICIES: RapidTwitterEndpointPolicy[] = [
  ...PHASE1_ENABLED,
  ...toPolicy(PHASE2_HOLD_RATE_LIMIT, "hold-rate-limit", "Rate/plan blocked in latest validation run"),
  ...toPolicy(PHASE2_HOLD_AUTH, "hold-auth", "Auth blocked in latest validation run"),
];

export function getRapidTwitterEndpointPolicy(method: string, endpoint: string) {
  const normalizedMethod = method.toUpperCase();
  const normalizedRoute = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return RAPID_TWITTER_ENDPOINT_POLICIES.find(
    (item) => item.method === normalizedMethod && item.route === normalizedRoute,
  );
}

export function getRapidTwitterPolicySummary() {
  return RAPID_TWITTER_ENDPOINT_POLICIES.reduce(
    (acc, item) => {
      if (item.status === "enabled") acc.enabled += 1;
      if (item.status === "hold-rate-limit") acc.holdRateLimit += 1;
      if (item.status === "hold-auth") acc.holdAuth += 1;
      return acc;
    },
    { enabled: 0, holdRateLimit: 0, holdAuth: 0 },
  );
}
