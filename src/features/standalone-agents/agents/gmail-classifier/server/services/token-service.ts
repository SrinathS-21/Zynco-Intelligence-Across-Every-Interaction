import prisma from "@/lib/db";
import { refreshGmailTokenWithLock, refreshJiraTokenWithLock } from "@/lib/security/token-refresh";
import { isTokenExpired as isJiraTokenExpired } from "@/lib/jira/oauth";

/**
 * Ensures a valid access token is available for the given integration.
 * If expired, it handles refreshing the token and updating the agent config.
 */
export async function getValidToken(agentId: string, provider: 'gmail' | 'jira') {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId },
    });

    if (!agent) throw new Error("Agent not found");
    const config = agent.config as any;

    if (provider === 'gmail') {
        let accessToken = config?.accessToken;
        const refreshToken = config?.refreshToken;
        const expiresAt = config?.tokenExpiresAt;

        // Check if token is expired or expires in next 60 seconds
        const isExpired = !expiresAt || new Date(expiresAt).getTime() < Date.now() + 60000;

        if (isExpired && refreshToken) {
            try {
                // The lock version handles the DB update internally now
                const newTokens = await refreshGmailTokenWithLock(agentId, refreshToken);
                return newTokens.access_token;
            } catch (error) {
                console.error("[TokenService] Failed to refresh Gmail token:", error);
                return accessToken;
            }
        }
        return accessToken;
    }

    if (provider === 'jira') {
        const jira = config?.jira;
        if (!jira?.accessToken || !jira?.refreshToken) return null;

        if (isJiraTokenExpired(jira.expiresAt)) {
            try {
                // The lock version handles the DB update internally now
                const newTokens = await refreshJiraTokenWithLock(agentId, jira.refreshToken);
                return newTokens.accessToken;
            } catch (error) {
                console.error("[TokenService] Failed to refresh Jira token:", error);
                return jira.accessToken;
            }
        }
        return jira.accessToken;
    }

    return null;
}

/**
 * Legacy wrapper for Gmail
 */
export async function getValidAccessToken(agentId: string) {
    return getValidToken(agentId, 'gmail');
}

/**
 * Helper to update agent config without overwriting other keys
 */
async function updateAgentConfig(agentId: string, currentConfig: any, updates: any) {
    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...currentConfig,
                ...updates,
            },
        },
    });
}
