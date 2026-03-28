import { AutomationRule, RuleCondition, StoredEmail } from "./types";

function matchCondition(email: StoredEmail, condition: RuleCondition): boolean {
  const value = condition.value.toLowerCase();
  const sourceText =
    condition.field === "subject"
      ? email.subject
      : condition.field === "from"
      ? email.from
      : condition.field === "body"
      ? email.body || email.snippet
      : condition.field === "category"
      ? email.category
      : email.priority;

  const text = String(sourceText || "").toLowerCase();

  switch (condition.operator) {
    case "contains":
      return text.includes(value);
    case "equals":
      return text === value;
    case "not_equals":
      return text !== value;
    default:
      return false;
  }
}

export function evaluateRules(email: StoredEmail, rules: AutomationRule[]) {
  return rules.filter((rule) => {
    if (!rule.enabled || rule.conditions.length === 0) return false;

    const operator = rule.conditionOperator || "AND";
    const results = rule.conditions.map((cond) => matchCondition(email, cond));
    return operator === "AND" ? results.every(Boolean) : results.some(Boolean);
  });
}

export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
