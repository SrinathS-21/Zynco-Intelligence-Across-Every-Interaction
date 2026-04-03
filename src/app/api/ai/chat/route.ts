import { NextResponse } from "next/server";
import { z } from "zod";

type ChatRole = "user" | "assistant";

const schema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .optional()
    .default([]),
});

function fallbackReply(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("report") || lower.includes("performance")) {
    return "I can generate a cross-platform performance snapshot. Top quick view: engagement is trending up, and WhatsApp follow-ups look like the highest leverage action right now. Ask for a detailed breakdown by platform and time range.";
  }

  if (lower.includes("lead") || lower.includes("pipeline") || lower.includes("prioritize")) {
    return "I can help prioritize leads by intent, recency, and engagement. Share the segment you care about (WhatsApp, Instagram, LinkedIn), and I will rank them with a clear action plan.";
  }

  if (lower.includes("automation") || lower.includes("status") || lower.includes("running")) {
    return "I can summarize automation health, trigger counts, and bottlenecks. If you want, ask me for a status report focused on failures and delayed workflows.";
  }

  if (lower.includes("whatsapp") || lower.includes("instagram") || lower.includes("linkedin")) {
    return "I can summarize activity for that platform and suggest your best next actions. Tell me the platform and whether you want insights, reply drafts, or task prioritization.";
  }

  return "I am ready to help with reports, lead prioritization, automation health, and cross-platform activity summaries. Ask me a specific question and I will give you a focused answer.";
}

function mapHistory(history: Array<{ role: ChatRole; content: string }>) {
  return history.slice(-8).map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request payload" },
        { status: 400 },
      );
    }

    const { message, history } = parsed.data;
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json({ reply: fallbackReply(message), source: "fallback" });
    }

    const systemPrompt =
      "You are Zynco AI, a concise cross-platform orchestration assistant. Provide practical responses for social channels and messaging operations. Use short sections and clear actions. Avoid fabricating hard metrics unless the user provides them.";

    const messages = [
      { role: "system", content: systemPrompt },
      ...mapHistory(history),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Chat API provider error:", body);
      return NextResponse.json({ reply: fallbackReply(message), source: "fallback" });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({ reply: fallbackReply(message), source: "fallback" });
    }

    return NextResponse.json({ reply, source: "model" });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { reply: "I hit a temporary issue while processing that. Please try again in a moment.", source: "error" },
      { status: 500 },
    );
  }
}
