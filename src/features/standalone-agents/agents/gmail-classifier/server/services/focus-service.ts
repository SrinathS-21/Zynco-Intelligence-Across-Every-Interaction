import prisma from "@/lib/db";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function getAgentFocusPreferences(agentId: string, userId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    return {
        preferences: config?.focusPreferences?.raw || "",
        updatedAt: config?.focusPreferences?.updatedAt || null
    };
}

export async function updateAgentFocusPreferences(agentId: string, userId: string, preferences: string, returnOnly: boolean = false) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    let extractedRules = {
        highPriorityKeywords: [] as string[],
        highPrioritySenders: [] as string[],
        lowPriorityKeywords: [] as string[],
        lowPrioritySenders: [] as string[],
    };

    if (preferences.trim()) {
        const prompt = `You are an AI data extractor. Given a user's natural language email focus preferences, extract structured rules to prioritize their inbox.
        
        USER PREFERENCES:
        "${preferences}"
        
        Extract:
        1. highPriorityKeywords: Words or phrases that indicate an important email (e.g. "Project X", "Urgent", "Invoice"). Remove any markdown bolding like **.
        2. highPrioritySenders: Email domains, specific email addresses, or name fragments mentioned as important (e.g. "vimal", "@acme.com", "boss@work.com").
        3. lowPriorityKeywords: Words that indicate noise or low importance.
        4. lowPrioritySenders: Domains or addresses to deprioritize.
        
        Return ONLY raw JSON.`;

        try {
            const completion = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" },
            });

            const content = completion.choices?.[0]?.message?.content;
            const result = content ? JSON.parse(content) : {};
            extractedRules = {
                highPriorityKeywords: Array.isArray(result.highPriorityKeywords) ? result.highPriorityKeywords.map((s: string) => s.toLowerCase()) : [],
                highPrioritySenders: Array.isArray(result.highPrioritySenders) ? result.highPrioritySenders.map((s: string) => s.toLowerCase()) : [],
                lowPriorityKeywords: Array.isArray(result.lowPriorityKeywords) ? result.lowPriorityKeywords.map((s: string) => s.toLowerCase()) : [],
                lowPrioritySenders: Array.isArray(result.lowPrioritySenders) ? result.lowPrioritySenders.map((s: string) => s.toLowerCase()) : [],
            };
        } catch (err) {
            console.error("LLM extraction failed:", err);
        }
    }

    if (returnOnly) {
        return { success: true, rules: extractedRules };
    }

    const currentConfig = agent.config as any;
    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...currentConfig,
                focusPreferences: {
                    raw: preferences,
                    rules: extractedRules,
                    updatedAt: new Date().toISOString()
                }
            },
            data: {
                ...(agent.data as any || {}),
                focusCache: null
            }
        }
    });

    return { success: true, rules: extractedRules };
}

export async function getAgentFocusEmails(agentId: string, userId: string, forceRefresh: boolean = false) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const focusPrefs = config?.focusPreferences;
    const focusRules = focusPrefs?.rules;

    // If no focus preferences have been set, return empty focus section
    if (!focusPrefs?.raw || !focusPrefs.raw.trim()) {
        return {
            total: 0,
            focused: 0,
            handled: 0,
            categories: {
                urgent: { count: 0, emails: [] },
                timeSensitive: { count: 0, emails: [] },
                followUp: { count: 0, emails: [] },
                important: { count: 0, emails: [] },
            },
            allEmails: []
        };
    }

    const agentData = (agent.data as any) || {};
    const emails = (agentData.emails || []) as any[];

    const categories = {
        urgent: { count: 0, emails: [] as any[] },
        timeSensitive: { count: 0, emails: [] as any[] },
        followUp: { count: 0, emails: [] as any[] },
        important: { count: 0, emails: [] as any[] },
    };

    const allFocused: any[] = [];

    emails.forEach(email => {
        let focusCategory: 'urgent' | 'time-sensitive' | 'follow-up' | 'important' | null = null;
        let focusReason = "";
        let isMatch = false;

        const subject = (email.subject || "").toLowerCase();
        const from = (email.from || "").toLowerCase();
        const snippet = (email.snippet || "").toLowerCase();
        const content = `${subject} ${snippet}`;

        // Match based on AI-extracted rules from preferences
        if (focusRules) {
            // Check high priority senders
            const matchedSender = focusRules.highPrioritySenders?.find((s: string) => {
                const cleanS = s.toLowerCase().replace(/\*\*|\*/g, '').trim();
                return from.includes(cleanS);
            });
            if (matchedSender) {
                isMatch = true;
                focusReason = `Matches preferred sender: ${matchedSender}`;
            }

            // Check high priority keywords
            if (!isMatch && focusRules.highPriorityKeywords) {
                const matchedKeyword = focusRules.highPriorityKeywords.find((kw: string) => {
                    const cleanKw = kw.toLowerCase().replace(/\*\*|\*/g, '').trim();
                    if (!cleanKw) return false;

                    // Boundary check for words
                    const regex = new RegExp(`\\b${cleanKw}\\b`, 'i');
                    return regex.test(content);
                });

                if (matchedKeyword) {
                    isMatch = true;
                    focusReason = `Matches preferred interest: ${matchedKeyword}`;
                }
            }

            // Fallback: If the raw text is very specific and we didn't match keywords,
            // check if the from name literally matches the raw input's intent.
            // e.g. "from vimal" -> check if 'vimal' is in the from field.
            if (!isMatch && focusPrefs.raw.toLowerCase().includes('from ')) {
                const intentMatch = focusPrefs.raw.toLowerCase().match(/from\s+([^\s,.]+)/);
                if (intentMatch && intentMatch[1]) {
                    const name = intentMatch[1].replace(/\*\*|\*/g, '').toLowerCase();
                    if (from.includes(name)) {
                        isMatch = true;
                        focusReason = `Matches focus intent: From ${name}`;
                    }
                }
            }
        }

        // If it matches user preferences, decide the category
        if (isMatch) {
            if (email.smartLevel === 'critical' || email.category === 'requires_action') {
                focusCategory = 'urgent';
            } else if (email.isUrgent) {
                focusCategory = 'time-sensitive';
            } else if (email.category === 'follow_up') {
                focusCategory = 'follow-up';
            } else {
                focusCategory = 'important';
            }

            if (!focusReason) {
                focusReason = email.reasoning || email.suggestedAction || "Matches your focus preferences";
            }

            const focusEmail = {
                id: email.id,
                from: email.from,
                subject: email.subject,
                snippet: email.snippet,
                date: email.date,
                isRead: email.isRead,
                focusScore: email.smartScore || 70,
                focusCategory,
                focusReason
            };

            if (focusCategory === 'urgent') categories.urgent.count++, categories.urgent.emails.push(focusEmail);
            if (focusCategory === 'time-sensitive') categories.timeSensitive.count++, categories.timeSensitive.emails.push(focusEmail);
            if (focusCategory === 'follow-up') categories.followUp.count++, categories.followUp.emails.push(focusEmail);
            if (focusCategory === 'important') categories.important.count++, categories.important.emails.push(focusEmail);

            allFocused.push(focusEmail);
        }
    });

    return {
        total: emails.length,
        focused: allFocused.length,
        handled: emails.length - allFocused.length,
        categories,
        allEmails: allFocused
    };
}
