/**
 * Automation Module Exports
 */

export * from './types';
export * from './rule-engine';
export * from './actions';

// Re-export specific items from action-registry to avoid name collision with actions.ts
export {
    registerAction,
    getAction,
    getRegisteredActionTypes,
    isActionRegistered,
    executeAction as registryExecuteAction,
} from './action-registry';
export type { ActionExecutor } from './action-registry';
