import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

type HackerNewsStory = {
    id?: number;
    by?: string;
    title?: string;
    url?: string;
    time?: number;
    score?: number;
    descendants?: number;
    type?: string;
};

type TodayNewsItem = {
    id: string;
    title: string;
    url: string;
    source: string;
    author: string;
    publishedAt: string;
    score: number;
    comments: number;
};

const HN_NEW_STORIES_URL = "https://hacker-news.firebaseio.com/v0/newstories.json";
const HN_ITEM_URL_PREFIX = "https://hacker-news.firebaseio.com/v0/item";
const NEWS_REVALIDATE_SECONDS = 120;
const NEWS_CACHE_TTL_MS = 120_000;

type TodayNewsPayload = {
    success: true;
    items: TodayNewsItem[];
    meta: {
        source: string;
        fetchedAt: string;
        totalConsidered: number;
        cached?: boolean;
    };
};

const newsCache = new Map<string, { expiresAt: number; payload: TodayNewsPayload }>();

function parseLimit(value: string | null) {
    const parsed = Number(value || "6");
    if (!Number.isFinite(parsed)) return 6;
    return Math.max(4, Math.min(12, Math.trunc(parsed)));
}

function clampCount(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.trunc(parsed);
}

function readSource(url: string) {
    try {
        const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        return host || "news.ycombinator.com";
    } catch {
        return "news.ycombinator.com";
    }
}

function toIso(value: unknown) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
    return new Date(Math.trunc(seconds) * 1000).toISOString();
}

async function fetchStory(id: number, force: boolean): Promise<TodayNewsItem | null> {
    const response = await fetch(
        `${HN_ITEM_URL_PREFIX}/${encodeURIComponent(String(id))}.json`,
        force ? { cache: "no-store" } : { next: { revalidate: NEWS_REVALIDATE_SECONDS } },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as HackerNewsStory;
    if (payload?.type !== "story") return null;
    if (typeof payload.title !== "string" || !payload.title.trim()) return null;

    const safeUrl = typeof payload.url === "string" && payload.url.trim()
        ? payload.url.trim()
        : `https://news.ycombinator.com/item?id=${encodeURIComponent(String(id))}`;

    return {
        id: String(payload.id || id),
        title: payload.title.trim(),
        url: safeUrl,
        source: readSource(safeUrl),
        author: typeof payload.by === "string" && payload.by.trim() ? payload.by.trim() : "hn-user",
        publishedAt: toIso(payload.time),
        score: clampCount(payload.score),
        comments: clampCount(payload.descendants),
    };
}

export async function GET(request: NextRequest) {
    try {
        await requireUser(request);

        const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
        const force = request.nextUrl.searchParams.get("force") === "1";
        const cacheKey = `limit:${limit}`;

        if (!force) {
            const cached = newsCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return NextResponse.json({
                    ...cached.payload,
                    meta: {
                        ...cached.payload.meta,
                        cached: true,
                    },
                });
            }
        }

        const latestStoriesResponse = await fetch(
            HN_NEW_STORIES_URL,
            force ? { cache: "no-store" } : { next: { revalidate: NEWS_REVALIDATE_SECONDS } },
        );
        if (!latestStoriesResponse.ok) {
            return NextResponse.json({ error: "Failed to fetch news headlines" }, { status: 502 });
        }

        const payload = (await latestStoriesResponse.json()) as unknown;
        const allIds = Array.isArray(payload)
            ? payload.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
            : [];

        if (allIds.length === 0) {
            const responseBody: TodayNewsPayload = {
                success: true,
                items: [],
                meta: {
                    source: "hacker-news-latest",
                    fetchedAt: new Date().toISOString(),
                    totalConsidered: 0,
                },
            };

            newsCache.set(cacheKey, {
                expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
                payload: responseBody,
            });

            return NextResponse.json(responseBody);
        }

        const candidates = allIds.slice(0, Math.max(limit * 4, 28));
        const stories = await Promise.all(candidates.map((id) => fetchStory(id, force)));
        const items = stories
            .filter((item): item is TodayNewsItem => Boolean(item))
            .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
            .slice(0, limit);

        const responseBody: TodayNewsPayload = {
            success: true,
            items,
            meta: {
                source: "hacker-news-latest",
                fetchedAt: new Date().toISOString(),
                totalConsidered: candidates.length,
            },
        };

        newsCache.set(cacheKey, {
            expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
            payload: responseBody,
        });

        return NextResponse.json(responseBody);
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to load today news";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}