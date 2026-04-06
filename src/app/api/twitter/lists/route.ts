import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import {
    ensureTwitterActorId,
    extractXError,
    loadTwitterAuthContext,
    xRequestWithAutoRefresh,
} from "@/lib/twitter/x-oauth-client";
import { getTwitterReadProviderMode } from "@/lib/twitter/rapidapi-client";

type TwitterListItem = {
    id: string;
    name: string;
    description: string;
    source: "official" | "smart";
    url: string | null;
    memberCount: number;
    subscriberCount: number;
    tweetCount: number;
    updatedAt: string | null;
    samples: string[];
    previewTweetIds: string[];
};

function parseLimit(value: string | null) {
    const parsed = Number(value || "8");
    if (!Number.isFinite(parsed)) return 8;
    return Math.max(3, Math.min(20, Math.trunc(parsed)));
}

function clampCount(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.trunc(parsed);
}

function readText(value: unknown, fallback = "") {
    if (typeof value === "string" && value.trim()) return value.trim();
    return fallback;
}

function readMetadata(metadata: unknown) {
    if (!metadata || typeof metadata !== "object") return {} as Record<string, unknown>;
    return metadata as Record<string, unknown>;
}

function buildSmartLists(params: {
    messages: Array<{
        id: string;
        content: string;
        direction: string;
        timestamp: Date;
        contactName: string | null;
        contactId: string;
        metadata: unknown;
    }>;
    username: string;
}): TwitterListItem[] {
    const { messages, username } = params;
    const outbound = messages.filter((item) => item.direction === "OUTBOUND");
    const inbound = messages.filter((item) => item.direction !== "OUTBOUND");

    const contactBuckets = new Map<string, number>();
    inbound.forEach((item) => {
        const key = (item.contactName || item.contactId || "Unknown").trim();
        if (!key) return;
        contactBuckets.set(key, (contactBuckets.get(key) || 0) + 1);
    });

    const topContacts = [...contactBuckets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const publishedSamples = outbound
        .slice(0, 5)
        .map((item) => item.content.slice(0, 120))
        .filter(Boolean);

    const previewTweetIds = outbound
        .map((item) => {
            const metadata = readMetadata(item.metadata);
            const tweetId =
                readText(metadata.tweetId)
                || readText(metadata.twitterUrn)
                || readText(metadata.id)
                || "";
            return tweetId;
        })
        .filter(Boolean)
        .slice(0, 20);

    const topContactNames = topContacts.map(([name]) => name);

    const accountHandle = username.replace(/^@+/, "").trim() || "twitter";

    return [
        {
            id: "smart-priority-replies",
            name: "Priority Replies",
            description: "Most active inbound conversations that need attention.",
            source: "smart",
            url: null,
            memberCount: topContacts.length,
            subscriberCount: 0,
            tweetCount: inbound.length,
            updatedAt: new Date().toISOString(),
            samples: topContactNames,
            previewTweetIds,
        },
        {
            id: "smart-top-engagers",
            name: "Top Engagers",
            description: "Contacts with the highest interaction volume across your recent Twitter inbox.",
            source: "smart",
            url: null,
            memberCount: topContacts.length,
            subscriberCount: 0,
            tweetCount: inbound.length,
            updatedAt: new Date().toISOString(),
            samples: topContactNames,
            previewTweetIds,
        },
        {
            id: "smart-published-posts",
            name: "Published Posts",
            description: "Your recent published tweets grouped as an execution list.",
            source: "smart",
            url: `https://x.com/${accountHandle}`,
            memberCount: 1,
            subscriberCount: 0,
            tweetCount: outbound.length,
            updatedAt: new Date().toISOString(),
            samples: publishedSamples,
            previewTweetIds,
        },
    ];
}

function normalizeOfficialLists(payload: unknown): TwitterListItem[] {
    const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const data = Array.isArray(root.data) ? root.data : [];

    return data
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => {
            const id = readText(entry.id) || `list-${Math.random().toString(36).slice(2, 8)}`;
            const name = readText(entry.name, "Untitled List");
            const description = readText(entry.description, "No description");
            const createdAt = readText(entry.created_at) || null;
            const privateFlag = entry.private === true;
            const memberCount = clampCount(entry.member_count);
            const followerCount = clampCount(entry.follower_count);

            return {
                id,
                name,
                description,
                source: "official" as const,
                url: `https://x.com/i/lists/${encodeURIComponent(id)}`,
                memberCount,
                subscriberCount: followerCount,
                tweetCount: 0,
                updatedAt: createdAt,
                samples: [],
                previewTweetIds: [],
            };
        });
}

export async function GET(request: NextRequest) {
    const readMode = getTwitterReadProviderMode();

    try {
        const user = await requireUser(request);
        const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

        const agent = await getOrCreateDefaultAgent(user.id);
        const config = getConfig(agent);
        const username =
            readText(config.socialConnections?.twitter?.username)
            || readText(config.socialConnections?.twitter?.accountId);

        const messages = await prisma.unifiedMessage.findMany({
            where: {
                userId: user.id,
                platform: "twitter",
            },
            orderBy: {
                timestamp: "desc",
            },
            take: 220,
            select: {
                id: true,
                content: true,
                direction: true,
                timestamp: true,
                contactName: true,
                contactId: true,
                metadata: true,
            },
        });

        const smartLists = buildSmartLists({ messages, username });

        let officialLists: TwitterListItem[] = [];
        let warning: string | null = null;

        if (readMode !== "rapidapi") {
            try {
                const auth = await loadTwitterAuthContext(user.id);
                const { context: actorContext, actorId } = await ensureTwitterActorId(auth);

                const listCall = await xRequestWithAutoRefresh(actorContext, {
                    method: "GET",
                    path: `/users/${encodeURIComponent(actorId)}/owned_lists`,
                    query: {
                        max_results: String(Math.max(limit, 10)),
                        "list.fields": "created_at,follower_count,member_count,private,description",
                    },
                });

                if (listCall.response.ok) {
                    officialLists = normalizeOfficialLists(listCall.data);
                } else {
                    warning = extractXError(listCall.data, "Unable to load official Twitter lists");
                }
            } catch (error) {
                warning = error instanceof Error ? error.message : "Unable to load official Twitter lists";
            }
        }

        const seen = new Set<string>();
        const merged = [...officialLists, ...smartLists].filter((item) => {
            const key = `${item.source}:${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return NextResponse.json({
            success: true,
            lists: merged.slice(0, limit),
            meta: {
                mode: readMode,
                officialAvailable: officialLists.length > 0,
                warning,
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to load Twitter lists";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
