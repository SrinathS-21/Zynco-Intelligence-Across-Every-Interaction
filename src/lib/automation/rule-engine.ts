/**
 * Rule Engine
 * Evaluates automation rules against emails
 */

import {
    AutomationRule,
    RuleCondition,
    EmailForRules,
    RuleEvaluationResult
} from './types';

/**
 * Evaluate a single condition against an email
 */
function evaluateCondition(email: EmailForRules, condition: RuleCondition): boolean {
    const { field, operator, value } = condition;

    // Get the field value from email
    let fieldValue: string | string[];
    switch (field) {
        case 'category':
            fieldValue = email.category?.toLowerCase() || '';
            break;
        case 'subject':
            fieldValue = email.subject?.toLowerCase() || '';
            break;
        case 'body':
            fieldValue = (email.body || email.snippet || '').toLowerCase();
            break;
        case 'sender':
            fieldValue = email.from?.toLowerCase() || '';
            break;
        case 'priority':
            fieldValue = email.priority?.toLowerCase() || '';
            break;
        case 'labels':
            fieldValue = email.labels || [];
            break;
        default:
            return false;
    }

    const compareValue = value.toLowerCase();

    // Handle array fields (labels)
    if (Array.isArray(fieldValue)) {
        switch (operator) {
            case 'contains':
                return fieldValue.some(v => v.toLowerCase().includes(compareValue));
            case 'equals':
                return fieldValue.some(v => v.toLowerCase() === compareValue);
            default:
                return false;
        }
    }

    // Handle string fields
    switch (operator) {
        case 'equals':
            return fieldValue === compareValue;
        case 'not_equals':
            return fieldValue !== compareValue;
        case 'contains':
            return fieldValue.includes(compareValue);
        case 'not_contains':
            return !fieldValue.includes(compareValue);
        case 'starts_with':
            return fieldValue.startsWith(compareValue);
        case 'ends_with':
            return fieldValue.endsWith(compareValue);
        default:
            return false;
    }
}

/**
 * Evaluate a single rule against an email
 */
export function evaluateRule(email: EmailForRules, rule: AutomationRule): boolean {
    if (!rule.enabled) return false;
    if (!rule.conditions || rule.conditions.length === 0) return false;

    const results = rule.conditions.map(condition => evaluateCondition(email, condition));

    if (rule.conditionOperator === 'AND') {
        return results.every(r => r === true);
    } else {
        // OR
        return results.some(r => r === true);
    }
}

/**
 * Evaluate all rules against an email
 * Returns list of matching rules and their actions
 */
export function evaluateRules(
    email: EmailForRules,
    rules: AutomationRule[]
): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];

    for (const rule of rules) {
        const matched = evaluateRule(email, rule);

        if (matched) {
            results.push({
                ruleId: rule.id,
                ruleName: rule.name,
                matched: true,
                action: rule.action
            });
        }
    }

    return results;
}

/**
 * Filter rules by action type
 */
export function getRulesByActionType(
    rules: AutomationRule[],
    actionType: 'create_jira_task' | 'save_to_notion'
): AutomationRule[] {
    return rules.filter(r => r.action.type === actionType && r.enabled);
}

/**
 * Generate a unique rule ID
 */
export function generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
