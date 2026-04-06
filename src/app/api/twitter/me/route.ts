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
    fetchRapidProfileByUsername,
    getTwitterReadProviderMode,
    resolveConnectedTwitterUsername,
} from "@/lib/twitter/rapidapi-client";

async function readProfileFromRapidApi(userId: string) {
    const agent = await getOrCreateDefaultAgent(userId);
    const config = getConfig(agent);
    const username = resolveConnectedTwitterUsername(config);

    if (!username) {
        return NextResponse.json(
            { error: "Twitter account is not connected. Connect Twitter first." },
            { status: 400 },
        );
    }

    const rapid = await fetchRapidProfileByUsername(username);
    if (!rapid.ok || !rapid.profile) {
        return NextResponse.json(
            { error: rapid.error || "Failed to load Twitter profile via RapidAPI" },
            { status: rapid.status || 500 },
        );
    }

    return NextResponse.json({
        success: true,
        profile: rapid.profile,
        provider: {
            mode: "rapidapi",
            host: rapid.provider,
            route: rapid.route,
        },
        token: {
            healthy: false,
            refreshedOnRequest: false,
            source: "rapidapi",
        },
    });
}

export async function GET(request: NextRequest) {
    const readMode = getTwitterReadProviderMode();

    try {
        const user = await requireUser(request);

        if (readMode === "rapidapi") {
            return readProfileFromRapidApi(user.id);
        }

        const context = await loadTwitterAuthContext(user.id);

        const { context: withActor } = await ensureTwitterActorId(context);
        const meCall = await xRequestWithAutoRefresh(withActor, {
            method: "GET",
            path: "/users/me",
            query: {
                "user.fields": "id,name,username,profile_image_url,public_metrics,verified,description",
            },
        });

        if (!meCall.response.ok) {
            if (readMode === "auto" && (meCall.status === 401 || meCall.status === 403 || meCall.status === 429)) {
                return readProfileFromRapidApi(user.id);
            }

            return NextResponse.json(
                { error: extractXError(meCall.data, "Failed to load Twitter profile") },
                { status: meCall.status },
            );
        }

        const data =
            meCall.data && typeof meCall.data === "object"
                ? ((meCall.data as Record<string, unknown>).data as Record<string, unknown> | undefined)
                : undefined;

        return NextResponse.json({
            success: true,
            profile: data || null,
            provider: {
                mode: "official",
                host: "api.x.com",
                route: "/users/me",
            },
            token: {
                healthy: true,
                refreshedOnRequest: withActor.accessToken !== context.accessToken,
                source: "official",
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await requireUser(request).catch(() => null);
        if (readMode === "auto" && user) {
            return readProfileFromRapidApi(user.id);
        }

        const message = error instanceof Error ? error.message : "Failed to load Twitter profile";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
