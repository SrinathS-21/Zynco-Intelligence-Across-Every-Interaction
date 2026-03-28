import { fetchWithRetry } from "@/lib/api-utils";

const JIRA_AUTH_URL = "https://auth.atlassian.com/authorize";
const JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const JIRA_API_BASE = "https://api.atlassian.com";
const JIRA_RESOURCES_URL = `${JIRA_API_BASE}/oauth/token/accessible-resources`;

// Required scopes for Jira integration
export const JIRA_SCOPES = [
    "read:jira-work",
    "write:jira-work",
    "read:jira-user",
    "read:me",
    "offline_access",
].join(" ");

/**
 * Generate Jira OAuth authorization URL
 */
export function getJiraAuthUrl(state: string): string {
    const clientId = process.env.JIRA_CLIENT_ID;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/standalone-agents/gmail-classifier/jira-callback`;

    if (!clientId) {
        throw new Error("JIRA_CLIENT_ID not configured");
    }

    const authUrl = new URL(JIRA_AUTH_URL);
    authUrl.searchParams.set("audience", "api.atlassian.com");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", JIRA_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("prompt", "consent");

    return authUrl.toString();
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(code: string) {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/standalone-agents/gmail-classifier/jira-callback`;

    if (!clientId || !clientSecret) {
        throw new Error("JIRA_CLIENT_ID and JIRA_CLIENT_SECRET not configured");
    }

    const response = await fetchWithRetry(JIRA_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        scope: data.scope,
    };
}

/**
 * Get accessible Jira resources (sites/cloud IDs)
 */
export async function getAccessibleResources(accessToken: string) {
    const response = await fetchWithRetry(JIRA_RESOURCES_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get accessible resources: ${error}`);
    }

    return response.json();
}

/**
 * Refresh Jira access token using refresh token
 */
export async function refreshJiraToken(refreshToken: string) {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("JIRA_CLIENT_ID and JIRA_CLIENT_SECRET not configured");
    }

    const response = await fetchWithRetry(JIRA_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Jira may return new refresh token
        expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        scope: data.scope,
    };
}

/**
 * Check if token is expired (with 5 minute buffer)
 */
export function isTokenExpired(expiresAt: string | undefined): boolean {
    if (!expiresAt) return true;

    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

    return now >= (expiryTime - bufferMs);
}

