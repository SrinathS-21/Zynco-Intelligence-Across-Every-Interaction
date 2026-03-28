/**
 * Jira Automation Service
 * Automatically creates Jira tasks from high-priority emails
 */

import ky from "ky";

interface EmailData {
    id: string;
    subject: string;
    from: string;
    snippet?: string;
    category: string;
    priority: string;
    date: string;
}

interface JiraCredentials {
    accessToken: string;
    cloudId: string;
    refreshToken?: string;
}

interface JiraTaskConfig {
    projectKey: string;
    issueType: string;
    priority?: string;
    labels?: string[];
}

interface CreateTaskResult {
    success: boolean;
    issueKey?: string;
    issueUrl?: string;
    error?: string;
}

/**
 * Check if an email should trigger Jira task creation
 */
export function shouldCreateJiraTask(
    email: EmailData,
    settings: {
        autoCreateForActionRequired?: boolean;
        autoCreateForHighPriority?: boolean;
    }
): boolean {
    // Check if action required emails should create tasks
    if (settings.autoCreateForActionRequired && email.category === "requires_action") {
        return true;
    }

    // Check if high priority emails should create tasks
    if (settings.autoCreateForHighPriority &&
        (email.priority === "high" || email.priority === "urgent" || email.priority === "critical")) {
        return true;
    }

    return false;
}

/**
 * Format email content for Jira task description
 */
export function formatEmailAsJiraDescription(email: EmailData): string {
    const parts = [
        `*From:* ${email.from}`,
        `*Date:* ${new Date(email.date).toLocaleString()}`,
        `*Category:* ${email.category}`,
        `*Priority:* ${email.priority}`,
        "",
        "*Email Preview:*",
        email.snippet || "(No preview available)",
        "",
        `_Auto-created by SpinaBOT Email Assistant_`,
    ];

    return parts.join("\n");
}

/**
 * Create a Jira task using OAuth credentials
 */
export async function createJiraTaskFromEmail(
    email: EmailData,
    credentials: JiraCredentials,
    config: JiraTaskConfig
): Promise<CreateTaskResult> {
    try {
        const baseUrl = `https://api.atlassian.com/ex/jira/${credentials.cloudId}/rest/api/3`;

        // Build the request body
        const body = {
            fields: {
                project: { key: config.projectKey },
                summary: `📧 ${email.subject}`,
                issuetype: { name: config.issueType || "Task" },
                description: {
                    type: "doc",
                    version: 1,
                    content: [
                        {
                            type: "paragraph",
                            content: [
                                {
                                    type: "text",
                                    text: formatEmailAsJiraDescription(email),
                                },
                            ],
                        },
                    ],
                },
                ...(config.priority && { priority: { name: config.priority } }),
                ...(config.labels && config.labels.length > 0 && { labels: config.labels }),
            },
        };

        const response = await ky.post(`${baseUrl}/issue`, {
            headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
                "Content-Type": "application/json",
            },
            json: body,
        }).json<{ id: string; key: string; self: string }>();

        // Build the issue URL
        const issueUrl = `https://${credentials.cloudId}.atlassian.net/browse/${response.key}`;

        return {
            success: true,
            issueKey: response.key,
            issueUrl,
        };
    } catch (error) {
        console.error("[Jira Automation] Failed to create task:", error);

        let errorMessage = "Unknown error";
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        // Try to extract more details from ky error
        if (error && typeof error === "object" && "response" in error) {
            try {
                const response = (error as { response: Response }).response;
                const errorBody = await response.text();
                errorMessage = `API Error (${response.status}): ${errorBody}`;
            } catch {
                // Use default error message
            }
        }

        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Get Jira projects (for settings dropdown)
 */
export async function getJiraProjects(
    credentials: JiraCredentials
): Promise<{ key: string; name: string }[]> {
    try {
        const baseUrl = `https://api.atlassian.com/ex/jira/${credentials.cloudId}/rest/api/3`;

        const response = await ky.get(`${baseUrl}/project`, {
            headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
            },
        }).json<Array<{ key: string; name: string }>>();

        return response.map((p) => ({ key: p.key, name: p.name }));
    } catch (error) {
        console.error("[Jira Automation] Failed to get projects:", error);
        return [];
    }
}

/**
 * Batch create Jira tasks for multiple emails
 */
export async function createJiraTasksForEmails(
    emails: EmailData[],
    credentials: JiraCredentials,
    config: JiraTaskConfig,
    settings: {
        autoCreateForActionRequired?: boolean;
        autoCreateForHighPriority?: boolean;
    }
): Promise<{ created: number; failed: number; results: CreateTaskResult[] }> {
    const results: CreateTaskResult[] = [];
    let created = 0;
    let failed = 0;

    for (const email of emails) {
        if (shouldCreateJiraTask(email, settings)) {
            const result = await createJiraTaskFromEmail(email, credentials, config);
            results.push(result);

            if (result.success) {
                created++;
                console.log(`[Jira Automation] Created task ${result.issueKey} for email: ${email.subject}`);
            } else {
                failed++;
                console.error(`[Jira Automation] Failed to create task for email: ${email.subject}`, result.error);
            }

            // Small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }

    return { created, failed, results };
}
