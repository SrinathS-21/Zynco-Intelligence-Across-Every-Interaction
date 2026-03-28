import prisma from "@/lib/db";
import { fetchGmailEmails } from "@/lib/gmail/client";
import { refreshAccessToken } from "@/lib/gmail/oauth";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface EmailForAnalysis {
    id: string;
    from: string;
    subject: string;
    date: string;
    category: string;
    priority: string;
    isRead: boolean;
    snippet: string;
}

function generatePrompt(emails: EmailForAnalysis[]): string {
    const emailList = emails.map(e =>
        `[ID:${e.id}|F:${e.from}|S:${e.subject}|D:${e.date}|C:${e.category}|P:${e.priority}|R:${e.isRead}|T:${e.snippet}]`
    ).join('\n');

    return `You are an email productivity assistant. Analyze these emails from the last 24 hours and provide insights.

EMAILS:
${emailList}

TASK:
Analyze and provide:

1. REPLIED_TO: List of email IDs that appear to have been replied to (look for "Re:" in subject or follow-up patterns)
2. PENDING_REPLY: List of email IDs needing replies with urgency (high/medium/low) and reason
3. IMPORTANT_MISSED: List of email IDs that are important but unread, with reason
4. FORGOTTEN_FOLLOWUPS: List of email IDs that are follow-ups the user might have forgotten, with context
5. PRODUCTIVITY_SCORE: Rate 1-10 based on response rate and email management
6. RECOMMENDATIONS: Top 3 specific, actionable items (not generic advice)

FORMAT YOUR RESPONSE AS JSON:
{
  "repliedTo": ["id1", "id2"],
  "pendingReply": [
    { "id": "id3", "urgency": "high", "reason": "Client waiting for response" }
  ],
  "importantMissed": [
    { "id": "id4", "reason": "Contains action items" }
  ],
  "forgottenFollowups": [
    { "id": "id5", "context": "Follow-up from 3 days ago" }
  ],
  "productivityScore": 7,
  "recommendations": ["Reply to client proposal", "Confirm meeting", "Review invoice"]
}`;
}

export async function getAgentDailyDigest(agentId: string, userId: string, forceRefresh: boolean = false) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    const agentData = agent.data as any || {};
    let accessToken = agentConfig?.accessToken;

    if (!accessToken) throw new Error("Gmail not connected");

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const formattedDate = oneDayAgo.toISOString().split('T')[0];
    const dateQuery = `after:${formattedDate}`;

    let gmailEmails: any[] = [];
    try {
        const result = await fetchGmailEmails(accessToken, {
            maxResults: 30,
            labelIds: ["INBOX"],
            query: dateQuery,
        });
        gmailEmails = result.emails;
    } catch (error: any) {
        if (error.code === 401 || (error.message && error.message.includes("401"))) {
            const refreshToken = agentConfig?.refreshToken;
            if (!refreshToken) throw new Error("Gmail authentication expired");

            const newTokens = await refreshAccessToken(refreshToken);
            accessToken = newTokens.access_token;

            await prisma.standaloneAgent.update({
                where: { id: agentId },
                data: {
                    config: {
                        ...agentConfig,
                        accessToken: newTokens.access_token,
                        tokenExpiresAt: newTokens.expires_in
                            ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
                            : agentConfig.tokenExpiresAt
                    }
                }
            });

            const result = await fetchGmailEmails(accessToken, {
                maxResults: 30,
                labelIds: ["INBOX"],
                query: dateQuery,
            });
            gmailEmails = result.emails;
        } else {
            throw error;
        }
    }

    const fingerprint = gmailEmails.length > 0
        ? `${gmailEmails[0].id}_${gmailEmails.length}`
        : "empty";

    const cachedDigest = agentData.lastDigest;
    const cacheAge = cachedDigest ? (Date.now() - new Date(cachedDigest.cachedAt).getTime()) : Infinity;
    const isCacheValid = cachedDigest && cachedDigest.fingerprint === fingerprint && cacheAge < 4 * 60 * 60 * 1000;

    if (!forceRefresh && isCacheValid) {
        return {
            ...cachedDigest.data,
            isCached: true,
            cachedAt: cachedDigest.cachedAt
        };
    }

    if (gmailEmails.length === 0) {
        return {
            date: new Date().toISOString().split("T")[0],
            totalEmails: 0,
            repliedTo: 0,
            pendingReply: 0,
            important: 0,
            forgotten: 0,
            productivityScore: 0,
            insights: {
                repliedEmails: [],
                pendingEmails: [],
                importantEmails: [],
                forgottenEmails: [],
            },
            recommendations: ["No emails received in the last 24 hours"],
        };
    }

    const emailsForAnalysis: EmailForAnalysis[] = gmailEmails.map(e => ({
        id: e.id,
        from: e.from || "Unknown",
        subject: e.subject || "No subject",
        date: e.date || new Date().toISOString(),
        category: e.category || "unknown",
        priority: e.priority || "normal",
        isRead: e.isRead || false,
        snippet: e.snippet ? e.snippet.substring(0, 200) : "",
    }));

    const prompt = generatePrompt(emailsForAnalysis);
    let aiResponse: any;
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });
        aiResponse = JSON.parse(completion.choices[0].message.content || "{}");
    } catch (error: any) {
        if (error.status === 429 && cachedDigest) {
            return {
                ...cachedDigest.data,
                isCached: true,
                cachedAt: cachedDigest.cachedAt,
                rateLimited: true
            };
        }
        throw error;
    }

    const digest = {
        date: new Date().toISOString().split("T")[0],
        totalEmails: gmailEmails.length,
        repliedTo: aiResponse.repliedTo?.length || 0,
        pendingReply: aiResponse.pendingReply?.length || 0,
        important: aiResponse.importantMissed?.length || 0,
        forgotten: aiResponse.forgottenFollowups?.length || 0,
        productivityScore: aiResponse.productivityScore || 5,
        insights: {
            repliedEmails: aiResponse.repliedTo || [],
            pendingEmails: aiResponse.pendingReply || [],
            importantEmails: aiResponse.importantMissed || [],
            forgottenEmails: aiResponse.forgottenFollowups || [],
        },
        recommendations: aiResponse.recommendations || [],
    };

    await prisma.standaloneAgent.update({
        where: { id: agentId },
        data: {
            data: {
                ...agentData,
                lastDigest: {
                    fingerprint,
                    cachedAt: new Date().toISOString(),
                    data: digest
                }
            }
        }
    });

    return {
        ...digest,
        isCached: false,
        cachedAt: new Date().toISOString()
    };
}
