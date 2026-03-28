import prisma from "@/lib/db";
import { CustomLabel } from "@/lib/label-learning/types";
import { extractPatterns } from "@/lib/label-learning/pattern-extractor";

export async function getAgentLabels(agentId: string, userId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    return config.customLabels || [];
}

export async function createAgentLabel(agentId: string, userId: string, input: any) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const labels: CustomLabel[] = config.customLabels || [];

    if (labels.some(l => l.name.toLowerCase() === input.name.toLowerCase())) {
        throw new Error("Label with this name already exists");
    }

    let patterns: any[] = [];
    if (input.emailIds && input.emailIds.length > 0) {
        const agentData = agent.data as any;
        const emails = agentData?.emails || [];
        const selectedEmails = emails.filter((e: any) => input.emailIds.includes(e.id));

        if (selectedEmails.length > 0) {
            patterns = extractPatterns(selectedEmails[0], selectedEmails);
        }
    }

    const newLabel: CustomLabel = {
        id: `label_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: input.name,
        color: input.color || "#3B82F6",
        description: input.description,
        autoApply: input.autoApply !== undefined ? input.autoApply : true,
        confidence: input.emailIds && input.emailIds.length > 0 ? 0.5 : 0.0,
        patterns,
        applications: input.emailIds
            ? input.emailIds.map((id: string) => ({
                emailId: id,
                appliedBy: "user",
                timestamp: new Date().toISOString(),
            }))
            : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userContext: input.userContext,
        customRules: input.customRules,
        confidenceThreshold: input.confidenceThreshold !== undefined ? input.confidenceThreshold : 0.5,
        useLLMFallback: input.useLLMFallback !== undefined ? input.useLLMFallback : false,
    };

    labels.push(newLabel);

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...config,
                customLabels: labels,
            },
        },
    });

    return { success: true, label: newLabel };
}

export async function applyAgentLabel(agentId: string, userId: string, labelId: string, emailIds: string[]) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const data = agent.data as any;
    const emails = data?.emails || [];

    // Update labels in the current data object
    const updatedEmails = emails.map((e: any) => {
        if (emailIds.includes(e.id)) {
            const customLabels = e.customLabels || [];
            if (!customLabels.includes(labelId)) {
                return { ...e, customLabels: [...customLabels, labelId] };
            }
        }
        return e;
    });

    // Update applications count in label config
    const labels = config.customLabels || [];
    const updatedLabels = labels.map((l: any) => {
        if (l.id === labelId) {
            const currentApps = l.applications || [];
            const newApps = emailIds
                .filter(id => !currentApps.some((a: any) => a.emailId === id))
                .map(id => ({
                    emailId: id,
                    appliedBy: 'user',
                    timestamp: new Date().toISOString()
                }));
            return {
                ...l,
                applications: [...currentApps, ...newApps],
                updatedAt: new Date().toISOString(),
                confidence: Math.min(1.0, (l.confidence || 0) + (newApps.length * 0.05))
            };
        }
        return l;
    });

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...config,
                customLabels: updatedLabels,
            },
            data: {
                ...data,
                emails: updatedEmails,
            },
        },
    });

    return { success: true };
}
export async function updateAgentLabel(agentId: string, userId: string, labelId: string, updates: any) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const labels: CustomLabel[] = config.customLabels || [];

    const labelIndex = labels.findIndex(l => l.id === labelId);
    if (labelIndex === -1) throw new Error("Label not found");

    labels[labelIndex] = {
        ...labels[labelIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...config,
                customLabels: labels,
            },
        },
    });

    return { success: true, label: labels[labelIndex] };
}

export async function deleteAgentLabel(agentId: string, userId: string, labelId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const labels: CustomLabel[] = config.customLabels || [];

    const filteredLabels = labels.filter(l => l.id !== labelId);

    if (filteredLabels.length === labels.length) throw new Error("Label not found");

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...config,
                customLabels: filteredLabels,
            },
        },
    });

    return { success: true };
}

export async function testAgentLabel(agentId: string, userId: string, description: string, userEmail?: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentData = agent.data as any;
    const emails = agentData?.emails || [];

    if (emails.length === 0) {
        return { matches: [], total: 0 };
    }

    const { evaluateCustomRule } = await import("@/lib/label-learning/pattern-extractor");
    const customRules: any[] = [];
    const lowerDesc = description.toLowerCase();

    // Pattern extraction logic (simplified from the API route for now)
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const extractedEmails = description.match(emailRegex) || [];

    if (extractedEmails.length > 0) {
        for (const email of extractedEmails) {
            if (lowerDesc.includes(`from ${email.toLowerCase()}`)) {
                customRules.push({
                    id: `rule_from_${Date.now()}_${email}`,
                    type: 'from_contains',
                    description: `From ${email}`,
                    value: email,
                    weight: 1.0,
                    enabled: true,
                });
            }
        }
    }

    if (lowerDesc.includes("to myself") || lowerDesc.includes("to me")) {
        customRules.push({
            id: `rule_to_myself_${Date.now()}`,
            type: 'sender_equals_recipient',
            description: "Emails to myself",
            weight: 1.0,
            enabled: true,
        });
    }

    const matches: any[] = [];
    const threshold = 0.5;

    for (const email of emails.slice(0, 200)) {
        let confidence = 0;
        let reasons: string[] = [];

        if (customRules.length > 0 && userEmail) {
            for (const rule of customRules) {
                if (evaluateCustomRule(email, rule, userEmail)) {
                    confidence += rule.weight;
                    reasons.push(rule.description);
                }
            }
        }

        // Keyword fallback
        if (confidence === 0) {
            const keywords = description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const emailText = `${email.subject || ''} ${email.snippet || ''}`.toLowerCase();
            let keywordMatches = 0;
            for (const keyword of keywords) {
                if (emailText.includes(keyword)) {
                    keywordMatches++;
                    reasons.push(`"${keyword}"`);
                }
            }
            if (keywords.length > 0) {
                confidence = keywordMatches / keywords.length;
            }
        }

        if (confidence >= threshold) {
            matches.push({
                id: email.id,
                subject: email.subject,
                from: email.from,
                snippet: email.snippet || email.body?.substring(0, 100),
                confidence: Math.round(confidence * 100),
                reasons: reasons.join(", "),
            });
        }
    }

    return {
        matches: matches.sort((a, b) => b.confidence - a.confidence).slice(0, 10),
        total: matches.length,
    };
}

export async function suggestAgentLabels(agentId: string, userId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentData = agent.data as any;
    const emails = agentData?.emails || [];

    if (emails.length < 5) return { suggestions: [] };

    // Placeholder logic for suggestions
    // In reality, this would use LLM or clustering
    return {
        suggestions: [
            {
                name: "Work",
                description: "Emails from professional domains",
                estimatedCount: 5,
                sampleEmails: emails.slice(0, 2),
            }
        ]
    };
}
