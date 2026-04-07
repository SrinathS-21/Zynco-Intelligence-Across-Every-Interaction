import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConfig, getData, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { AgentConfig } from "@/lib/types";

const OAUTH_COOKIE_NAME = "zynco_twitter_oauth";
const X_TOKEN_URLS = ["https://api.x.com/2/oauth2/token", "https://api.twitter.com/2/oauth2/token"];
const X_ME_URLS = [
    "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url",
    "https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url",
];

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

function dashboardRedirect(
    request: NextRequest,
    options: { status: "success" | "failure"; error?: string; accountId?: string; username?: string; displayName?: string },
) {
    const baseUrl = resolveBaseUrl(request);
    const url = new URL(`${baseUrl}/dashboard/unified`);
    url.searchParams.set("connect", options.status);
    url.searchParams.set("platform", "twitter");

    if (options.accountId) {
        url.searchParams.set("accountId", options.accountId);
        url.searchParams.set("account_id", options.accountId);
    }

    if (options.username) {
        url.searchParams.set("username", options.username);
    }

    if (options.displayName) {
        url.searchParams.set("displayName", options.displayName);
    }

    if (options.error) {
        url.searchParams.set("error", options.error);
    }

    const response = NextResponse.redirect(url.toString());
    response.cookies.set(OAUTH_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: new Date(0),
    });

    return response;
}

function safeErrorDetail(payload: unknown): string {
    if (!payload || typeof payload !== "object") {
        return "Twitter OAuth request failed";
    }

    const obj = payload as Record<string, unknown>;
    const detail =
        (typeof obj.error_description === "string" && obj.error_description) ||
        (typeof obj.detail === "string" && obj.detail) ||
        (typeof obj.error === "string" && obj.error) ||
        (typeof obj.title === "string" && obj.title) ||
        "Twitter OAuth request failed";

    return detail.slice(0, 180);
}

async function readJson(response: Response) {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

function formatOAuthError(payload: unknown): string {
    const detail = safeErrorDetail(payload);
    if (/attached to (a )?project/i.test(detail)) {
        return "Twitter app is not attached to an X Project, or env credentials are from a different app/project.";
    }
    return detail;
}

type TokenAttempt = {
    headers: Record<string, string>;
    body: string;
};

function buildTokenAttempts(basePayload: URLSearchParams, clientId: string, clientSecret: string): TokenAttempt[] {
    const attempts: TokenAttempt[] = [];

    if (clientSecret) {
        attempts.push({
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            },
            body: basePayload.toString(),
        });
    }

    if (clientSecret) {
        const bodyWithSecret = new URLSearchParams(basePayload);
        bodyWithSecret.set("client_secret", clientSecret);
        attempts.push({
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: bodyWithSecret.toString(),
        });
    }

    attempts.push({
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: basePayload.toString(),
    });

    return attempts;
}

export async function GET(request: NextRequest) {
    try {
        const oauthError = request.nextUrl.searchParams.get("error");
        if (oauthError) {
            const description = request.nextUrl.searchParams.get("error_description") || oauthError;
            return dashboardRedirect(request, { status: "failure", error: description });
        }

        const code = request.nextUrl.searchParams.get("code") || "";
        const state = request.nextUrl.searchParams.get("state") || "";

        if (!code || !state) {
            return dashboardRedirect(request, { status: "failure", error: "Missing OAuth code or state" });
        }

        const encodedPayload = request.cookies.get(OAUTH_COOKIE_NAME)?.value;
        if (!encodedPayload) {
            return dashboardRedirect(request, { status: "failure", error: "OAuth session expired. Retry connection." });
        }

        let oauthPayload: OAuthCookiePayload;
        try {
            oauthPayload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as OAuthCookiePayload;
        } catch {
            return dashboardRedirect(request, { status: "failure", error: "Invalid OAuth session payload" });
        }

        if (!oauthPayload.state || oauthPayload.state !== state) {
            return dashboardRedirect(request, { status: "failure", error: "OAuth state mismatch" });
        }

        if (Date.now() - Number(oauthPayload.createdAt || 0) > 10 * 60 * 1000) {
            return dashboardRedirect(request, { status: "failure", error: "OAuth session expired. Retry connection." });
        }

        const user = await requireUser(request).catch(() => null);
        if (!user) {
            const baseUrl = resolveBaseUrl(request);
            return NextResponse.redirect(`${baseUrl}/login`);
        }

        if (oauthPayload.userId !== user.id) {
            return dashboardRedirect(request, { status: "failure", error: "OAuth session belongs to another user" });
        }

        const clientId = (process.env.TWITTER_CLIENT_ID || "").replace(/['"]/g, "").trim();
        const clientSecret = (process.env.TWITTER_CLIENT_SECRET || "").replace(/['"]/g, "").trim();

        if (!clientId) {
            return dashboardRedirect(request, { status: "failure", error: "TWITTER_CLIENT_ID is not configured" });
        }

        const tokenPayload = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: resolveCallbackUrl(request),
            client_id: clientId,
            code_verifier: oauthPayload.codeVerifier,
        });

        const tokenAttempts = buildTokenAttempts(tokenPayload, clientId, clientSecret);
        let tokenJson: unknown = null;
        let tokenResponse: Response | null = null;

        for (const tokenUrl of X_TOKEN_URLS) {
            for (const attempt of tokenAttempts) {
                const currentResponse = await fetch(tokenUrl, {
                    method: "POST",
                    headers: attempt.headers,
                    body: attempt.body,
                });
                const currentJson = await readJson(currentResponse);

                tokenResponse = currentResponse;
                tokenJson = currentJson;

                if (currentResponse.ok) {
                    break;
                }
            }

            if (tokenResponse?.ok) {
                break;
            }
        }

        if (!tokenResponse || !tokenResponse.ok) {
            return dashboardRedirect(request, {
                status: "failure",
                error: formatOAuthError(tokenJson),
            });
        }

        const accessToken =
            tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).access_token === "string"
                ? String((tokenJson as Record<string, unknown>).access_token)
                : "";

        const refreshToken =
            tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).refresh_token === "string"
                ? String((tokenJson as Record<string, unknown>).refresh_token)
                : "";

        const tokenType =
            tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).token_type === "string"
                ? String((tokenJson as Record<string, unknown>).token_type)
                : "Bearer";

        const tokenScope =
            tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).scope === "string"
                ? String((tokenJson as Record<string, unknown>).scope)
                : "";

        const expiresInSeconds =
            tokenJson && typeof tokenJson === "object" && typeof (tokenJson as Record<string, unknown>).expires_in === "number"
                ? Number((tokenJson as Record<string, unknown>).expires_in)
                : null;

        const oauthExpiresAt =
            typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds)
                ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
                : null;

        if (!accessToken) {
            return dashboardRedirect(request, { status: "failure", error: "Access token not returned by X" });
        }

        let profileJson: unknown = null;
        let profileResponse: Response | null = null;

        for (const meUrl of X_ME_URLS) {
            const currentResponse = await fetch(meUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
            });
            const currentJson = await readJson(currentResponse);

            profileResponse = currentResponse;
            profileJson = currentJson;

            if (currentResponse.ok) {
                break;
            }
        }

        if (!profileResponse || !profileResponse.ok) {
            return dashboardRedirect(request, {
                status: "failure",
                error: formatOAuthError(profileJson),
            });
        }

        const profileData =
            profileJson && typeof profileJson === "object" && profileJson !== null
                ? (profileJson as Record<string, unknown>).data
                : null;

        const username =
            profileData && typeof profileData === "object" && typeof (profileData as Record<string, unknown>).username === "string"
                ? String((profileData as Record<string, unknown>).username).replace(/^@+/, "").trim()
                : "";

        const displayName =
            profileData && typeof profileData === "object" && typeof (profileData as Record<string, unknown>).name === "string"
                ? String((profileData as Record<string, unknown>).name).trim()
                : "";

        const avatarUrl =
            profileData && typeof profileData === "object" && typeof (profileData as Record<string, unknown>).profile_image_url === "string"
                ? String((profileData as Record<string, unknown>).profile_image_url).trim()
                : "";

        const externalUserId =
            profileData && typeof profileData === "object" && typeof (profileData as Record<string, unknown>).id === "string"
                ? String((profileData as Record<string, unknown>).id).trim()
                : "";

        if (!username || !displayName || !externalUserId) {
            return dashboardRedirect(request, {
                status: "failure",
                error: "Twitter OAuth did not return complete profile identity. Please reconnect and approve access.",
            });
        }

        try {
            const agent = await getOrCreateDefaultAgent(user.id);
            const currentConfig = getConfig(agent);
            const currentData = getData(agent);
            const normalizedUsername = username.replace(/^@+/, "").trim();

            const nextConfig: AgentConfig = {
                ...currentConfig,
                socialConnections: {
                    instagram: { ...(currentConfig.socialConnections?.instagram || {}) },
                    linkedin: { ...(currentConfig.socialConnections?.linkedin || {}) },
                    twitter: {
                        ...(currentConfig.socialConnections?.twitter || {}),
                        accountId: normalizedUsername,
                        username: normalizedUsername,
                        displayName,
                        avatarUrl: avatarUrl || null,
                        externalUserId,
                        oauthAccessToken: accessToken,
                        oauthRefreshToken: refreshToken || undefined,
                        oauthTokenType: tokenType || "Bearer",
                        oauthScope: tokenScope || undefined,
                        oauthExpiresAt,
                        connectedAt: new Date().toISOString(),
                        disconnectedAt: null,
                        status: "connected",
                    },
                },
                socialOnboardingCompleted: true,
            };

            await prisma.agent.update({
                where: { id: agent.id },
                data: {
                    config: nextConfig as any,
                    data: currentData as any,
                },
            });
        } catch {
            return dashboardRedirect(request, {
                status: "failure",
                error: "Connected to X, but failed to persist connection state",
            });
        }

        return dashboardRedirect(request, {
            status: "success",
            accountId: username.replace(/^@+/, "").trim(),
            username: username.replace(/^@+/, "").trim(),
            displayName,
        });
    } catch {
        return dashboardRedirect(request, { status: "failure", error: "Twitter OAuth callback failed" });
    }
}
