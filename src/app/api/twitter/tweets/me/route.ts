import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import {
    ensureTwitterActorId,
    extractXError,
    loadTwitterAuthContext,
    xRequestWithAutoRefresh,
} from "@/lib/twitter/x-oauth-client";
import {
    fetchRapidTweetsByUsername,
    getTwitterReadProviderMode,
    resolveConnectedTwitterUsername,
} from "@/lib/twitter/rapidapi-client";

function parseMaxResults(value: string | null) {
    const parsed = Number(value || "20");
    if (!Number.isFinite(parsed)) return 20;
    return Math.max(5, Math.min(100, Math.trunc(parsed)));
}

async function readTweetsFromRapidApi(userId: string, maxResults: number) {
    const agent = await getOrCreateDefaultAgent(userId);
    const config = getConfig(agent);
    const username = resolveConnectedTwitterUsername(config);

    if (!username) {
        return NextResponse.json(
            { error: "Twitter account is not connected. Connect Twitter first." },
            { status: 400 },
        );
    }

    const rapid = await fetchRapidTweetsByUsername(username, maxResults, "tweets");
    if (!rapid.ok) {
        return NextResponse.json(
            { error: rapid.error || "Failed to load tweets via RapidAPI" },
            { status: rapid.status || 500 },
        );
    }

    return NextResponse.json({
        success: true,
        userId: username,
        items: rapid.items,
        meta: {
            provider: "rapidapi",
            host: rapid.provider,
            route: rapid.route,
            count: rapid.items.length,
        },
    });
}

export async function GET(request: NextRequest) {
    const readMode = getTwitterReadProviderMode();

    try {
        const user = await requireUser(request);
        const maxResults = parseMaxResults(request.nextUrl.searchParams.get("max_results"));

        if (readMode === "rapidapi") {
            return readTweetsFromRapidApi(user.id, maxResults);
        }

        const context = await loadTwitterAuthContext(user.id);
        const { context: actorContext, actorId } = await ensureTwitterActorId(context);

        const tweetsCall = await xRequestWithAutoRefresh(actorContext, {
            method: "GET",
            path: `/users/${encodeURIComponent(actorId)}/tweets`,
            query: {
                max_results: String(maxResults),
                "tweet.fields": "created_at,public_metrics,conversation_id,in_reply_to_user_id,lang",
            },
        });

        if (!tweetsCall.response.ok) {
            if (readMode === "auto" && (tweetsCall.status === 401 || tweetsCall.status === 403 || tweetsCall.status === 429)) {
                return readTweetsFromRapidApi(user.id, maxResults);
            }

            return NextResponse.json(
                { error: extractXError(tweetsCall.data, "Failed to load tweets") },
                { status: tweetsCall.status },
            );
        }

        const payload = tweetsCall.data as Record<string, unknown> | null;

        return NextResponse.json({
            success: true,
            userId: actorId,
            items: Array.isArray(payload?.data) ? payload?.data : [],
            meta: {
                ...(payload?.meta && typeof payload.meta === "object" ? payload.meta as Record<string, unknown> : {}),
                provider: "official",
                host: "api.x.com",
                route: `/users/${actorId}/tweets`,
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await requireUser(request).catch(() => null);
        if (readMode === "auto" && user) {
            const maxResults = parseMaxResults(request.nextUrl.searchParams.get("max_results"));
            return readTweetsFromRapidApi(user.id, maxResults);
        }

        const message = error instanceof Error ? error.message : "Failed to load tweets";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
