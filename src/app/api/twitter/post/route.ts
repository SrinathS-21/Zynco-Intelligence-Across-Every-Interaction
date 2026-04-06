import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { ensureTwitterAccessToken } from "@/lib/twitter/oauth";

const X_CREATE_TWEET_URL = "https://api.x.com/2/tweets";

function readString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
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

export async function POST(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const payload = await request.json();

        const text = readString(payload?.text);
        const title = readString(payload?.title) || "Twitter Update";

        if (!text) {
            return NextResponse.json({ error: "text is required" }, { status: 400 });
        }

        const agent = await getOrCreateDefaultAgent(user.id);
        let effectiveConfig = getConfig(agent);
        let accessToken: string;

        try {
            const ensured = await ensureTwitterAccessToken({
                agentId: agent.id,
                config: effectiveConfig,
            });
            accessToken = ensured.accessToken;
            effectiveConfig = ensured.config;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Twitter OAuth access token is missing";
            return NextResponse.json({ error: `${message}. Reconnect Twitter to continue.` }, { status: 400 });
        }

        const postWithToken = async (token: string) => {
            const response = await fetch(X_CREATE_TWEET_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text }),
            });

            const json = await safeJson(response);
            return { response, json };
        };

        let xCall = await postWithToken(accessToken);
        if (xCall.response.status === 401 || xCall.response.status === 403) {
            try {
                const refreshed = await ensureTwitterAccessToken({
                    agentId: agent.id,
                    config: effectiveConfig,
                    forceRefresh: true,
                });
                accessToken = refreshed.accessToken;
                effectiveConfig = refreshed.config;
                xCall = await postWithToken(accessToken);
            } catch {
                // Let final error handling below return a meaningful response.
            }
        }

        const xResponse = xCall.response;
        const xJson = xCall.json;
        if (!xResponse.ok) {
            const detail =
                xJson && typeof xJson === "object"
                    ? (
                        ((xJson as Record<string, unknown>).detail as string)
                        || ((xJson as Record<string, unknown>).title as string)
                        || ((xJson as Record<string, unknown>).error as string)
                    )
                    : "";
            return NextResponse.json({ error: detail || "Failed to create tweet on X" }, { status: xResponse.status || 500 });
        }

        const twitterConfig = effectiveConfig.socialConnections?.twitter;
        const username = readString(twitterConfig?.username || twitterConfig?.accountId);

        const tweetId =
            xJson && typeof xJson === "object" && (xJson as Record<string, unknown>).data && typeof (xJson as Record<string, unknown>).data === "object"
                ? readString(((xJson as Record<string, unknown>).data as Record<string, unknown>).id)
                : "";

        const tweetUrl = tweetId && username ? `https://x.com/${username}/status/${tweetId}` : null;

        await prisma.unifiedMessage.create({
            data: {
                userId: user.id,
                platform: "twitter",
                contactId: "self",
                content: text,
                direction: "OUTBOUND",
                metadata: {
                    title,
                    twitterUrn: tweetId || null,
                    tweetId: tweetId || null,
                    url: tweetUrl,
                    status: "PUBLISHED",
                    provider: "x-oauth",
                },
            },
        });

        return NextResponse.json({
            success: true,
            post: {
                id: tweetId || `tw_${Date.now()}`,
                tweet_id: tweetId || null,
                url: tweetUrl,
                provider: "x-oauth",
                raw: xJson,
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to publish tweet";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
