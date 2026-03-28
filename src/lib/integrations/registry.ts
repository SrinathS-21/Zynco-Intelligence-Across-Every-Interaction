/**
 * Integration Registry
 * 
 * Central registry of all integrations available to the Gmail Classifier.
 * Adding a new integration = adding one entry here + its action executor.
 * 
 * This eliminates the need for hardcoded connect/disconnect handlers in editor.tsx
 * and hardcoded integration cards in SettingsPanel.tsx.
 */

import { IntegrationDefinition, IntegrationId } from './types';

// ─── Integration Definitions ──────────────────────────────────────────────

const INTEGRATIONS: IntegrationDefinition[] = [
    {
        id: 'gmail',
        name: 'Gmail',
        description: 'Connect your Gmail account to classify and manage emails',
        icon: '📧',
        type: 'oauth',
        configKey: 'accessToken', // Gmail uses top-level keys
        isConnected: (config) => !!config?.accessToken,
        disconnectConfigKeys: ['accessToken', 'refreshToken', 'tokenExpiresAt', 'gmailEmail', 'emailProvider'],
        trackedInConnectedTools: false, // Gmail is tracked separately
        activityLogTool: 'gmail',
        onboardingStateKey: 'emailConnected',
    },
    {
        id: 'jira',
        name: 'Jira',
        description: 'Auto-create issues from action-required emails',
        icon: '🔧',
        type: 'oauth',
        configKey: 'jira',
        isConnected: (config) => !!config?.jira?.accessToken,
        disconnectConfigKeys: ['jira'],
        trackedInConnectedTools: true,
        activityLogTool: 'jira',
        onboardingStateKey: 'jiraConnected',
    },
    {
        id: 'slack',
        name: 'Slack',
        description: 'Get notified about important emails in Slack',
        icon: '💬',
        type: 'oauth',
        configKey: 'slack',
        isConnected: (config) => !!config?.slack?.accessToken,
        disconnectConfigKeys: ['slack'],
        trackedInConnectedTools: true,
        activityLogTool: 'slack',
        onboardingStateKey: 'slackConnected',
    },
    {
        id: 'notion',
        name: 'Notion',
        description: 'Save important emails to your Notion workspace',
        icon: '📝',
        type: 'oauth',
        configKey: 'notion',
        isConnected: (config) => !!config?.notion?.accessToken,
        disconnectConfigKeys: ['notion'],
        trackedInConnectedTools: true,
        activityLogTool: 'notion',
        onboardingStateKey: 'notionConnected',
    },
    {
        id: 'dynamics_crm',
        name: 'Dynamics CRM',
        description: 'Auto-create sales orders from order emails',
        icon: '📦',
        type: 'credential',
        configKey: 'msDynamics',
        isConnected: (config) => !!config?.msDynamics?.credentialId,
        disconnectConfigKeys: ['msDynamics'],
        trackedInConnectedTools: false, // CRM uses credential system
        activityLogTool: 'dynamics_crm',
        // CRM uses credential-based flow, not a simple connect endpoint
        onboardingStateKey: 'crmConnected',
    },
];

// ─── Registry API ─────────────────────────────────────────────────────────

/**
 * Get all registered integrations
 */
export function getAllIntegrations(): IntegrationDefinition[] {
    return [...INTEGRATIONS];
}

/**
 * Get a specific integration by ID
 */
export function getIntegration(id: IntegrationId): IntegrationDefinition | undefined {
    return INTEGRATIONS.find(i => i.id === id);
}

/**
 * Get all integrations that are NOT gmail (the "tool" integrations)
 */
export function getToolIntegrations(): IntegrationDefinition[] {
    return INTEGRATIONS.filter(i => i.id !== 'gmail');
}

/**
 * Check connection status for all integrations given an agent config
 */
export function getConnectionStates(config: Record<string, any>): Record<IntegrationId, boolean> {
    const states = {} as Record<IntegrationId, boolean>;
    for (const integration of INTEGRATIONS) {
        states[integration.id] = integration.isConnected(config || {});
    }
    return states;
}

/**
 * Build the config patch to disconnect an integration.
 * Returns the config object to PATCH to the agent.
 */
export function buildDisconnectPatch(
    integration: IntegrationDefinition,
    currentConnectedTools: string[],
): { config: Record<string, any>; data?: Record<string, any> } {
    const configPatch: Record<string, any> = {};

    // Null out all config keys for this integration
    for (const key of integration.disconnectConfigKeys) {
        configPatch[key] = null;
    }

    // Remove from connectedTools if tracked
    if (integration.trackedInConnectedTools) {
        configPatch.connectedTools = currentConnectedTools.filter(t => t !== integration.id);
    }

    // Gmail has special data cleanup
    if (integration.id === 'gmail') {
        return {
            config: configPatch,
            data: {
                gmailConnected: false,
                emails: [],
            },
        };
    }

    return { config: configPatch };
}
