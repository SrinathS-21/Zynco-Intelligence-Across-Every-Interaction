import { createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const OAUTH_COOKIE_NAME = "zynco_twitter_oauth";

type OAuthCookiePayload = {
    state: string;
    codeVerifier: string;
    userId: string;
    createdAt: number;
};

function resolveBaseUrl(request: NextRequest): string {
    const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXTAUTH_URL;
    if (configured) {
        return configured.replace(/\/$/, "");
    }

    const url = request.nextUrl;
    return `${url.protocol}//${url.host}`;
}

function resolveCallbackUrl(request: NextRequest): string {
    const configured = process.env.TWITTER_OAUTH_CALLBACK_URL;
    if (configured) {
        return configured.replace(/['"]/g, "").trim();
    }

    return `${resolveBaseUrl(request)}/api/twitter/callback`;
}

function resolveScopes(): string {
    const configured = process.env.TWITTER_OAUTH_SCOPES;
    if (configured && configured.trim()) {
        return configured.trim().replace(/\s+/g, " ");
    }
    return "tweet.read users.read tweet.write offline.access";
}

function createCodeVerifier() {
    return Buffer.from(randomBytes(48)).toString("base64url");
}

function createCodeChallenge(codeVerifier: string) {
    return createHash("sha256").update(codeVerifier).digest("base64url");
}

function redirectFailure(request: NextRequest, message: string) {
    const baseUrl = resolveBaseUrl(request);
    const url = new URL(`${baseUrl}/dashboard/unified`);
    url.searchParams.set("connect", "failure");
    url.searchParams.set("platform", "twitter");
    url.searchParams.set("error", message);
    return NextResponse.redirect(url.toString());
}

export async function GET(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const clientId = (process.env.TWITTER_CLIENT_ID || "").replace(/['"]/g, "").trim();

        if (!clientId) {
            return redirectFailure(request, "TWITTER_CLIENT_ID is not configured");
        }

        const callbackUrl = resolveCallbackUrl(request);
        const state = randomBytes(24).toString("hex");
        const codeVerifier = createCodeVerifier();
        const codeChallenge = createCodeChallenge(codeVerifier);

        const params = new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: callbackUrl,
            scope: resolveScopes(),
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        });

        const oauthPayload: OAuthCookiePayload = {
            state,
            codeVerifier,
            userId: user.id,
            createdAt: Date.now(),
        };

        const response = NextResponse.redirect(`${X_AUTHORIZE_URL}?${params.toString()}`);
        response.cookies.set(OAUTH_COOKIE_NAME, Buffer.from(JSON.stringify(oauthPayload)).toString("base64url"), {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 10,
        });

        return response;
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            const baseUrl = resolveBaseUrl(request);
            return NextResponse.redirect(`${baseUrl}/login`);
        }

        return redirectFailure(request, "Failed to start Twitter OAuth");
    }
}
