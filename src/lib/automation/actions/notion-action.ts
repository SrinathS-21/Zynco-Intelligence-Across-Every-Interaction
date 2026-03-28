/**
 * Notion Action Executor
 * 
 * Saves an email to a Notion database via the Notion API.
 * Extracted from the monolithic actions.ts.
 */

import { ActionExecutor, ActionResult, EmailForAction } from '../action-registry';
import { createPageInDatabase } from '@/lib/notion/oauth';
import { createActivityLog, saveActivityLog } from '@/lib/activity-history';
import prisma from '@/lib/db';
import { stripHtml } from '@/lib/utils';

export const notionAction: ActionExecutor = {
    type: 'save_to_notion',
    name: 'Save to Notion',

    async execute(
        email: EmailForAction,
        config: Record<string, any>,
        agentConfig: Record<string, any>,
    ): Promise<ActionResult> {
        if (!agentConfig.notion?.accessToken) {
            return {
                success: false,
                actionType: 'save_to_notion',
                message: 'Notion not connected',
            };
        }

        // Use database ID from agent config (selected by user) or fall back to rule config
        const databaseId = agentConfig.notion?.selectedDatabaseId || config.databaseId;

        if (!databaseId) {
            return {
                success: false,
                actionType: 'save_to_notion',
                message: 'No Notion database selected. Go to Settings to select a database.',
            };
        }

        try {
            const result = await createPageInDatabase(
                agentConfig.notion.accessToken,
                databaseId,
                {
                    title: email.subject,
                    from: email.from,
                    date: email.date || new Date().toISOString(),
                    category: email.category,
                    content: stripHtml(email.body || email.snippet || ''),
                    priority: email.priority,
                },
            );

            console.log('[NotionAction] Created page:', result.pageId);

            // Log activity
            const log = createActivityLog(
                'notion_page',
                'Notion Page Created (Auto)',
                `Automation rule applied to email "${email.subject}"`,
                'success',
                { tool: 'notion', pageId: result.pageId, emailSubject: email.subject },
            );
            await saveActivityLog(prisma, agentConfig.agentId, log);

            return {
                success: true,
                actionType: 'save_to_notion',
                message: 'Saved to Notion',
                data: {
                    id: result.pageId,
                    url: result.url,
                },
            };
        } catch (error) {
            console.error('[NotionAction] Error:', error);
            return {
                success: false,
                actionType: 'save_to_notion',
                message: `Notion action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    },
};
