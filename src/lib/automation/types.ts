/**
 * Automation Rule Types
 * Defines the structure for email automation rules
 */

export interface AutomationRule {
    id: string;
    name: string;
    enabled: boolean;
    conditions: RuleCondition[];
    conditionOperator: 'AND' | 'OR';
    action: RuleAction;
    createdAt: string;
    updatedAt?: string;
}

export interface RuleCondition {
    field: RuleField;
    operator: RuleOperator;
    value: string;
}

export type RuleField =
    | 'category'
    | 'subject'
    | 'body'
    | 'sender'
    | 'priority'
    | 'labels';

export type RuleOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with';

export interface RuleAction {
    type: RuleActionType;
    config: ActionConfig;
}

export type RuleActionType =
    | 'create_jira_task'
    | 'save_to_notion'
    | 'send_slack_message'
    | 'create_crm_order';

export interface ActionConfig {
    // For Jira
    projectKey?: string;
    issueType?: string;
    // For Notion
    databaseId?: string;
    // For Slack
    slackChannelId?: string;
    // For MS Dynamics CRM
    msDynamicsCredentialId?: string;
    // Common
    notifyUser?: boolean;
}

// Email structure for rule evaluation
export interface EmailForRules {
    id: string;
    subject: string;
    from: string;
    body: string;
    category: string;
    priority: string;
    isRead?: boolean;
    snippet?: string;
    labels?: string[];
    date?: string;
    executedAutomationRuleIds?: string[];
}

// Result of rule evaluation
export interface RuleEvaluationResult {
    ruleId: string;
    ruleName: string;
    matched: boolean;
    action: RuleAction;
}

// Default rule templates
export const DEFAULT_RULE_TEMPLATES: Omit<AutomationRule, 'id' | 'createdAt'>[] = [
    {
        name: "Action Required → Jira Task",
        enabled: false,
        conditions: [
            { field: 'category', operator: 'equals', value: 'requires_action' }
        ],
        conditionOperator: 'AND',
        action: {
            type: 'create_jira_task',
            config: { notifyUser: true }
        }
    },
    {
        name: "Important Emails → Notion",
        enabled: false,
        conditions: [
            { field: 'category', operator: 'equals', value: 'important' }
        ],
        conditionOperator: 'AND',
        action: {
            type: 'save_to_notion',
            config: { notifyUser: true }
        }
    },
    {
        name: "Password/Credentials → Notion",
        enabled: false,
        conditions: [
            { field: 'body', operator: 'contains', value: 'password' }
        ],
        conditionOperator: 'OR',
        action: {
            type: 'save_to_notion',
            config: { notifyUser: true }
        }
    },
    {
        name: "Order Emails → CRM Sales Order",
        enabled: false,
        conditions: [
            { field: 'category', operator: 'equals', value: 'transactional' }
        ],
        conditionOperator: 'AND',
        action: {
            type: 'create_crm_order',
            config: { notifyUser: true }
        }
    },
    {
        name: "Order Subject → CRM Sales Order",
        enabled: false,
        conditions: [
            { field: 'subject', operator: 'contains', value: 'order' }
        ],
        conditionOperator: 'AND',
        action: {
            type: 'create_crm_order',
            config: { notifyUser: true }
        }
    },];
