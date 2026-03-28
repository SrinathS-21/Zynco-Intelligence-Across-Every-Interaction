/**
 * Jira Action Executor
 * 
 * Creates a Jira task from an email via the Atlassian REST API.
 * Extracted from the monolithic actions.ts.
 */

import { ActionExecutor, ActionResult, EmailForAction } from '../action-registry';
import { createActivityLog, saveActivityLog } from '@/lib/activity-history';
import prisma from '@/lib/db';

export const jiraAction: ActionExecutor = {
    type: 'create_jira_task',
    name: 'Create Jira Task',

    async execute(
        email: EmailForAction,
        config: Record<string, any>,
        agentConfig: Record<string, any>,
    ): Promise<ActionResult> {
        if (!agentConfig.jira?.accessToken || !agentConfig.jira?.cloudId) {
            return {
                success: false,
                actionType: 'create_jira_task',
                message: 'Jira not connected',
            };
        }

        const projectKey = config.projectKey || agentConfig.jiraProjectKey;
        if (!projectKey) {
            return {
                success: false,
                actionType: 'create_jira_task',
                message: 'No Jira project configured',
            };
        }

        try {
            const jiraUrl = `https://api.atlassian.com/ex/jira/${agentConfig.jira.cloudId}/rest/api/3/issue`;

            // Clean email content for Jira
            const cleanBody = (email.body || email.snippet || '')
                .replace(/<[^>]*>/g, '')
                .substring(0, 1000);

            const response = await fetch(jiraUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${agentConfig.jira.accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    fields: {
                        project: { key: projectKey },
                        summary: `[Email] ${email.subject}`,
                        description: {
                            type: 'doc',
                            version: 1,
                            content: [
                                {
                                    type: 'paragraph',
                                    content: [
                                        { type: 'text', text: `From: ${email.from}` },
                                    ],
                                },
                                {
                                    type: 'paragraph',
                                    content: [
                                        { type: 'text', text: `Category: ${email.category}` },
                                    ],
                                },
                                {
                                    type: 'paragraph',
                                    content: [
                                        { type: 'text', text: cleanBody },
                                    ],
                                },
                            ],
                        },
                        issuetype: { name: config.issueType || 'Task' },
                    },
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('[JiraAction] API error:', error);
                return {
                    success: false,
                    actionType: 'create_jira_task',
                    message: `Failed to create Jira task: ${response.status}`,
                };
            }

            const data = await response.json();
            const issueUrl = `https://${agentConfig.jira.cloudId}.atlassian.net/browse/${data.key}`;

            console.log('[JiraAction] Created task:', data.key);

            // Log activity
            const log = createActivityLog(
                'jira_task',
                `Jira Task Created (Auto): ${data.key}`,
                `Automation rule applied to email "${email.subject}"`,
                'success',
                { tool: 'jira', taskKey: data.key, emailSubject: email.subject },
            );
            await saveActivityLog(prisma, agentConfig.agentId, log);

            return {
                success: true,
                actionType: 'create_jira_task',
                message: `Created Jira task: ${data.key}`,
                data: {
                    id: data.key,
                    url: issueUrl,
                },
            };
        } catch (error) {
            console.error('[JiraAction] Error:', error);
            return {
                success: false,
                actionType: 'create_jira_task',
                message: `Jira action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    },
};
