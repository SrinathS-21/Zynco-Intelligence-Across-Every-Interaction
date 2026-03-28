/**
 * Action Registry
 * 
 * Plugin-based architecture for automation actions.
 * Each action type is registered here and auto-discovered.
 * Adding a new action = creating a file in actions/ + registering it here.
 */

import { ActionExecutor, ActionResult, EmailForAction, RuleActionType } from '../integrations/types';

// Re-export types for convenience
export type { ActionExecutor, ActionResult, EmailForAction };

// ─── Registry ─────────────────────────────────────────────────────────────

const ACTION_REGISTRY = new Map<string, ActionExecutor>();

/**
 * Register an action executor in the registry.
 */
export function registerAction(executor: ActionExecutor): void {
    if (ACTION_REGISTRY.has(executor.type)) {
        console.warn(`[ActionRegistry] Overwriting existing action: ${executor.type}`);
    }
    ACTION_REGISTRY.set(executor.type, executor);
    console.log(`[ActionRegistry] Registered action: ${executor.type} (${executor.name})`);
}

/**
 * Get an action executor by type.
 */
export function getAction(type: string): ActionExecutor | undefined {
    return ACTION_REGISTRY.get(type);
}

/**
 * Get all registered action types.
 */
export function getRegisteredActionTypes(): string[] {
    return Array.from(ACTION_REGISTRY.keys());
}

/**
 * Check if an action type is registered.
 */
export function isActionRegistered(type: string): boolean {
    return ACTION_REGISTRY.has(type);
}

// ─── Execute via Registry ─────────────────────────────────────────────────

/**
 * Execute an action by looking it up in the registry.
 * This replaces the old switch-case in actions.ts.
 */
export async function executeAction(
    email: EmailForAction,
    action: { type: RuleActionType; config: Record<string, any> },
    agentConfig: Record<string, any>,
): Promise<ActionResult> {
    const executor = ACTION_REGISTRY.get(action.type);

    if (!executor) {
        return {
            success: false,
            actionType: action.type,
            message: `Unknown action type: ${action.type}. Available: ${getRegisteredActionTypes().join(', ')}`,
        };
    }

    try {
        return await executor.execute(email, action.config, agentConfig);
    } catch (error) {
        console.error(`[ActionRegistry] Error executing ${action.type}:`, error);
        return {
            success: false,
            actionType: action.type,
            message: `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}
