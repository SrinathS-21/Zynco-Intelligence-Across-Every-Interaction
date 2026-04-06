import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
    ensureTwitterActorId,
    extractXError,
    loadTwitterAuthContext,
    xRequestWithAutoRefresh,
} from "@/lib/twitter/x-oauth-client";

type FollowingUser = {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
};

function parseIntInRange(value: string | null, fallbackValue: number, min: number, max: number) {
    const parsed = Number(value || String(fallbackValue));
    if (!Number.isFinite(parsed)) return fallbackValue;
    return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeFollowingUsers(payload: unknown): FollowingUser[] {
    const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const data = Array.isArray(root.data) ? root.data : [];

    return data
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => {
            const id = typeof entry.id === "string" ? entry.id.trim() : "";
            const usernameRaw = typeof entry.username === "string" ? entry.username.trim() : "";
            const nameRaw = typeof entry.name === "string" ? entry.name.trim() : "";
            const avatarRaw = typeof entry.profile_image_url === "string" ? entry.profile_image_url.trim() : "";

            return {
                id,
                username: usernameRaw.replace(/^@+/, "") || "twitter",
                name: nameRaw || usernameRaw.replace(/^@+/, "") || "Twitter User",
                profile_image_url: avatarRaw || undefined,
            };
        })
        .filter((item) => Boolean(item.id));
}

function normalizeTweetItems(payload: unknown) {
    const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const data = Array.isArray(root.data) ? root.data : [];
    return data.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

export async function GET(request: NextRequest) {
    try {
        const user = await requireUser(request);

        const maxAccounts = parseIntInRange(request.nextUrl.searchParams.get("max_accounts"), 8, 3, 20);
        const maxResultsPerAccount = parseIntInRange(request.nextUrl.searchParams.get("max_results_per_account"), 3, 1, 6);
        const maxItems = parseIntInRange(request.nextUrl.searchParams.get("max_items"), 40, 10, 120);

        const context = await loadTwitterAuthContext(user.id);
        const { context: actorContext, actorId } = await ensureTwitterActorId(context);

        const followingCall = await xRequestWithAutoRefresh(actorContext, {
            method: "GET",
            path: `/users/${encodeURIComponent(actorId)}/following`,
            query: {
                max_results: String(maxAccounts),
                "user.fields": "id,name,username,profile_image_url,verified",
            },
        });

        if (!followingCall.response.ok) {
            const reason = extractXError(
                followingCall.data,
                "Failed to load following accounts timeline. Ensure users.read scope is granted for your Twitter connection.",
            );
            return NextResponse.json({
                success: true,
                items: [],
                meta: {
                    provider: "official-following",
                    actorId,
                    followingAccounts: 0,
                    scannedAccounts: 0,
                    count: 0,
                    blocked: true,
                    warnings: [reason],
                },
            });
        }

        const followingUsers = normalizeFollowingUsers(followingCall.data);
        const warnings: string[] = [];

        const combined: Array<Record<string, unknown>> = [];

        for (const account of followingUsers) {
            if (combined.length >= maxItems) break;

            const tweetsCall = await xRequestWithAutoRefresh(actorContext, {
                method: "GET",
                path: `/users/${encodeURIComponent(account.id)}/tweets`,
                query: {
                    max_results: String(maxResultsPerAccount),
                    "tweet.fields": "created_at,public_metrics,conversation_id,in_reply_to_user_id,lang",
                },
            });

            if (!tweetsCall.response.ok) {
                warnings.push(`${account.username}: ${extractXError(tweetsCall.data, "tweet fetch failed")}`);
                continue;
            }

            const tweets = normalizeTweetItems(tweetsCall.data);
            tweets.forEach((tweet) => {
                combined.push({
                    ...tweet,
                    author: {
                        id: account.id,
                        name: account.name,
                        username: account.username,
                        profile_image_url: account.profile_image_url || null,
                    },
                });
            });
        }

        const sorted = combined
            .sort((a, b) => {
                const aTs = typeof a.created_at === "string" ? new Date(a.created_at).getTime() : 0;
                const bTs = typeof b.created_at === "string" ? new Date(b.created_at).getTime() : 0;
                return bTs - aTs;
            })
            .slice(0, maxItems);

        return NextResponse.json({
            success: true,
            items: sorted,
            meta: {
                provider: "official-following",
                actorId,
                followingAccounts: followingUsers.length,
                scannedAccounts: Math.min(followingUsers.length, maxAccounts),
                count: sorted.length,
                warnings,
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to load following timeline";
        return NextResponse.json({
            success: true,
            items: [],
            meta: {
                provider: "official-following",
                followingAccounts: 0,
                scannedAccounts: 0,
                count: 0,
                blocked: true,
                warnings: [message],
            },
        });
    }
}
