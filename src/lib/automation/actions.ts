/**
 * Action Executors — Backward-Compatible Wrapper
 * 
 * This file now delegates to the Action Registry (action-registry.ts)
 * and individual action plugins in actions/.
 * 
 * All existing imports from this file continue to work:
 *   import { executeAction, executeRuleActions } from '@/lib/automation/actions'
 * 
 * REFACTORED: The original 829 lines have been decomposed into:
 *   - action-registry.ts  → Plugin registry
 *   - actions/jira-action.ts → Jira task creation
 *   - actions/notion-action.ts → Notion page creation
 *   - actions/slack-action.ts → Slack messages
 *   - actions/crm-order-action.ts → CRM sales orders + AI extraction
 *   - actions/index.ts → Auto-registration
 */

import { RuleAction, EmailForRules } from './types';

// Import action registry (the core dispatcher)
import { executeAction as registryExecuteAction } from './action-registry';

// In standalone mode we keep the registry lightweight and avoid loading optional action plugins.

// ─── Re-export the ActionResult type for backward compatibility ───────────

export interface ActionResult {
    success: boolean;
    actionType: string;
    message: string;
    data?: {
        url?: string;
        id?: string;
    };
}

// ─── Main API (backward-compatible signatures) ───────────────────────────

/**
 * Execute an action based on rule match.
 * Delegates to the action registry.
 */
export async function executeAction(
    email: EmailForRules,
    action: RuleAction,
    agentConfig: {
        agentId: string;
        jira?: { accessToken: string; cloudId: string; };
        notion?: { accessToken: string; };
        slack?: { accessToken: string; };
        msDynamics?: { credentialId: string; };
        jiraProjectKey?: string;
    }
): Promise<ActionResult> {
    return registryExecuteAction(email, action, agentConfig);
}

/**
 * Execute multiple actions for matching rules.
 */
export async function executeRuleActions(
    email: EmailForRules,
    actions: RuleAction[],
    agentConfig: {
        agentId: string;
        jira?: { accessToken: string; cloudId: string; };
        notion?: { accessToken: string; };
        slack?: { accessToken: string; };
        msDynamics?: { credentialId: string; };
        jiraProjectKey?: string;
    }
): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
        const result = await executeAction(email, action, agentConfig);
        results.push(result);
    }

    return results;
}
