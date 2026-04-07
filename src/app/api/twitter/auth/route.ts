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
    const forwardedProto = (request.headers.get("x-forwarded-proto") || "").trim();
    const forwardedHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").trim();
    const requestBaseUrl = forwardedHost
        ? `${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${forwardedHost}`
        : `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXTAUTH_URL;
    if (configured) {
        const sanitized = configured.replace(/\/$/, "");

        // On preview deployments, a fixed app URL can break OAuth cookie state if host differs.
        try {
            const configuredHost = new URL(sanitized).host;
            const requestHost = new URL(requestBaseUrl).host;
            if (configuredHost !== requestHost) {
                return requestBaseUrl.replace(/\/$/, "");
            }
        } catch {
            // Fall back to configured value if URL parsing fails.
        }

        return sanitized;
    }

    return requestBaseUrl.replace(/\/$/, "");
}

function resolveCallbackUrl(request: NextRequest): string {
    const configured = process.env.TWITTER_OAUTH_CALLBACK_URL;
    if (configured) {
        const sanitized = configured.replace(/['"]/g, "").trim();
        const fallback = `${resolveBaseUrl(request)}/api/twitter/callback`;
        try {
            const configuredHost = new URL(sanitized).host;
            const fallbackHost = new URL(fallback).host;
            if (configuredHost !== fallbackHost) {
                return fallback;
            }
        } catch {
            return fallback;
        }
        return sanitized;
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

function maskClientId(value: string) {
    const trimmed = (value || "").trim();
    if (!trimmed) return "";
    if (trimmed.length <= 10) {
        return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
    }
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-6)}`;
}

export async function GET(request: NextRequest) {
    try {
        const debugMode = request.nextUrl.searchParams.get("debug") === "1";
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

        if (debugMode) {
            const authorizeUrl = `${X_AUTHORIZE_URL}?${params.toString()}`;
            return NextResponse.json({
                ok: true,
                debug: {
                    userId: user.id,
                    clientIdMasked: maskClientId(clientId),
                    effectiveBaseUrl: resolveBaseUrl(request),
                    effectiveCallbackUrl: callbackUrl,
                    configuredCallbackEnv: (process.env.TWITTER_OAUTH_CALLBACK_URL || "").replace(/['"]/g, "").trim(),
                    authorizeUrl,
                },
            });
        }

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
