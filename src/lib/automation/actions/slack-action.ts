/**
 * Slack Action Executor
 * 
 * Sends a formatted notification to a Slack channel about an email.
 * Extracted from the monolithic actions.ts.
 */

import { ActionExecutor, ActionResult, EmailForAction } from '../action-registry';
import { sendSlackMessage } from '@/lib/slack/api';
import { createActivityLog, saveActivityLog } from '@/lib/activity-history';
import prisma from '@/lib/db';

export const slackAction: ActionExecutor = {
    type: 'send_slack_message',
    name: 'Send Slack Message',

    async execute(
        email: EmailForAction,
        config: Record<string, any>,
        agentConfig: Record<string, any>,
    ): Promise<ActionResult> {
        try {
            if (!agentConfig.slack?.accessToken) {
                return {
                    success: false,
                    actionType: 'send_slack_message',
                    message: 'Slack not connected',
                };
            }

            // Fallback to agent-level default channel if rule-specific one is missing
            const effectiveChannel = config.slackChannelId || agentConfig.slackChannelId;

            if (!effectiveChannel) {
                return {
                    success: false,
                    actionType: 'send_slack_message',
                    message: 'No Slack channel configured (checked rule and agent defaults)',
                };
            }

            const snippet = email.snippet || email.body?.substring(0, 200) || "No preview available";

            // Format Slack blocks
            const blocks = [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "📧 New Important Email",
                    },
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*From:*\n${email.from}`,
                        },
                        {
                            type: "mrkdwn",
                            text: `*Subject:*\n${email.subject}`,
                        },
                    ],
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Snippet:*\n${snippet}`,
                    },
                },
                {
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: `Priority: ${email.priority} | Category: ${email.category}`,
                        },
                    ],
                },
            ];

            const response = await sendSlackMessage(
                agentConfig.slack.accessToken,
                effectiveChannel,
                `New email from ${email.from}: ${email.subject}`,
                blocks,
            );

            if (!response.ok) {
                // Log failure
                const log = createActivityLog(
                    'automation',
                    'Slack Notification Failed',
                    `Failed to send to channel ${effectiveChannel} for email "${email.subject}"`,
                    'failed',
                    { tool: 'slack', emailSubject: email.subject, error: response.error },
                );
                await saveActivityLog(prisma, agentConfig.agentId, log);

                return {
                    success: false,
                    actionType: 'send_slack_message',
                    message: response.error || 'Failed to send Slack message',
                };
            }

            // Log success
            const log = createActivityLog(
                'automation',
                'Slack Notification Sent',
                `Notification sent for email "${email.subject}"`,
                'success',
                { tool: 'slack', emailSubject: email.subject },
            );
            await saveActivityLog(prisma, agentConfig.agentId, log);

            return {
                success: true,
                actionType: 'send_slack_message',
                message: 'Notification sent to Slack',
            };
        } catch (error) {
            console.error('[SlackAction] Error:', error);
            return {
                success: false,
                actionType: 'send_slack_message',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    },
};
