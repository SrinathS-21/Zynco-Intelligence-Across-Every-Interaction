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

        const likeCall = await xRequestWithAutoRefresh(actorContext, {
            method: "POST",
            path: `/users/${encodeURIComponent(actorId)}/likes`,
            body: {
                tweet_id: tweetId,
            },
        });

        if (!likeCall.response.ok) {
            return NextResponse.json(
                { error: extractXError(likeCall.data, "Failed to like tweet") },
                { status: likeCall.status },
            );
        }

        return NextResponse.json({ success: true, liked: true, tweetId });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to like tweet";
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

        const unlikeCall = await xRequestWithAutoRefresh(actorContext, {
            method: "DELETE",
            path: `/users/${encodeURIComponent(actorId)}/likes/${encodeURIComponent(tweetId)}`,
        });

        if (!unlikeCall.response.ok) {
            return NextResponse.json(
                { error: extractXError(unlikeCall.data, "Failed to unlike tweet") },
                { status: unlikeCall.status },
            );
        }

        return NextResponse.json({ success: true, liked: false, tweetId });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to unlike tweet";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
