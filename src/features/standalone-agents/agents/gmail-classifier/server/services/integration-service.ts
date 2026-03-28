import prisma from "@/lib/db";
import { refreshJiraToken, isTokenExpired } from "@/lib/jira/oauth";

export async function getJiraProjects(agentId: string, userId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    const jiraCredentials = agentConfig?.jira;
    const { getValidToken } = await import("./token-service");
    const accessToken = await getValidToken(agentId, 'jira');

    if (!accessToken || !jiraCredentials?.cloudId) {
        throw new Error("Jira not connected or token expired");
    }

    const baseUrl = `https://api.atlassian.com/ex/jira/${jiraCredentials.cloudId}/rest/api/3`;
    let allProjects: any[] = [];
    let startAt = 0;
    let isLast = false;

    while (!isLast && allProjects.length < 1000) {
        const response = await fetch(`${baseUrl}/project/search?startAt=${startAt}&maxResults=50`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Jira API] ${response.status} Error:`, errorText);

            // If it's a scope error, throw a descriptive one
            if (response.status === 403 && (errorText.includes("scope") || errorText.includes("permission"))) {
                throw new Error("Insufficient Jira permissions. Please try reconnecting Jira.");
            }
            throw new Error(`Jira API Error: ${response.status}`);
        }

        const data = await response.json();
        allProjects = [...allProjects, ...(data.values || [])];

        if (data.isLast || !data.values || data.values.length === 0) {
            isLast = true;
        } else {
            startAt += data.values.length;
        }
    }

    return allProjects.map((p: any) => ({
        key: p.key,
        name: p.name,
        avatarUrl: p.avatarUrls?.["48x48"] || null,
        projectTypeKey: p.projectTypeKey,
    }));
}

export async function getNotionDatabases(agentId: string, userId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    const notionToken = agentConfig?.notion?.accessToken;

    if (!notionToken) throw new Error("Notion not connected");

    const response = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${notionToken}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            filter: { property: "object", value: "database" },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Notion API] ${response.status} Error:`, errorText);
        throw new Error("Failed to fetch Notion databases");
    }

    const data = await response.json();
    return (data.results || []).map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || "Untitled",
        icon: db.icon?.emoji || null,
        url: db.url,
    }));
}

export async function getSlackChannels(agentId: string, userId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    const slackToken = agentConfig?.slack?.accessToken;

    if (!slackToken) throw new Error("Slack not connected");

    const response = await fetch("https://slack.com/api/conversations.list?types=public_channel", {
        headers: { Authorization: `Bearer ${slackToken}` },
    });

    const data = await response.json();
    if (!data.ok) {
        console.error("[Slack API] Error fetching channels:", data.error);
        if (data.error === 'missing_scope' || data.error === 'insufficient_scope') {
            throw new Error(`Insufficient Slack permissions (${data.needed || 'channels:read'}). Please try reconnecting Slack.`);
        }
        throw new Error(data.error || "Failed to fetch Slack channels");
    }

    return (data.channels || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
    }));
}
export async function createJiraTask(agentId: string, userId: string, email: any, projectKey: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    const jiraCredentials = agentConfig?.jira;

    const { getValidToken } = await import("./token-service");
    const accessToken = await getValidToken(agentId, 'jira');

    if (!accessToken || !jiraCredentials?.cloudId) {
        throw new Error("Jira not connected or token expired");
    }

    const { createJiraTaskFromEmail } = await import("@/lib/email-agent/jira-automation");
    const result = await createJiraTaskFromEmail(
        email,
        {
            accessToken: accessToken,
            cloudId: jiraCredentials.cloudId,
        },
        {
            projectKey,
            issueType: "Task",
            priority: email.priority === "high" || email.priority === "critical" ? "High" : "Medium",
        }
    );

    if (!result.success) {
        throw new Error(result.error || "Failed to create Jira task");
    }

    // Activity log
    const { createActivityLog, saveActivityLog } = await import("@/lib/activity-history");
    const log = createActivityLog(
        'jira_task',
        `Jira Task Created: ${result.issueKey}`,
        `Created from email: "${email.subject}"`,
        'success',
        { tool: 'jira', taskKey: result.issueKey, emailSubject: email.subject }
    );
    await saveActivityLog(prisma, agentId, log);

    return {
        success: true,
        issueKey: result.issueKey,
        issueUrl: `${jiraCredentials.siteUrl}/browse/${result.issueKey}`,
    };
}

export async function sendSlackMessage(agentId: string, userId: string, email: any, channelId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    const slackCredentials = agentConfig?.slack;

    if (!slackCredentials?.accessToken) {
        throw new Error("Slack not connected");
    }

    const blocks = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "📧 Manual Email Notification"
            }
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: `*From:*\n${email.from}`
                },
                {
                    type: "mrkdwn",
                    text: `*Subject:*\n${email.subject}`
                }
            ]
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Snippet:*\n${email.snippet || "No snippet available"}`
            }
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `Priority: ${email.priority || "Normal"} | Category: ${email.category || "Uncategorized"}`
                }
            ]
        }
    ];

    const { sendSlackMessage: slackApiSend } = await import("@/lib/slack/api");
    const response = await slackApiSend(
        slackCredentials.accessToken,
        channelId,
        `Email notification: ${email.subject}`,
        blocks
    );

    if (!response.ok) {
        throw new Error(response.error || "Failed to send Slack message");
    }

    // Activity log
    const { createActivityLog, saveActivityLog } = await import("@/lib/activity-history");
    const log = createActivityLog(
        'automation',
        'Slack Message Sent (Manual)',
        `Sent notification to channel for email "${email.subject}"`,
        'success',
        { tool: 'slack', emailSubject: email.subject }
    );
    await saveActivityLog(prisma, agentId, log);

    return { success: true };
}
