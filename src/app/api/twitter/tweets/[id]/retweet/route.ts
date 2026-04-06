import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
    ensureTwitterActorId,
    extractXError,
    loadTwitterAuthContext,
    xRequestWithAutoRefresh,
} from "@/lib/twitter/x-oauth-client";

type RouteContext = {
    params: Promise<{ id: string }>;
};

function readId(value: string) {
    return String(value || "").trim();
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        const tweetId = readId(id);
        if (!tweetId) {
            return NextResponse.json({ error: "tweet id is required" }, { status: 400 });
        }

        const user = await requireUser(request);
        const context = await loadTwitterAuthContext(user.id);
        const { context: actorContext, actorId } = await ensureTwitterActorId(context);

        const retweetCall = await xRequestWithAutoRefresh(actorContext, {
            method: "POST",
            path: `/users/${encodeURIComponent(actorId)}/retweets`,
            body: {
                tweet_id: tweetId,
            },
        });

        if (!retweetCall.response.ok) {
            return NextResponse.json(
                { error: extractXError(retweetCall.data, "Failed to retweet") },
                { status: retweetCall.status },
            );
        }

        return NextResponse.json({ success: true, retweeted: true, tweetId });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to retweet";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        const tweetId = readId(id);
        if (!tweetId) {
            return NextResponse.json({ error: "tweet id is required" }, { status: 400 });
        }

        const user = await requireUser(request);
        const context = await loadTwitterAuthContext(user.id);
        const { context: actorContext, actorId } = await ensureTwitterActorId(context);

        const unretweetCall = await xRequestWithAutoRefresh(actorContext, {
            method: "DELETE",
            path: `/users/${encodeURIComponent(actorId)}/retweets/${encodeURIComponent(tweetId)}`,
        });

        if (!unretweetCall.response.ok) {
            return NextResponse.json(
                { error: extractXError(unretweetCall.data, "Failed to unretweet") },
                { status: unretweetCall.status },
            );
        }

        return NextResponse.json({ success: true, retweeted: false, tweetId });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to unretweet";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
