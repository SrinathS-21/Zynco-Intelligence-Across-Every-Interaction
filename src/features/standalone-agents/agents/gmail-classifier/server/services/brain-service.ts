import prisma from "@/lib/db";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function getAgentBrainSettings(agentId: string, userId: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const brain = config?.brain || {};

    // Check if we need to migrate/fetch focus preferences
    if (!brain.focus?.raw && config?.focusPreferences?.raw) {
        brain.focus = {
            raw: config.focusPreferences.raw,
            updatedAt: config.focusPreferences.updatedAt
        };
    }

    return brain;
}

export async function updateAgentBrainSettings(agentId: string, userId: string, type: string, content: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const currentConfig = (agent.config as any) || {};
    const brain = currentConfig.brain || {};
    let updatedBrain = { ...brain };

    if (type === 'silence') {
        const prompt = `Convert the following natural language "Email Silence Rule" into structured JSON.
        RULE: "${content}"
        
        Extract:
        1. keywords: Array of keywords to block/suppress (lowercase)
        2. blockLinks: Boolean, if any email with a link should be suppressed
        3. blockSuspicious: Boolean, if emails looking like spam/phishing should be suppressed
        4. blockCategories: Array of standard categories to hide (promotional, updates, newsletters, news)
        
        Return ONLY raw JSON.`;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
        updatedBrain.silence = {
            raw: content,
            compiled: {
                keywords: Array.isArray(result.keywords) ? result.keywords.map((k: string) => k.toLowerCase()) : [],
                blockLinks: !!result.blockLinks,
                blockSuspicious: !!result.blockSuspicious,
                blockCategories: Array.isArray(result.blockCategories) ? result.blockCategories : [],
            },
            updatedAt: new Date().toISOString()
        };
    } else if (type === 'persona') {
        updatedBrain.persona = {
            raw: content,
            updatedAt: new Date().toISOString()
        };
    } else if (type === 'focus') {
        updatedBrain.focus = {
            raw: content,
            updatedAt: new Date().toISOString()
        };

        // Extract rules using the focus-service logic but return them instead of updating DB
        const { updateAgentFocusPreferences } = await import('./focus-service');
        const focusResult = await updateAgentFocusPreferences(agentId, userId, content, true); // Added returnOnly flag

        // Merge focusPreferences into the config we're about to write
        currentConfig.focusPreferences = {
            raw: content,
            rules: focusResult.rules,
            updatedAt: new Date().toISOString()
        };
    } else if (type === 'automation_magic') {
        const prompt = `You are a rule constructor. Extract structured automation rules from this natural language command.
        COMMAND: "${content}"
        
        Return an array of rules in this EXACT format:
        {
            "rules": [
                {
                    "name": "Short descriptive name",
                    "conditions": [{ "field": "category|subject|body|sender", "operator": "equals|contains|starts_with", "value": "..." }],
                    "action": { 
                        "type": "create_jira_task|save_to_notion|send_slack_message", 
                        "config": { "slackChannelId": "Use channel ID if specified, else leave empty" } 
                    }
                }
            ]
        }
        
        Return ONLY raw JSON.`;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
        return { success: true, suggestedRules: result.rules || [] };
    }

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            config: {
                ...currentConfig,
                brain: updatedBrain
            }
        }
    });

    return { success: true, brain: updatedBrain };
}
