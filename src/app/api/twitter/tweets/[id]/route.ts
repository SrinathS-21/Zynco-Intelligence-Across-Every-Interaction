import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
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

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        const tweetId = readId(id);
        if (!tweetId) {
            return NextResponse.json({ error: "tweet id is required" }, { status: 400 });
        }

        const user = await requireUser(request);
        const context = await loadTwitterAuthContext(user.id);

        const tweetCall = await xRequestWithAutoRefresh(context, {
            method: "GET",
            path: `/tweets/${encodeURIComponent(tweetId)}`,
            query: {
                "tweet.fields": "created_at,public_metrics,conversation_id,in_reply_to_user_id,lang,author_id",
            },
        });

        if (!tweetCall.response.ok) {
            return NextResponse.json(
                { error: extractXError(tweetCall.data, "Failed to load tweet") },
                { status: tweetCall.status },
            );
        }

        const payload = tweetCall.data as Record<string, unknown> | null;

        return NextResponse.json({
            success: true,
            data: payload?.data || null,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to load tweet";
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

        const deleteCall = await xRequestWithAutoRefresh(context, {
            method: "DELETE",
            path: `/tweets/${encodeURIComponent(tweetId)}`,
        });

        if (!deleteCall.response.ok) {
            return NextResponse.json(
                { error: extractXError(deleteCall.data, "Failed to delete tweet") },
                { status: deleteCall.status },
            );
        }

        const payload = deleteCall.data as Record<string, unknown> | null;
        const deleted =
            payload && typeof payload.data === "object" && payload.data !== null
                ? Boolean((payload.data as Record<string, unknown>).deleted)
                : true;

        return NextResponse.json({
            success: deleted,
            deleted,
            tweetId,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to delete tweet";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
