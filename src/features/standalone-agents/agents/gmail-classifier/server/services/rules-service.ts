import prisma from "@/lib/db";
import { evaluateRules, executeAction, AutomationRule, EmailForRules, generateRuleId } from "@/lib/automation";

export interface RuleFilter {
    category?: string;
    emailIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    priority?: string;
}

export async function applyAgentRules(agentId: string, userId: string, filter: RuleFilter, dryRun: boolean = false) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const data = agent.data as any;
    const emails = data?.emails || [];
    const rules = (config?.automationRules || []).filter((r: AutomationRule) => r.enabled);

    if (rules.length === 0) {
        return {
            message: "No enabled rules found",
            matched: 0,
            executed: 0,
        };
    }

    let filteredEmails = emails;

    if (filter?.category) {
        filteredEmails = filteredEmails.filter((e: any) => e.category === filter.category);
    }

    if (filter?.emailIds && filter.emailIds.length > 0) {
        const emailIds = filter.emailIds;
        filteredEmails = filteredEmails.filter((e: any) => emailIds.includes(e.id));
    }

    if (filter?.priority) {
        filteredEmails = filteredEmails.filter((e: any) => e.priority === filter.priority);
    }

    if (filter?.dateFrom) {
        const fromDate = new Date(filter.dateFrom);
        filteredEmails = filteredEmails.filter((e: any) => new Date(e.date) >= fromDate);
    }

    if (filter?.dateTo) {
        const toDate = new Date(filter.dateTo);
        filteredEmails = filteredEmails.filter((e: any) => new Date(e.date) <= toDate);
    }

    const results: any[] = [];

    for (const email of filteredEmails) {
        const emailForRules: EmailForRules = {
            id: email.id,
            subject: email.subject || '',
            body: email.body || email.snippet || '',
            snippet: email.snippet || '',
            from: email.from || '',
            category: email.category || '',
            priority: email.priority || 'medium',
            labels: email.labels || [],
            date: email.date || new Date().toISOString(),
        };

        const matchingRules = evaluateRules(emailForRules, rules);

        for (const ruleResult of matchingRules) {
            const action = ruleResult.action;
            if (dryRun) {
                results.push({
                    emailId: email.id,
                    subject: email.subject,
                    ruleName: ruleResult.ruleName,
                    action: action.type,
                    status: 'dry-run',
                });
            } else {
                try {
                    const agentConfig = {
                        agentId,
                        jira: config.jira,
                        notion: config.notion,
                        jiraProjectKey: config.jiraProjectKey,
                        slack: config.slack,
                    };
                    const actionResult = await executeAction(emailForRules, action, agentConfig);
                    results.push({
                        emailId: email.id,
                        subject: email.subject,
                        ruleName: ruleResult.ruleName,
                        action: action.type,
                        status: 'executed',
                        result: actionResult.message,
                    });
                } catch (error) {
                    results.push({
                        emailId: email.id,
                        subject: email.subject,
                        ruleName: ruleResult.ruleName,
                        action: action.type,
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    }

    return {
        success: true,
        dryRun,
        emailsChecked: filteredEmails.length,
        rulesChecked: rules.length,
        matched: results.length,
        executed: results.filter(r => r.status === 'executed').length,
        failed: results.filter(r => r.status === 'failed').length,
        results,
    };
}

export async function createAgentRule(agentId: string, userId: string, rule: any) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = (agent.config as any) || {};
    const existingRules: AutomationRule[] = config.automationRules || [];

    const newRule: AutomationRule = {
        ...rule,
        id: generateRuleId(),
        createdAt: new Date().toISOString(),
    };

    const updatedRules = [...existingRules, newRule];

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...config,
                automationRules: updatedRules,
            },
        },
    });

    return { rule: newRule, success: true };
}

export async function updateAgentRule(agentId: string, userId: string, ruleId: string, updates: any) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = (agent.config as any) || {};
    const existingRules: AutomationRule[] = [...(config.automationRules || [])];

    const ruleIndex = existingRules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) throw new Error("Rule not found");

    const updatedRule: AutomationRule = {
        ...existingRules[ruleIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    existingRules[ruleIndex] = updatedRule;

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...config,
                automationRules: existingRules,
            },
        },
    });

    return { rule: updatedRule, success: true };
}

export async function deleteAgentRule(agentId: string, userId: string, ruleId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = (agent.config as any) || {};
    const existingRules: AutomationRule[] = config.automationRules || [];

    const updatedRules = existingRules.filter(r => r.id !== ruleId);

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...config,
                automationRules: updatedRules,
            },
        },
    });

    return { success: true };
}
