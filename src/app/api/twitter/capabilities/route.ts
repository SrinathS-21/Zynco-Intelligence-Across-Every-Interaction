import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { getTwitterReadProviderMode } from "@/lib/twitter/rapidapi-client";
import { getRapidTwitterPolicySummary } from "@/lib/twitter/rapidapi-policy";

function toScopeSet(scopeValue: unknown) {
    if (typeof scopeValue !== "string") return new Set<string>();
    return new Set(
        scopeValue
            .split(/[\s,]+/g)
            .map((token) => token.trim())
            .filter(Boolean),
    );
}

export async function GET(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const agent = await getOrCreateDefaultAgent(user.id);
        const config = getConfig(agent);
        const rapidSummary = getRapidTwitterPolicySummary();
        const readMode = getTwitterReadProviderMode();

        const twitter = config.socialConnections?.twitter;
        const scopes = toScopeSet(twitter?.oauthScope);

        const hasTweetRead = scopes.has("tweet.read");
        const hasTweetWrite = scopes.has("tweet.write");
        const hasUsersRead = scopes.has("users.read");
        const hasOfflineAccess = scopes.has("offline.access");

        const hasIdentity = Boolean(twitter?.accountId || twitter?.username);
        const hasAccessToken = Boolean(twitter?.oauthAccessToken);
        const refreshAvailable = Boolean(twitter?.oauthRefreshToken);
        const canAutoRefresh = refreshAvailable && hasOfflineAccess;
        const tokenHealthy = hasAccessToken || canAutoRefresh;

        const authState = !hasIdentity
            ? "disconnected"
            : tokenHealthy
                ? "ready"
                : "reauth_required";

        const authReason = authState === "reauth_required"
            ? "Twitter OAuth tokens are missing. Reconnect Twitter to continue."
            : authState === "disconnected"
                ? "Twitter account is not connected."
                : "";

        return NextResponse.json({
            connected: hasIdentity && tokenHealthy,
            tokenHealthy,
            refreshAvailable,
            auth: {
                state: authState,
                reason: authReason,
                hasIdentity,
                hasAccessToken,
                hasRefreshToken: refreshAvailable,
            },
            scopes: {
                tweetRead: hasTweetRead,
                tweetWrite: hasTweetWrite,
                usersRead: hasUsersRead,
                offlineAccess: hasOfflineAccess,
                raw: Array.from(scopes),
            },
            operations: {
                me: hasIdentity && tokenHealthy && hasUsersRead,
                createTweet: hasIdentity && tokenHealthy && hasTweetWrite,
                readOwnTweets: hasIdentity && tokenHealthy && hasTweetRead,
                readTweetById: hasIdentity && tokenHealthy && hasTweetRead,
                deleteTweet: hasIdentity && tokenHealthy && hasTweetWrite,
                likeUnlike: hasIdentity && tokenHealthy && hasTweetWrite,
                retweetUnretweet: hasIdentity && tokenHealthy && hasTweetWrite,
                reply: hasIdentity && tokenHealthy && hasTweetWrite,
                silentRefresh: canAutoRefresh,
            },
            rapidApi: {
                readMode,
                enabledEndpoints: rapidSummary.enabled,
                holdRateLimitEndpoints: rapidSummary.holdRateLimit,
                holdAuthEndpoints: rapidSummary.holdAuth,
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to load Twitter capabilities";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
