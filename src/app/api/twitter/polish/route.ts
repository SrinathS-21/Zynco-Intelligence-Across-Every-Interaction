import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const GROQ_CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const requestSchema = z.object({
    text: z.string().trim().min(1).max(1200),
});

function normalizeApiKey(input: string | undefined | null) {
    if (!input) return "";
    return input.trim().replace(/^['\"]|['\"]$/g, "");
}

function normalizeTweetText(input: string) {
    return input.replace(/\s+/g, " ").trim();
}

function clampTweetLength(input: string) {
    if (input.length <= 280) return input;
    return `${input.slice(0, 277).trimEnd()}...`;
}

function sanitizeModelOutput(input: string) {
    const trimmed = input.trim();
    const unquoted = trimmed.replace(/^"|"$/g, "").trim();
    return clampTweetLength(normalizeTweetText(unquoted));
}

function fallbackPolish(text: string) {
    const normalized = normalizeTweetText(text);
    if (!normalized) return "";
    const polished = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return clampTweetLength(polished);
}

export async function POST(request: NextRequest) {
    try {
        await requireUser(request);

        const parsed = requestSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "text is required" }, { status: 400 });
        }

        const originalText = parsed.data.text;
        const groqApiKey = normalizeApiKey(process.env.GROQ_API_KEY || "");

        if (!groqApiKey) {
            const fallbackText = fallbackPolish(originalText);
            return NextResponse.json({
                polishedText: fallbackText,
                provider: "fallback",
                warning: "GROQ_API_KEY is missing. Used fallback polishing.",
            });
        }

        const response = await fetch(GROQ_CHAT_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${groqApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                temperature: 0.35,
                max_tokens: 220,
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a Twitter/X writing assistant. Rewrite the user's tweet to be clearer, tighter, and more engaging while preserving intent and factual meaning. Keep mentions, links, hashtags, and numbers accurate. Output only the final tweet text. Maximum 280 characters.",
                    },
                    {
                        role: "user",
                        content: originalText,
                    },
                ],
            }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const message =
                payload && typeof payload === "object" && typeof (payload as { error?: { message?: string } }).error?.message === "string"
                    ? (payload as { error: { message: string } }).error.message
                    : "Failed to polish tweet with Groq";
            return NextResponse.json({ error: message }, { status: response.status || 500 });
        }

        const modelOutput =
            payload
                && typeof payload === "object"
                && Array.isArray((payload as { choices?: Array<{ message?: { content?: string } }> }).choices)
                && typeof (payload as { choices: Array<{ message?: { content?: string } }> }).choices[0]?.message?.content === "string"
                ? (payload as { choices: Array<{ message?: { content?: string } }> }).choices[0].message?.content || ""
                : "";

        const polishedText = sanitizeModelOutput(modelOutput || originalText);

        if (!polishedText) {
            return NextResponse.json({ error: "Failed to polish tweet text" }, { status: 502 });
        }

        return NextResponse.json({
            polishedText,
            provider: "groq",
            changed: polishedText !== originalText,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to polish tweet" },
            { status: 500 },
        );
    }
}
