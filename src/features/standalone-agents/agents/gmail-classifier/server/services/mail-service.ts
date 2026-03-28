import prisma from "@/lib/db";
import { Groq } from "groq-sdk";
import { refreshAccessToken } from "@/lib/gmail/oauth";
import { createActivityLog, saveActivityLog } from "@/lib/activity-history";
import { sanitizeEmailHeader } from "@/lib/security/input-validation";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export async function generateDraft(agentId: string, userId: string, emailId: string, intent: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const knowledgeBase = config?.knowledgeBase || [];
    const { getValidAccessToken } = await import("./token-service");
    const accessToken = await getValidAccessToken(agentId);
    if (!accessToken) throw new Error("Gmail not connected");

    const fetchEmail = async (token: string) => {
        const url = `${GMAIL_API_BASE}/users/me/messages/${emailId}?format=full`;
        return fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
    };

    const response = await fetchEmail(accessToken);

    if (!response.ok) {
        throw new Error(`Gmail API error: ${await response.text()}`);
    }

    const gmailData = await response.json();

    const getHeader = (name: string) =>
        gmailData.payload?.headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const subject = getHeader("Subject");
    const from = getHeader("From");

    let bodyText = "";
    const findTextBody = (part: any) => {
        if (part.mimeType === "text/plain" && part.body?.data) {
            const base64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
            bodyText = Buffer.from(base64, "base64").toString("utf-8");
        } else if (part.parts) {
            part.parts.forEach(findTextBody);
        }
    };

    if (gmailData.payload?.body?.data) {
        const base64 = gmailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
        bodyText = Buffer.from(base64, "base64").toString("utf-8");
    } else if (gmailData.payload?.parts) {
        gmailData.payload.parts.forEach(findTextBody);
    }

    const kbContext = knowledgeBase.length > 0
        ? `\nKNOWLEDGE BASE CONTEXT:\n${knowledgeBase.map((k: any) => `- ${k.content}`).join('\n')}`
        : "";

    const intentInstructions: Record<string, string> = {
        "positive": "Generate a warm, professional, and positive reply. Agree to the request, confirm the meeting, or acknowledge the news with enthusiasm and helpfulness.",
        "decline": "Generate a polite, firm, and professional decline. Provide a brief, neutral reason if possible, and thank them for the reach-out. Maintain the relationship while saying no.",
        "quick_ack": "Generate a concise acknowledgement. Use phrases like 'Got it, thanks for letting me know', 'Confirmed, I will look into this', or 'Thanks for the update'.",
        "full_reply": "Analyze the entire email and generate a comprehensive, professional response that addresses every point or question raised by the sender.",
        "default": "Analyze the email and generate a professional, appropriate reply that addresses the sender's points."
    };

    const instruction = intentInstructions[intent] || intentInstructions.default;

    const personaContext = config?.brain?.persona?.raw
        ? `\nUSER VOICE PREFERENCE (Strictly follow this style and tone):\n"${config.brain.persona.raw}"`
        : "";

    const systemPrompt = `You are a world-class executive assistant. Your task is to draft a perfect reply to an email.
    
    INSTRUCTIONS FOR THIS SPECIFIC REPLY:
    ${instruction}
    ${personaContext}

    GENERAL RULES:
    1. TONE: Professional, context-aware, and concise. Avoid fluffy openers.
    2. FORMAT: Return ONLY the drafted text for the email body.
    3. NO SIGNATURES: Do not include "Best regards," or your name. The user will add their own.
    4. PERSONALIZE: Use the sender's name if you can find it.
    5. DATA: If the email mentions dates, prices, or specific items, address them directly.
    6. PLACEHOLDERS: Use [brackets] only if information is absolutely missing and required.

    ${kbContext}`;

    const userPrompt = `ORIGINAL EMAIL:
    From: ${from}
    Subject: ${subject}
    Content:
    ${bodyText.substring(0, 4000)}`;

    const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
    });

    const draft = completion.choices[0].message.content?.trim() || "";

    const cleanedDraft = draft
        .replace(/^(Subject|Body|Draft|Message):\s*/i, "")
        .replace(/^["']([\s\S]*)["']$/, "$1")
        .trim();

    return {
        draft: cleanedDraft,
        originalSubject: subject,
        originalFrom: from,
    };
}

export async function sendEmail(agentId: string, userId: string, data: any) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const agentConfig = agent.config as any;
    const { getValidAccessToken } = await import("./token-service");
    const accessToken = await getValidAccessToken(agentId);

    if (!accessToken) throw new Error("Gmail not connected");

    const userEmail = agentConfig?.email;

    const { to, subject, body, threadId, inReplyTo, references } = data;

    const mimeMessage = createMimeMessage({
        to,
        subject,
        body,
        from: userEmail,
        inReplyTo,
        references,
    });

    const encodedMessage = Buffer.from(mimeMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const requestBody: any = { raw: encodedMessage };
    if (threadId) requestBody.threadId = threadId;

    const fetchSend = async (token: string) => {
        return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
    };

    const response = await fetchSend(accessToken);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to send email');
    }

    const result = await response.json();

    const log = createActivityLog(
        'automation',
        'Email Sent',
        `To: ${to}, Subject: "${subject}"`,
        'success',
        { tool: 'gmail', messageId: result.id, threadId: result.threadId }
    );
    await saveActivityLog(prisma, agentId, log);

    return {
        success: true,
        messageId: result.id,
        threadId: result.threadId,
    };
}

function createMimeMessage({
    to,
    subject,
    body,
    from,
    inReplyTo,
    references,
}: {
    to: string;
    subject: string;
    body: string;
    from: string;
    inReplyTo?: string;
    references?: string;
}) {
    let message = [
        `From: ${sanitizeEmailHeader(from)}`,
        `To: ${sanitizeEmailHeader(to)}`,
        `Subject: ${sanitizeEmailHeader(subject)}`,
    ];

    if (inReplyTo) message.push(`In-Reply-To: ${sanitizeEmailHeader(inReplyTo)}`);
    if (references) message.push(`References: ${sanitizeEmailHeader(references)}`);

    message.push(`MIME-Version: 1.0`);
    message.push(`Content-Type: text/html; charset=UTF-8`);
    message.push(`Content-Transfer-Encoding: 7bit`);
    message.push(``);
    message.push(body);

    return message.join('\r\n');
}
