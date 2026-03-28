/**
 * Auto-Registration of all action executors.
 * 
 * Import this module once (e.g. from automation/index.ts) to register
 * all built-in actions with the action registry.
 * 
 * To add a new action:
 * 1. Create a new file in this directory (e.g. my-action.ts)
 * 2. Export an ActionExecutor object
 * 3. Import and register it below
 */

import { registerAction } from '../action-registry';
import { jiraAction } from './jira-action';
import { notionAction } from './notion-action';
import { slackAction } from './slack-action';
import { crmOrderAction } from './crm-order-action';

// Register all built-in actions
registerAction(jiraAction);
registerAction(notionAction);
registerAction(slackAction);
registerAction(crmOrderAction);

// Re-export individual actions for direct access if needed
export { jiraAction } from './jira-action';
export { notionAction } from './notion-action';
export { slackAction } from './slack-action';
export { crmOrderAction } from './crm-order-action';
