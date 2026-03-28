/**
 * Client-side activity logger
 * Use this to log activities from React components
 */

import { ActivityType, ActivityStatus, ActivityLog } from './activity-history';

interface LogActivityParams {
    agentId: string;
    type: ActivityType;
    action: string;
    details?: string;
    status?: ActivityStatus;
    metadata?: ActivityLog['metadata'];
}

/**
 * Log an activity to the server
 * Non-blocking - fire and forget
 */
export async function logActivity({
    agentId,
    type,
    action,
    details = '',
    status = 'success',
    metadata,
}: LogActivityParams): Promise<void> {
    try {
        await fetch('/api/standalone-agents/gmail-classifier/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId,
                type,
                action,
                details,
                status,
                metadata,
            }),
        });
    } catch (error) {
        // Non-blocking - don't throw errors for activity logging
        console.error('[ActivityLogger] Failed to log activity:', error);
    }
}

/**
 * Pre-built logging helpers for common actions
 */
export const ActivityLogger = {
    // Connections
    connected: (agentId: string, tool: 'gmail' | 'jira' | 'notion' | 'slack' | 'dynamics_crm') =>
        logActivity({
            agentId,
            type: 'connection',
            action: `${tool === 'dynamics_crm' ? 'Dynamics CRM' : tool.charAt(0).toUpperCase() + tool.slice(1)} Connected`,
            details: `Successfully connected ${tool === 'dynamics_crm' ? 'Dynamics CRM' : tool} integration`,
            metadata: { tool },
        }),

    disconnected: (agentId: string, tool: 'gmail' | 'jira' | 'notion' | 'slack' | 'dynamics_crm') =>
        logActivity({
            agentId,
            type: 'disconnection',
            action: `${tool === 'dynamics_crm' ? 'Dynamics CRM' : tool.charAt(0).toUpperCase() + tool.slice(1)} Disconnected`,
            details: `Disconnected ${tool === 'dynamics_crm' ? 'Dynamics CRM' : tool} integration`,
            metadata: { tool },
        }),

    // Jira tasks
    jiraTaskCreated: (agentId: string, taskKey: string, emailSubject: string, ruleName?: string) =>
        logActivity({
            agentId,
            type: 'jira_task',
            action: `Jira Task Created: ${taskKey}`,
            details: `Created from email: "${emailSubject}"${ruleName ? ` (Rule: ${ruleName})` : ''}`,
            metadata: { tool: 'jira', taskKey, emailSubject, ruleName },
        }),

    // Notion pages
    notionPageCreated: (agentId: string, pageId: string, emailSubject: string, ruleName?: string) =>
        logActivity({
            agentId,
            type: 'notion_page',
            action: `Notion Page Created`,
            details: `Created from email: "${emailSubject}"${ruleName ? ` (Rule: ${ruleName})` : ''}`,
            metadata: { tool: 'notion', pageId, emailSubject, ruleName },
        }),

    // Rules
    ruleCreated: (agentId: string, ruleName: string) =>
        logActivity({
            agentId,
            type: 'rule_created',
            action: `Rule Created: ${ruleName}`,
            details: `New automation rule added`,
            metadata: { ruleName },
        }),

    ruleUpdated: (agentId: string, ruleName: string) =>
        logActivity({
            agentId,
            type: 'rule_updated',
            action: `Rule Updated: ${ruleName}`,
            details: `Automation rule modified`,
            metadata: { ruleName },
        }),

    ruleDeleted: (agentId: string, ruleName: string) =>
        logActivity({
            agentId,
            type: 'rule_deleted',
            action: `Rule Deleted: ${ruleName}`,
            details: `Automation rule removed`,
            metadata: { ruleName },
        }),

    ruleExecuted: (agentId: string, ruleName: string, count: number) =>
        logActivity({
            agentId,
            type: 'rule_executed',
            action: `Rule Executed: ${ruleName}`,
            details: `Applied to ${count} email${count !== 1 ? 's' : ''}`,
            metadata: { ruleName, count },
        }),

    // Knowledge Base
    knowledgeAdded: (agentId: string, title: string) =>
        logActivity({
            agentId,
            type: 'knowledge_added',
            action: `Knowledge Added`,
            details: title,
        }),

    knowledgeDeleted: (agentId: string, title: string) =>
        logActivity({
            agentId,
            type: 'knowledge_deleted',
            action: `Knowledge Removed`,
            details: title,
        }),

    // Email Sync
    emailSynced: (agentId: string, count: number, newCount: number) =>
        logActivity({
            agentId,
            type: 'email_sync',
            action: `Emails Synced`,
            details: `${count} total emails (${newCount} new)`,
            metadata: { count, newCount },
        }),

    emailClassified: (agentId: string, count: number) =>
        logActivity({
            agentId,
            type: 'email_classified',
            action: `Emails Classified`,
            details: `${count} email${count !== 1 ? 's' : ''} classified`,
            metadata: { count },
        }),
};
