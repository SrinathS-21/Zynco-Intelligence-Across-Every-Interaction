import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
    extractXError,
    loadTwitterAuthContext,
    xRequestWithAutoRefresh,
} from "@/lib/twitter/x-oauth-client";

type RouteContext = {
    params: Promise<{ id: string }>;
};

function readString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        const tweetId = readString(id);
        if (!tweetId) {
            return NextResponse.json({ error: "tweet id is required" }, { status: 400 });
        }

        const body = await request.json();
        const text = readString(body?.text);

        if (!text) {
            return NextResponse.json({ error: "text is required" }, { status: 400 });
        }

        const user = await requireUser(request);
        const context = await loadTwitterAuthContext(user.id);

        const replyCall = await xRequestWithAutoRefresh(context, {
            method: "POST",
            path: "/tweets",
            body: {
                text,
                reply: {
                    in_reply_to_tweet_id: tweetId,
                },
            },
        });

        if (!replyCall.response.ok) {
            return NextResponse.json(
                { error: extractXError(replyCall.data, "Failed to reply to tweet") },
                { status: replyCall.status },
            );
        }

        const payload = replyCall.data as Record<string, unknown> | null;
        const created =
            payload && typeof payload.data === "object" && payload.data !== null
                ? (payload.data as Record<string, unknown>)
                : null;

        const createdId = created && typeof created.id === "string" ? created.id : null;
        const username = context.username || "twitter-user";
        const replyUrl = createdId ? `https://x.com/${username}/status/${createdId}` : null;

        await prisma.unifiedMessage.create({
            data: {
                userId: user.id,
                platform: "twitter",
                contactId: "self",
                content: text,
                direction: "OUTBOUND",
                metadata: {
                    title: "Twitter Reply",
                    tweetId: createdId,
                    twitterUrn: createdId,
                    url: replyUrl,
                    replyToTweetId: tweetId,
                    status: "PUBLISHED",
                    provider: "x-oauth",
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: created,
            replyTo: tweetId,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to reply to tweet";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
