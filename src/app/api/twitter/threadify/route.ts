import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const GROQ_CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const requestSchema = z.object({
    text: z.string().trim().min(1).max(8000),
});

function normalizeApiKey(input: string | undefined | null) {
    if (!input) return "";
    return input.trim().replace(/^['\"]|['\"]$/g, "");
}

function normalizeTweetText(input: string) {
    return input.replace(/\s+/g, " ").trim();
}

function splitLongChunkByWords(text: string, maxChars: number) {
    const words = normalizeTweetText(text).split(" ").filter(Boolean);
    const chunks: string[] = [];
    let current = "";

    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxChars) {
            current = candidate;
            return;
        }

        if (current) {
            chunks.push(current);
            current = word;
            return;
        }

        // Single token exceeds max length; hard split.
        for (let i = 0; i < word.length; i += maxChars) {
            chunks.push(word.slice(i, i + maxChars));
        }
        current = "";
    });

    if (current) {
        chunks.push(current);
    }

    return chunks;
}

function fallbackThreadify(text: string) {
    const normalized = normalizeTweetText(text);
    if (!normalized) return [];
    if (normalized.length <= 280) return [normalized];

    const maxChars = 260;
    const sentences = normalized
        .split(/(?<=[.!?])\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    let current = "";

    sentences.forEach((sentence) => {
        if (!sentence) return;

        const candidate = current ? `${current} ${sentence}` : sentence;
        if (candidate.length <= maxChars) {
            current = candidate;
            return;
        }

        if (current) {
            chunks.push(current);
            current = "";
        }

        if (sentence.length > maxChars) {
            chunks.push(...splitLongChunkByWords(sentence, maxChars));
        } else {
            current = sentence;
        }
    });

    if (current) {
        chunks.push(current);
    }

    if (chunks.length <= 1) {
        return splitLongChunkByWords(normalized, maxChars);
    }

    return chunks;
}

function ensureTweetLengthLimit(tweets: string[]) {
    const next: string[] = [];

    tweets.forEach((tweet) => {
        const cleaned = normalizeTweetText(tweet);
        if (!cleaned) return;

        if (cleaned.length <= 280) {
            next.push(cleaned);
            return;
        }

        next.push(...splitLongChunkByWords(cleaned, 280));
    });

    return next.filter(Boolean);
}

function parseGroqThreadifyResponse(content: string) {
    const direct = content.trim();
    const jsonBlockMatch = direct.match(/\{[\s\S]*\}/);
    const rawJson = jsonBlockMatch ? jsonBlockMatch[0] : direct;

    const parsed = JSON.parse(rawJson) as { tweets?: unknown };
    if (!parsed || !Array.isArray(parsed.tweets)) {
        return [];
    }

    return parsed.tweets
        .map((item) => String(item || "").trim())
        .filter(Boolean);
}

async function groqThreadify(text: string, apiKey: string) {
    const response = await fetch(GROQ_CHAT_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.35,
            max_tokens: 900,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content:
                        "You are a Twitter/X thread editor. Convert long content into a high-quality tweet thread. Preserve intent and factual meaning. Return strict JSON only in the shape: {\"tweets\":[\"...\",\"...\"]}. Each tweet must be under 280 characters.",
                },
                {
                    role: "user",
                    content: `Create a concise, engaging tweet thread from this text:\n\n${text}`,
                },
            ],
        }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload && typeof payload === "object" && typeof (payload as { error?: { message?: string } }).error?.message === "string"
                ? (payload as { error: { message: string } }).error.message
                : "Failed to generate thread with Groq";
        throw new Error(message);
    }

    const content =
        payload
            && typeof payload === "object"
            && Array.isArray((payload as { choices?: Array<{ message?: { content?: string } }> }).choices)
            && typeof (payload as { choices: Array<{ message?: { content?: string } }> }).choices[0]?.message?.content === "string"
            ? (payload as { choices: Array<{ message?: { content?: string } }> }).choices[0].message?.content || ""
            : "";

    if (!content.trim()) {
        throw new Error("Thread generation returned empty response");
    }

    return parseGroqThreadifyResponse(content);
}

export async function POST(request: NextRequest) {
    try {
        await requireUser(request);

        const parsed = requestSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "text is required" }, { status: 400 });
        }

        const originalText = normalizeTweetText(parsed.data.text);
        if (!originalText) {
            return NextResponse.json({ error: "text is required" }, { status: 400 });
        }

        if (originalText.length <= 280) {
            return NextResponse.json({ tweets: [originalText], provider: "direct" });
        }

        const groqApiKey = normalizeApiKey(process.env.GROQ_API_KEY || "");
        let tweets: string[] = [];
        let provider = "fallback";

        if (groqApiKey) {
            try {
                tweets = await groqThreadify(originalText, groqApiKey);
                provider = "groq";
            } catch {
                tweets = [];
            }
        }

        if (tweets.length === 0) {
            tweets = fallbackThreadify(originalText);
        }

        tweets = ensureTweetLengthLimit(tweets);

        if (tweets.length <= 1 && originalText.length > 280) {
            tweets = ensureTweetLengthLimit(fallbackThreadify(originalText));
            provider = "fallback";
        }

        if (tweets.length === 0) {
            return NextResponse.json({ error: "Failed to build tweet thread" }, { status: 500 });
        }

        return NextResponse.json({ tweets, provider, count: tweets.length });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to build tweet thread" },
            { status: 500 },
        );
    }
}
