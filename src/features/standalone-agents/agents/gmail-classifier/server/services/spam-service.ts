import prisma from "@/lib/db";
import { fetchGmailEmails } from "@/lib/gmail/client";
import { refreshAccessToken } from "@/lib/gmail/oauth";

export async function fetchAgentSpam(agentId: string, userId: string, count: number = 30) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    let accessToken = agentConfig?.accessToken;

    if (!accessToken) throw new Error("Gmail not connected");

    let spamEmails: any[] = [];
    try {
        const result = await fetchGmailEmails(accessToken, {
            maxResults: count,
            labelIds: ["SPAM"],
        });
        spamEmails = result.emails;
    } catch (error: any) {
        if (error.code === 401 || (error.message && error.message.includes("401"))) {
            const refreshToken = agentConfig?.refreshToken;
            if (!refreshToken) throw new Error("Gmail authentication expired");

            const newTokens = await refreshAccessToken(refreshToken);
            accessToken = newTokens.access_token;

            await prisma.standaloneAgent.update({
                where: { id: agentId },
                data: {
                    config: {
                        ...agentConfig,
                        accessToken: newTokens.access_token,
                        tokenExpiresAt: newTokens.expires_in
                            ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
                            : agentConfig.tokenExpiresAt
                    }
                }
            });

            const result = await fetchGmailEmails(accessToken, {
                maxResults: count,
                labelIds: ["SPAM"],
            });
            spamEmails = result.emails;
        } else {
            throw error;
        }
    }

    return spamEmails.map(email => ({
        id: email.id,
        threadId: email.threadId,
        subject: email.subject,
        from: email.from,
        date: email.date,
        snippet: email.snippet,
        body: email.body?.substring(0, 500),
    }));
}

export async function rescueAgentEmail(agentId: string, userId: string, emailId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    let accessToken = agentConfig?.accessToken;

    if (!accessToken) throw new Error("Gmail not connected");

    const modifyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`;

    const response = await fetch(modifyUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            addLabelIds: ['INBOX'],
            removeLabelIds: ['SPAM'],
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to move email");
    }

    return { success: true };
}
