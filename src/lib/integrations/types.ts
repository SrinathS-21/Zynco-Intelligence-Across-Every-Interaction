/**
 * Integration Registry Types
 * 
 * Defines the contracts for all integrations (Jira, Slack, Notion, CRM, etc.)
 * Adding a new integration = implementing these interfaces + registering.
 */

// ─── Integration Definition ───────────────────────────────────────────────

export type IntegrationId = 'gmail' | 'jira' | 'slack' | 'notion' | 'dynamics_crm';

export type IntegrationType = 'oauth' | 'credential';

/**
 * Defines an integration that can be connected to the Gmail Classifier agent.
 * Each integration registers itself with metadata + connect/disconnect logic.
 */
export interface IntegrationDefinition {
    /** Unique identifier for this integration */
    id: IntegrationId;
    /** Human-readable name */
    name: string;
    /** Short description for UI */
    description: string;
    /** Icon path or emoji */
    icon: string;
    /** Whether this uses OAuth or stored credentials */
    type: IntegrationType;
    /** The config key in agent.config where credentials are stored (e.g. 'jira', 'slack', 'msDynamics') */
    configKey: string;
    /** Check if this integration is connected based on agent config */
    isConnected: (config: Record<string, any>) => boolean;
    /** Config fields to null-out when disconnecting */
    disconnectConfigKeys: string[];
    /** Whether this integration should be tracked in connectedTools array */
    trackedInConnectedTools: boolean;
    /** The tool name used for activity logging */
    activityLogTool: 'gmail' | 'jira' | 'notion' | 'slack' | 'dynamics_crm';
    /** The state key in OnboardingState (e.g. 'jiraConnected', 'slackConnected') */
    onboardingStateKey: string;
}

// ─── Action Executor (Automation Plugin System) ───────────────────────────

export type RuleActionType =
    | 'create_jira_task'
    | 'save_to_notion'
    | 'send_slack_message'
    | 'create_crm_order';

export interface ActionResult {
    success: boolean;
    actionType: string;
    message: string;
    data?: {
        url?: string;
        id?: string;
    };
}

export interface EmailForAction {
    id: string;
    subject: string;
    from: string;
    body: string;
    snippet?: string;
    category: string;
    priority: string;
    labels?: string[];
    date?: string;
    executedAutomationRuleIds?: string[];
}

/**
 * Interface that every automation action must implement.
 * Each action lives in its own file under lib/automation/actions/
 */
export interface ActionExecutor {
    /** The action type this executor handles */
    type: RuleActionType;
    /** Human-readable name */
    name: string;
    /** Execute the action for a given email */
    execute(
        email: EmailForAction,
        config: Record<string, any>,
        agentConfig: Record<string, any>,
    ): Promise<ActionResult>;
}
