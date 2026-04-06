import { prisma } from "@/lib/db";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import type { AgentConfig } from "@/lib/types";
import { ensureTwitterAccessToken } from "@/lib/twitter/oauth";

const X_API_BASE = "https://api.x.com/2";

function readString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function safeStatus(response: Response) {
    return Number.isFinite(response.status) ? response.status : 500;
}

export async function safeJson(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

export function extractXError(payload: unknown, fallback: string) {
    if (!payload || typeof payload !== "object") return fallback;
    const obj = payload as Record<string, unknown>;

    if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail.trim();
    if (typeof obj.title === "string" && obj.title.trim()) return obj.title.trim();
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error.trim();
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
        const first = obj.errors[0];
        if (first && typeof first === "object" && typeof (first as Record<string, unknown>).message === "string") {
            return String((first as Record<string, unknown>).message);
        }
    }

    return fallback;
}

export type TwitterAuthContext = {
    userId: string;
    agentId: string;
    config: AgentConfig;
    accessToken: string;
    username: string;
    actorId: string;
};

export async function loadTwitterAuthContext(userId: string): Promise<TwitterAuthContext> {
    const agent = await getOrCreateDefaultAgent(userId);
    let config = getConfig(agent);

    const connectedUsername = readString(config.socialConnections?.twitter?.username || config.socialConnections?.twitter?.accountId);
    if (!connectedUsername) {
        throw new Error("Twitter account is not connected. Connect Twitter first.");
    }

    const ensured = await ensureTwitterAccessToken({
        agentId: agent.id,
        config,
    });

    config = ensured.config;

    const accessToken = readString(config.socialConnections?.twitter?.oauthAccessToken);
    if (!accessToken) {
        throw new Error("Twitter OAuth access token is missing. Reconnect Twitter.");
    }

    return {
        userId,
        agentId: agent.id,
        config,
        accessToken,
        username: readString(config.socialConnections?.twitter?.username || config.socialConnections?.twitter?.accountId),
        actorId: readString(config.socialConnections?.twitter?.externalUserId),
    };
}

type XRequestParams = {
    method: "GET" | "POST" | "DELETE";
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
};

function buildXApiUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
    const url = new URL(`${X_API_BASE}${path}`);
    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") return;
            url.searchParams.set(key, String(value));
        });
    }
    return url.toString();
}

async function executeXRequest(accessToken: string, params: XRequestParams) {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
    };

    if (params.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(buildXApiUrl(params.path, params.query), {
        method: params.method,
        headers,
        body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
    });

    const data = await safeJson(response);
    return { response, data };
}

export async function xRequestWithAutoRefresh(context: TwitterAuthContext, params: XRequestParams) {
    let nextContext = context;

    let result = await executeXRequest(nextContext.accessToken, params);
    if (result.response.status === 401 || result.response.status === 403) {
        const refreshed = await ensureTwitterAccessToken({
            agentId: nextContext.agentId,
            config: nextContext.config,
            forceRefresh: true,
        });

        nextContext = {
            ...nextContext,
            config: refreshed.config,
            accessToken: refreshed.accessToken,
            username: readString(refreshed.config.socialConnections?.twitter?.username || refreshed.config.socialConnections?.twitter?.accountId),
            actorId: readString(refreshed.config.socialConnections?.twitter?.externalUserId),
        };

        result = await executeXRequest(nextContext.accessToken, params);
    }

    return {
        ...result,
        context: nextContext,
        status: safeStatus(result.response),
    };
}

export async function persistTwitterProfile(context: TwitterAuthContext, profile: {
    id?: string;
    username?: string;
    name?: string;
    profile_image_url?: string;
}) {
    const current = context.config.socialConnections?.twitter || {};

    const nextUsername = readString(profile.username) || readString(current.username || current.accountId);
    const nextDisplayName = readString(profile.name) || readString(current.displayName || nextUsername);
    const nextAvatar = readString(profile.profile_image_url) || (typeof current.avatarUrl === "string" ? current.avatarUrl : "");
    const nextExternalId = readString(profile.id) || readString(current.externalUserId);

    const nextConfig: AgentConfig = {
        ...context.config,
        socialConnections: {
            instagram: { ...(context.config.socialConnections?.instagram || {}) },
            linkedin: { ...(context.config.socialConnections?.linkedin || {}) },
            twitter: {
                ...current,
                accountId: nextUsername || current.accountId,
                username: nextUsername || undefined,
                displayName: nextDisplayName || undefined,
                avatarUrl: nextAvatar || null,
                externalUserId: nextExternalId || undefined,
                status: "connected",
            },
        },
    };

    await prisma.agent.update({
        where: { id: context.agentId },
        data: {
            config: nextConfig as any,
        },
    });

    return {
        ...context,
        config: nextConfig,
        username: nextUsername,
        actorId: nextExternalId,
    };
}

export async function ensureTwitterActorId(context: TwitterAuthContext) {
    if (context.actorId) {
        return {
            context,
            actorId: context.actorId,
            profile: {
                id: context.actorId,
                username: context.username,
            },
        };
    }

    const meCall = await xRequestWithAutoRefresh(context, {
        method: "GET",
        path: "/users/me",
        query: {
            "user.fields": "id,name,username,profile_image_url,public_metrics",
        },
    });

    if (!meCall.response.ok) {
        throw new Error(extractXError(meCall.data, "Unable to resolve Twitter user identity"));
    }

    const meData =
        meCall.data && typeof meCall.data === "object" && (meCall.data as Record<string, unknown>).data && typeof (meCall.data as Record<string, unknown>).data === "object"
            ? ((meCall.data as Record<string, unknown>).data as Record<string, unknown>)
            : null;

    if (!meData) {
        throw new Error("Twitter users/me did not return profile data");
    }

    const nextContext = await persistTwitterProfile(meCall.context, {
        id: readString(meData.id),
        username: readString(meData.username),
        name: readString(meData.name),
        profile_image_url: readString(meData.profile_image_url),
    });

    return {
        context: nextContext,
        actorId: nextContext.actorId,
        profile: meData,
    };
}
