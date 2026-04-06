import { prisma } from "@/lib/db";
import type { AgentConfig } from "@/lib/types";

const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";

function readString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function expiresSoon(expiresAt: string | null | undefined, skewMs = 2 * 60 * 1000) {
    if (!expiresAt) return false;
    const expiry = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiry)) return false;
    return Date.now() >= expiry - skewMs;
}

async function safeJson(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

type EnsureTokenParams = {
    agentId: string;
    config: AgentConfig;
    forceRefresh?: boolean;
};

type EnsureTokenResult = {
    accessToken: string;
    config: AgentConfig;
    refreshed: boolean;
};

export async function ensureTwitterAccessToken(params: EnsureTokenParams): Promise<EnsureTokenResult> {
    const { agentId, config, forceRefresh = false } = params;

    const twitterConfig = config.socialConnections?.twitter;
    const currentAccessToken = readString(twitterConfig?.oauthAccessToken);
    const refreshToken = readString(twitterConfig?.oauthRefreshToken);
    const currentExpiry = twitterConfig?.oauthExpiresAt || null;

    const shouldRefresh = forceRefresh || !currentAccessToken || expiresSoon(currentExpiry);

    if (!shouldRefresh) {
        return {
            accessToken: currentAccessToken,
            config,
            refreshed: false,
        };
    }

    if (!refreshToken) {
        if (currentAccessToken && !forceRefresh) {
            return {
                accessToken: currentAccessToken,
                config,
                refreshed: false,
            };
        }
        throw new Error("Twitter refresh token is missing. Reconnect Twitter to continue.");
    }

    const clientId = readString(process.env.TWITTER_CLIENT_ID);
    const clientSecret = readString(process.env.TWITTER_CLIENT_SECRET);

    if (!clientId) {
        throw new Error("TWITTER_CLIENT_ID is not configured");
    }

    const tokenPayload = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
    });

    const tokenHeaders: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
    };

    if (clientSecret) {
        tokenHeaders.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    }

    const tokenResponse = await fetch(X_TOKEN_URL, {
        method: "POST",
        headers: tokenHeaders,
        body: tokenPayload.toString(),
    });
    const tokenJson = await safeJson(tokenResponse);

    if (!tokenResponse.ok) {
        const detail =
            tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).error_description === "string"
                ? String((tokenJson as Record<string, unknown>).error_description)
                : "Twitter token refresh failed";
        throw new Error(detail);
    }

    const nextAccessToken =
        tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).access_token === "string"
            ? readString((tokenJson as Record<string, unknown>).access_token)
            : "";

    if (!nextAccessToken) {
        throw new Error("Twitter refresh succeeded but no access token was returned");
    }

    const nextRefreshToken =
        tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).refresh_token === "string"
            ? readString((tokenJson as Record<string, unknown>).refresh_token)
            : refreshToken;

    const nextTokenType =
        tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).token_type === "string"
            ? readString((tokenJson as Record<string, unknown>).token_type)
            : readString(twitterConfig?.oauthTokenType) || "Bearer";

    const nextScope =
        tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).scope === "string"
            ? readString((tokenJson as Record<string, unknown>).scope)
            : readString(twitterConfig?.oauthScope);

    const expiresInSeconds =
        tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).expires_in === "number"
            ? Number((tokenJson as Record<string, unknown>).expires_in)
            : null;

    const nextExpiresAt =
        typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds)
            ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
            : null;

    const nextConfig: AgentConfig = {
        ...config,
        socialConnections: {
            instagram: { ...(config.socialConnections?.instagram || {}) },
            linkedin: { ...(config.socialConnections?.linkedin || {}) },
            twitter: {
                ...(config.socialConnections?.twitter || {}),
                oauthAccessToken: nextAccessToken,
                oauthRefreshToken: nextRefreshToken || undefined,
                oauthTokenType: nextTokenType || "Bearer",
                oauthScope: nextScope || undefined,
                oauthExpiresAt: nextExpiresAt,
            },
        },
    };

    await prisma.agent.update({
        where: { id: agentId },
        data: {
            config: nextConfig as any,
        },
    });

    return {
        accessToken: nextAccessToken,
        config: nextConfig,
        refreshed: true,
    };
}
