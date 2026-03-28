/**
 * Activity History Tracking
 * Logs all automated actions: Jira tasks, Notion pages, rules, connections, etc.
 */

export type ActivityType =
    | 'connection'
    | 'disconnection'
    | 'jira_task'
    | 'notion_page'
    | 'crm_order'
    | 'rule_created'
    | 'rule_updated'
    | 'rule_deleted'
    | 'rule_executed'
    | 'knowledge_added'
    | 'knowledge_deleted'
    | 'email_sync'
    | 'email_classified'
    | 'automation';

export type ActivityStatus = 'success' | 'failed' | 'pending';

export interface ActivityLog {
    id: string;
    type: ActivityType;
    action: string;
    details: string;
    timestamp: string;
    status: ActivityStatus;
    metadata?: {
        emailId?: string;
        emailSubject?: string;
        ruleName?: string;
        tool?: 'gmail' | 'jira' | 'notion' | 'slack' | 'dynamics_crm';
        taskKey?: string;
        pageId?: string;
        count?: number;
        [key: string]: any;
    };
}

/**
 * Generate a unique ID for activity logs
 */
export function generateActivityId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create an activity log entry
 */
export function createActivityLog(
    type: ActivityType,
    action: string,
    details: string,
    status: ActivityStatus = 'success',
    metadata?: ActivityLog['metadata']
): ActivityLog {
    return {
        id: generateActivityId(),
        type,
        action,
        details,
        timestamp: new Date().toISOString(),
        status,
        metadata,
    };
}

/**
 * Server-side helper to save an activity log to an agent's config
 */
export async function saveActivityLog(
    prisma: any,
    agentId: string,
    log: ActivityLog
): Promise<void> {
    const MAX_ACTIVITY_LOGS = 100;

    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId },
        select: { config: true, data: true },
    });

    if (!agent) return;

    const config = agent.config as any;
    const data = (agent.data as any) || {};
    const stats = (data.stats as any) || {};

    // Initialize automation stats if missing
    if (!stats.automations) {
        stats.automations = {
            jira_task: 0,
            notion_page: 0,
            slack_message: 0,
            crm_order: 0,
            total: 0
        };
    }

    // Increment counters if successful
    if (log.status === 'success') {
        let isAutomation = false;
        if (log.type === 'jira_task') {
            stats.automations.jira_task++;
            isAutomation = true;
        } else if (log.type === 'notion_page') {
            stats.automations.notion_page++;
            isAutomation = true;
        } else if (log.type === 'crm_order') {
            stats.automations.crm_order++;
            isAutomation = true;
        } else if (log.type === 'automation' && log.metadata?.tool === 'slack') {
            stats.automations.slack_message++;
            isAutomation = true;
        }

        if (isAutomation) {
            stats.automations.total++;
        }
    }

    let activityLogs: ActivityLog[] = config?.activityLogs || [];

    // Add new log at the beginning
    activityLogs.unshift(log);

    // Keep only the last MAX_ACTIVITY_LOGS entries
    if (activityLogs.length > MAX_ACTIVITY_LOGS) {
        activityLogs = activityLogs.slice(0, MAX_ACTIVITY_LOGS);
    }

    // Update agent config and data stats
    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...config,
                activityLogs,
            },
            data: {
                ...data,
                stats,
            }
        },
    });
}

/**
 * Get icon name for activity type
 */
export function getActivityIcon(type: ActivityType): string {
    const icons: Record<ActivityType, string> = {
        connection: 'plug',
        disconnection: 'unplug',
        jira_task: 'clipboard-list',
        notion_page: 'file-text',
        crm_order: 'shopping-cart',
        rule_created: 'plus-circle',
        rule_updated: 'edit',
        rule_deleted: 'trash',
        rule_executed: 'play',
        knowledge_added: 'brain',
        knowledge_deleted: 'brain',
        email_sync: 'refresh-cw',
        email_classified: 'tag',
        automation: 'zap',
    };
    return icons[type] || 'activity';
}

/**
 * Get color for activity type
 */
export function getActivityColor(type: ActivityType): string {
    const colors: Record<ActivityType, string> = {
        connection: 'text-emerald-500',
        disconnection: 'text-orange-500',
        jira_task: 'text-blue-500',
        notion_page: 'text-gray-600 dark:text-gray-400',
        crm_order: 'text-emerald-600',
        rule_created: 'text-green-500',
        rule_updated: 'text-yellow-500',
        rule_deleted: 'text-red-500',
        rule_executed: 'text-purple-500',
        knowledge_added: 'text-pink-500',
        knowledge_deleted: 'text-pink-500',
        email_sync: 'text-sky-500',
        email_classified: 'text-indigo-500',
        automation: 'text-amber-500',
    };
    return colors[type] || 'text-muted-foreground';
}

/**
 * Format activity for display
 */
export function formatActivityTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
