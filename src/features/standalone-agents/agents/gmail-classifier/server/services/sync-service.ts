import prisma from "@/lib/db";
import { fetchGmailEmails } from "@/lib/gmail/client";
import { refreshAccessToken } from "@/lib/gmail/oauth";
import {
    classifyEmailWithGroq,
    classifyWithGmailLabels,
    classifyWithSenderRules,
} from "@/lib/classification/groq-classifier";
import { calculatePriorityScore } from "@/lib/classification/priority-scorer";
import { EmailForRules, AutomationRule } from "@/lib/automation";

export interface SyncOptions {
    count?: number;
    query?: string;
    dateRange?: string;
    syncMode?: 'count' | 'days';
    freshSync?: boolean;
    jiraProjectKey?: string;
    excludePromotions?: boolean;
    excludeUpdates?: boolean;
}

export async function syncAgentEmails(agentId: string, userId: string, options: SyncOptions = {}) {
    const {
        count,
        query,
        dateRange: reqDateRange,
        syncMode: reqSyncMode,
        freshSync = false,
        jiraProjectKey = ""
    } = options;

    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentData = (agent.data as any) || {};
    const agentConfig = (agent.config as any) || {};
    const existingLogs = agentConfig?.activityLogs || [];

    const { getValidAccessToken } = await import("./token-service");
    const accessToken = await getValidAccessToken(agentId);
    if (!accessToken) throw new Error("Gmail not connected");

    const syncPrefs = (agentConfig.syncPreferences as any) || {};
    const effectiveSyncMode = reqSyncMode || syncPrefs.syncMode || 'count';
    const effectiveDateRange = reqDateRange || syncPrefs.dateRange || 'all';
    const fetchCount = count || syncPrefs.emailCount || 25;

    let finalQuery = query || "";
    if (!query && effectiveDateRange !== 'all') {
        const daysMap: Record<string, number> = {
            "1d": 1, "today": 1, "3d": 3, "1w": 7, "week": 7, "2w": 14, "1m": 30, "month": 30
        };
        const daysAgo = daysMap[effectiveDateRange];
        if (daysAgo) {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            finalQuery = `after:${date.toISOString().split('T')[0]}`;
        }
    }

    const excludePromotions = options.excludePromotions !== undefined
        ? options.excludePromotions
        : (options.freshSync ? false : (syncPrefs.excludePromotions ?? true));

    if (excludePromotions) {
        finalQuery = finalQuery ? `${finalQuery} -category:promotions` : "-category:promotions";
    }

    const excludeUpdates = options.excludeUpdates !== undefined
        ? options.excludeUpdates
        : (options.freshSync ? false : (syncPrefs.excludeUpdates ?? false));

    if (excludeUpdates) {
        finalQuery = finalQuery ? `${finalQuery} -category:updates -category:social -category:forums` : "-category:updates -category:social -category:forums";
    }

    let gmailEmails: any[] = [];
    try {
        const result = await fetchGmailEmails(accessToken, {
            maxResults: fetchCount,
            labelIds: ["INBOX"],
            query: finalQuery || undefined,
        });
        gmailEmails = result.emails;
    } catch (error: any) {
        console.error("[Sync] Error fetching emails:", error);
        throw error;
    }

    // Always build a map of all emails we've ever seen for this agent
    const allEmailsInDb: any[] = agentData.emails || [];
    const dbEmailMap = new Map(allEmailsInDb.map(e => [e.id, e]));

    // existingEmails are the ones we will merge back at the end
    const existingEmails = freshSync ? [] : allEmailsInDb;
    const existingEmailMap = dbEmailMap; // For clarification

    const newGmailEmails = gmailEmails.filter(email => !dbEmailMap.has(email.id));

    // List of emails to process for classification and metadata
    const emailsToProcess = freshSync ? gmailEmails : newGmailEmails;

    // Process classification...
    let processedEmails = await Promise.all(emailsToProcess.map(async (email) => {
        // Carry over history from DB if it exists
        const existing = dbEmailMap.get(email.id);
        const history = existing?.executedAutomationRuleIds || [];

        let classification = classifyWithGmailLabels(email.labels) || classifyWithSenderRules(email.from);

        if (!classification) {
            try {
                classification = await classifyEmailWithGroq(email);
            } catch (err) {
                console.error("[Sync] Groq classification failed:", err);
                classification = {
                    category: 'other',
                    priority: 'medium',
                    confidence: 0.5,
                    reasoning: 'Failed',
                    shouldCreateJiraTask: false,
                    actionRequired: false
                };
            }
        }

        // classification is guaranteed to be non-null here
        const safeClassification = classification!;

        const priorityResult = calculatePriorityScore({
            ...email,
            category: safeClassification.category,
            body: email.body || email.snippet || '',
        });

        return {
            ...email,
            category: safeClassification.category,
            priority: safeClassification.priority,
            confidence: safeClassification.confidence,
            syncedAt: new Date().toISOString(),
            smartScore: priorityResult.score,
            smartLevel: priorityResult.level,
            shouldCreateJiraTask: safeClassification.shouldCreateJiraTask,
            actionRequired: safeClassification.actionRequired,
            reasoning: safeClassification.reasoning,
            executedAutomationRuleIds: history
        };
    }));

    // Apply auto-labeling if we have new emails and custom labels
    const customLabels = agentConfig.customLabels || [];
    const gmailEmail = agentConfig.gmailEmail || "";
    if (processedEmails.length > 0 && customLabels.length > 0) {
        const { autoLabelNewEmails } = await import("@/lib/label-learning/auto-labeler");
        processedEmails = autoLabelNewEmails(processedEmails, customLabels, gmailEmail);
    }

    // Automation Rules Execution
    try {
        const { evaluateRules, executeAction } = await import("@/lib/automation");
        const { getAgentActivityLogs } = await import("./activity-service");

        const emailsToAutomate = processedEmails;

        for (const email of emailsToAutomate) {
            // Find existing data if available to check for executed rules
            const existingEmailData = dbEmailMap.get(email.id);
            const executedRuleIds = (existingEmailData?.executedAutomationRuleIds || []) as string[];

            // Convert to format expected by rule engine
            const emailForRules: EmailForRules = {
                id: email.id,
                subject: email.subject,
                from: email.from,
                body: email.body || email.snippet || "",
                snippet: email.snippet || "",
                category: email.category || existingEmailData?.category || 'other',
                priority: email.priority || existingEmailData?.priority || 'medium',
                isRead: email.isRead ?? existingEmailData?.isRead,
                labels: email.labels || existingEmailData?.labels,
            };

            const enabledRules = agentConfig.automationRules || [];
            const matchingResults = evaluateRules(emailForRules, enabledRules);

            // Filter out rules that have already been executed for this specific email
            const newMatchingResults = matchingResults.filter(r => !executedRuleIds.includes(r.ruleId));

            if (newMatchingResults.length < matchingResults.length) {
                const skippedCount = matchingResults.length - newMatchingResults.length;
                if (skippedCount > 0) {
                    console.log(`[Automation] Skipping ${skippedCount} already executed rules for "${email.subject}"`);
                }
            }

            if (newMatchingResults.length === 0 && email.category === 'transactional') {
                // Only log if it was actually a new match that got empty, but here we check if it matched any at all
                if (matchingResults.length === 0) {
                    console.log(`[Automation] Transactional email NOT matched by any rule: "${email.subject}" (category=${email.category})`);
                }
            }

            // Deduplicate actions within this single run
            const seenActionTypes = new Set<string>();
            const dedupedResults = newMatchingResults.filter(r => {
                if (seenActionTypes.has(r.action.type)) {
                    console.log(`[Automation] Skipping duplicate "${r.action.type}" for "${email.subject}"`);
                    return false;
                }
                seenActionTypes.add(r.action.type);
                return true;
            });

            // Execute actions
            for (const result of dedupedResults) {
                try {
                    const actionResult = await executeAction(
                        emailForRules,
                        result.action,
                        { ...agentConfig, agentId, userId }
                    );

                    if (actionResult.success) {
                        console.log(`[Automation] Executed rule "${result.ruleName}" for "${email.subject}": SUCCESS`);

                        // Mark rule as executed in the email object (both in map and processedEmails)
                        if (existingEmailData) {
                            if (!existingEmailData.executedAutomationRuleIds) existingEmailData.executedAutomationRuleIds = [];
                            existingEmailData.executedAutomationRuleIds.push(result.ruleId);
                        }

                        // Also update context in processedEmails if it's there
                        const inProcessed = processedEmails.find(pe => pe.id === email.id);
                        if (inProcessed) {
                            if (!inProcessed.executedAutomationRuleIds) inProcessed.executedAutomationRuleIds = [];
                            inProcessed.executedAutomationRuleIds.push(result.ruleId);
                        } else if (freshSync) {
                            // If it wasn't "new" but we are in freshSync, we might need to update it in mergedEmails later
                            // For now, updating existingEmailData handles it because they are merged.
                        }
                    } else {
                        console.warn(`[Automation] Rule "${result.ruleName}" for "${email.subject}" FAILED: ${actionResult.message}`);
                    }
                } catch (err: any) {
                    console.error(`[Automation] CRITICAL Error executing rule "${result.ruleName}":`, err);
                }
            }
        }
    } catch (automationError) {
        console.error("[Sync] Automation processing failed:", automationError);
    }

    // Filter out existing emails that we just re-processed to avoid duplicates in the array
    const processedIds = new Set(processedEmails.map(pe => pe.id));
    const nonUpdatedExisting = allEmailsInDb.filter(e => !processedIds.has(e.id));

    const mergedEmails = [...processedEmails, ...nonUpdatedExisting].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            data: {
                ...agentData,
                emails: mergedEmails.slice(0, 500), // Cap at 500 for now
                lastSync: new Date().toISOString(),
            }
        }
    });

    return { emails: mergedEmails, newCount: processedEmails.length };
}
