import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const chatSourceSchema = z.enum(["instagram", "linkedin", "email", "whatsapp", "automation", "twitter"]);

type ChatSource = z.infer<typeof chatSourceSchema>;
type ChatRole = "user" | "assistant";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  source: chatSourceSchema.optional().default("automation"),
  context: z.string().trim().max(6000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .optional()
    .default([]),
});

const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = `${(process.env.GROQ_BASE_URL || "https://api.groq.com").replace(/\/$/, "")}/openai/v1/chat/completions`;
const GROQ_TIMEOUT_MS = 25_000;
const GROQ_ENV_FILES = [".env.local", ".env"];

let groqKeyCache: { keys: string[]; loadedAt: number } | null = null;

function normalizeApiKey(input: string | undefined | null) {
  if (!input) return "";
  return input.trim().replace(/^['"]|['"]$/g, "");
}

function parseGroqKeysFromEnv(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.startsWith("GROQ_API_KEY="))
    .map((line) => normalizeApiKey(line.slice("GROQ_API_KEY=".length)))
    .filter(Boolean);
}

function dedupeKeys(values: string[]) {
  const seen = new Set<string>();
  const keys: string[] = [];

  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      keys.push(value);
    }
  });

  return keys;
}

async function loadGroqKeysFromEnvFiles() {
  const candidates: string[] = [];

  for (const fileName of GROQ_ENV_FILES) {
    const fullPath = path.join(process.cwd(), fileName);
    try {
      const content = await readFile(fullPath, "utf8");
      candidates.push(...parseGroqKeysFromEnv(content));
    } catch {
      // Ignore missing/unreadable local env files.
    }
  }

  return dedupeKeys(candidates);
}

async function getGroqApiKeyCandidates() {
  const now = Date.now();
  if (groqKeyCache && now - groqKeyCache.loadedAt < 60_000) {
    return groqKeyCache.keys;
  }

  const processKey = normalizeApiKey(process.env.GROQ_API_KEY || "");
  const fileKeys = await loadGroqKeysFromEnvFiles();
  const ordered = process.env.NODE_ENV === "production"
    ? dedupeKeys([processKey, ...fileKeys].filter(Boolean))
    : dedupeKeys([...fileKeys, processKey].filter(Boolean));

  groqKeyCache = { keys: ordered, loadedAt: now };
  return ordered;
}

function isInvalidGroqKeyResponse(status: number, body: string) {
  if (status === 401) return true;
  return /invalid_api_key|invalid api key/i.test(body);
}

async function callGroqChat(messages: Array<{ role: string; content: string }>, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    return await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_GROQ_MODEL,
        messages,
        temperature: 0.35,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function readContextValue(context: string | undefined, label: string) {
  if (!context) return "";
  const line = context
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));

  if (!line) return "";
  return line.slice(label.length + 1).trim();
}

function fallbackEmailDraft(input: string) {
  const asksDelay = /delay|postpone|late/.test(input.toLowerCase());

  if (asksDelay) {
    return [
      "Subject: Quick update on timeline and next steps",
      "",
      "Hi [Client Name],",
      "",
      "I want to share a transparent update: we need an additional two business days to finalize the current deliverable.",
      "I apologize for the delay and appreciate your patience.",
      "",
      "Revised timeline:",
      "- Updated delivery date: [New Date]",
      "- Internal QA completion: [Date - 1 day]",
      "",
      "Next steps from our side:",
      "- Final validation on the remaining items",
      "- Share the complete handoff package and walkthrough notes",
      "- Confirm implementation support window",
      "",
      "If this revised timeline creates any issue, I can propose an alternate milestone split today.",
      "",
      "Best regards,",
      "[Your Name]",
    ].join("\n");
  }

  return [
    "Subject: Draft email",
    "",
    "Hi [Recipient Name],",
    "",
    "Here is a concise update from my side.",
    "",
    "Key points:",
    "- [Point 1]",
    "- [Point 2]",
    "- [Requested action / next step]",
    "",
    "Regards,",
    "[Your Name]",
  ].join("\n");
}

function fallbackWhatsappDraft() {
  return [
    "Hi [Lead Name], just checking in on my previous message.",
    "If it helps, I can send a quick 2-minute summary with pricing and next steps.",
    "Would you like me to share that here?",
  ].join("\n");
}

function fallbackTwitterContextReply(context?: string) {
  const handleMatch = context?.match(/@[a-zA-Z0-9_]+/);
  const handle = handleMatch?.[0] || "@yourhandle";
  const unreadRaw = readContextValue(context, "Unread notifications");
  const unread = unreadRaw ? unreadRaw.replace(/[^0-9]/g, "") : "";

  return [
    `Using your current Twitter/X page context${unread ? ` (${unread} unread notifications)` : ""}, here are 3 personalized reply options:`,
    "",
    `1. \"Thanks for the mention ${handle}. Happy to help, what specific part should I break down first?\"`,
    `2. \"Appreciate the feedback ${handle}. I can share a quick step-by-step reply option tailored to your use case.\"`,
    `3. \"Great question ${handle}. If you want, I can post a concise thread reply with examples from this page context.\"`,
    "",
    "If you paste one notification text, I will generate a precise final reply for that item.",
  ].join("\n");
}

function fallbackDocsContextReply(context?: string) {
  const user = readContextValue(context, "Current user") || "there";

  return [
    `Got it ${user} - you are on the Docs page (knowledge base and workspace docs).`,
    "",
    "What you can do on this page:",
    "- Find documentation for features, workflows, and integrations",
    "- Review how-to guides and team operating notes",
    "- Capture reusable instructions for faster execution",
    "",
    "4 quick actions:",
    "1. Search the docs for your exact task keyword",
    "2. Open the latest related document and skim summary + steps",
    "3. Copy a ready-to-use checklist into your task",
    "4. Ask me to draft a doc snippet or SOP for your current workflow",
  ].join("\n");
}

function fallbackContextAwareReply(input: string, source: ChatSource, context?: string) {
  const lower = input.toLowerCase();
  const contextLower = context?.toLowerCase() || "";
  const page = readContextValue(context, "Current page") || "the current page";

  if (source === "twitter" || /twitter|notification/.test(`${lower} ${contextLower}`)) {
    return fallbackTwitterContextReply(context);
  }

  if (/docs|documentation|knowledge/.test(`${lower} ${contextLower}`)) {
    return fallbackDocsContextReply(context);
  }

  return [
    `I am using the current page context (${page}) to personalize this response.`,
    "",
    "What I can do right now:",
    "- Explain this page in plain language",
    "- Draft content tailored to this page",
    "- Suggest next actions based on visible context",
    "",
    "Tell me the exact output you want (reply draft, email, post copy, checklist, or summary).",
  ].join("\n");
}

function asksForImmediateEmailPriority(input: string) {
  const lower = input.toLowerCase();
  const mentionsEmail = /(email|mail|inbox|gmail)/.test(lower);
  const asksReplyPriority = /(reply|respond|response)/.test(lower) && /(first|immediate|immediately|urgent|priority|prioritize|which|what)/.test(lower);
  const asksScan = /(scan|check|read|review)/.test(lower) && /(mail|email|inbox)/.test(lower);

  return mentionsEmail && (asksReplyPriority || asksScan);
}

function contextHasConcreteEmailItems(context?: string) {
  if (!context) return false;
  return /Email items visible on page:\s*\n\d+\. Subject:/i.test(context);
}

function noConcreteEmailItemsReply(context?: string) {
  const account = readContextValue(context, "Signed-in Gmail account") || "your Gmail account";
  const unread = readContextValue(context, "Unread notifications") || "unknown";

  return [
    `I re-checked your page context. I can see ${account} and unread notifications (${unread}), but I do not have concrete email subject lines in the current page context.`,
    "",
    "To prioritize immediate replies accurately, I need one of these:",
    "- Open the email list so subject/sender rows are visible in context",
    "- Paste the top 5 email subjects and senders here",
    "- Ask me to give a triage rule you can apply instantly",
    "",
    "I will not guess or fabricate email subjects.",
  ].join("\n");
}

function fallbackReply(input: string, source: ChatSource, context?: string): string {
  const lower = input.toLowerCase();
  const sourceLabel = source === "twitter" ? "Twitter/X" : source.charAt(0).toUpperCase() + source.slice(1);
  const hasContext = Boolean(context && context.trim());

  if ((source === "email" || /email|mail|client/.test(lower)) && /draft|write|compose/.test(lower)) {
    return fallbackEmailDraft(input);
  }

  if ((source === "whatsapp" || /whatsapp/.test(lower)) && /draft|write|follow|message/.test(lower)) {
    return fallbackWhatsappDraft();
  }

  if (hasContext && /current page|this page|page context|use this context|based on|personalized|take this page/.test(lower)) {
    return fallbackContextAwareReply(input, source, context);
  }

  if (lower.includes("report") || lower.includes("performance")) {
    return `I can generate a ${sourceLabel} performance snapshot with top trends, risk signals, and next actions. Ask for a detailed breakdown by timeframe and audience segment.`;
  }

  if (lower.includes("lead") || lower.includes("pipeline") || lower.includes("prioritize")) {
    return `I can prioritize ${sourceLabel} leads by intent, recency, and engagement. Ask me for ranked leads plus a recommended follow-up sequence.`;
  }

  if (lower.includes("automation") || lower.includes("status") || lower.includes("running")) {
    return "I can summarize automation health, trigger counts, and bottlenecks. If you want, ask me for a status report focused on failures and delayed workflows.";
  }

  if (lower.includes("whatsapp") || lower.includes("instagram") || lower.includes("linkedin")) {
    return "I can summarize activity for that platform and suggest next actions. Tell me if you want insights, reply drafts, or a triage plan.";
  }

  if (hasContext) {
    return fallbackContextAwareReply(input, source, context);
  }

  return `I am ready to help with ${sourceLabel} triage, response drafts, lead prioritization, and automation health. Ask a specific question and I will respond with clear actions.`;
}

function applyResponseGuardrails(reply: string) {
  let next = String(reply || "").trim();

  // Remove self-referential model disclaimers to keep a human assistant tone.
  next = next
    .replace(/i\s*'?m\s+a\s+large\s+language\s+model[^\n]*\.?/gi, "I'm here with you and ready to help.")
    .replace(/as\s+an?\s+(ai|language model)[^\n]*\.?/gi, "")
    .replace(/i\s+do\s+not\s+have\s+feelings[^\n]*\.?/gi, "")
    .replace(/i\s+don'?t\s+have\s+feelings[^\n]*\.?/gi, "");

  const filteredLines = next
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !/^(as an ai|as a language model)/i.test(line.trim()));

  next = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (!next) {
    return "I’m here with you and ready to help. Tell me what you want to handle first, and I’ll guide you step by step.";
  }

  return next;
}

function mapHistory(history: Array<{ role: ChatRole; content: string }>) {
  return history.slice(-12).map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

function buildSystemPrompt(source: ChatSource, context?: string) {
  const sourceLabel = source === "twitter" ? "Twitter/X" : source.charAt(0).toUpperCase() + source.slice(1);

  return [
    "You are Zynco AI, a personal social media operations assistant embedded inside the user's workspace.",
    `Primary source for this turn: ${sourceLabel}.`,
    "Identity and tone guardrails:",
    "- Speak like a warm, capable personal assistant helping a real teammate.",
    "- Never say you are an AI, language model, or that you do not have feelings.",
    "- Avoid robotic disclaimers and generic boilerplate.",
    "- Keep the default response concise and practical (about 4-8 lines unless user asks for detail).",
    "Priorities:",
    "- Focus on helping with social media handling: reply prioritization, response drafting, content drafting, and action plans.",
    "- Use the provided active page context first when answering.",
    "- Help with page-specific doubts, explain visible sections, and draft content relevant to the current page.",
    "- If the user asks for writing help, produce ready-to-use copy tailored to the page context.",
    "- For email/message prioritization requests, only use concrete entries explicitly present in Active page context.",
    "- Never invent email subjects, sender names, or message rows.",
    "- If concrete rows are not present in context, clearly say that and ask the user to open/paste the email list.",
    "- If context is incomplete, ask one concise follow-up or state assumptions clearly.",
    "Response style rules:",
    "- Keep responses practical and easy to act on.",
    "- Use markdown only when it adds clarity.",
    "- Prefer plain conversational flow for simple questions.",
    "- Use bullets or numbered lists only for actionable steps and prioritization.",
    "- Use section headings only when user asks for analysis/report style output.",
    "- Do not fabricate metrics, timestamps, user data, or actions you did not perform.",
    context ? `Active page context:\n${context}` : "No explicit page context was provided.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request payload" },
        { status: 400 },
      );
    }

    const { message, history, source, context } = parsed.data;
    const groqApiKeys = await getGroqApiKeyCandidates();

    if (context && asksForImmediateEmailPriority(message) && !contextHasConcreteEmailItems(context)) {
      return NextResponse.json({
        reply: noConcreteEmailItemsReply(context),
        source: "fallback",
        model: DEFAULT_GROQ_MODEL,
        configured: groqApiKeys.length > 0,
      });
    }

    if (groqApiKeys.length === 0) {
      return NextResponse.json({
        reply: fallbackReply(message, source, context),
        source: "fallback",
        model: "none",
        configured: false,
      });
    }

    const messages = [
      { role: "system", content: buildSystemPrompt(source, context) },
      ...mapHistory(history),
      { role: "user", content: message },
    ];

    let response: Response | null = null;
    let providerErrorBody = "";

    for (const apiKey of groqApiKeys) {
      response = await callGroqChat(messages, apiKey);
      if (response.ok) {
        break;
      }

      providerErrorBody = await response.text();
      if (isInvalidGroqKeyResponse(response.status, providerErrorBody)) {
        // A stale override can leave an invalid key in process env; try next candidate.
        continue;
      }

      break;
    }

    if (!response) {
      return NextResponse.json({
        reply: fallbackReply(message, source, context),
        source: "fallback",
        model: DEFAULT_GROQ_MODEL,
        configured: true,
      });
    }

    if (!response.ok) {
      if (!providerErrorBody) {
        providerErrorBody = await response.text();
      }
      console.error("Chat API provider error:", providerErrorBody);
      return NextResponse.json({
        reply: fallbackReply(message, source, context),
        source: "fallback",
        model: DEFAULT_GROQ_MODEL,
        configured: true,
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({
        reply: fallbackReply(message, source, context),
        source: "fallback",
        model: DEFAULT_GROQ_MODEL,
        configured: true,
      });
    }

    return NextResponse.json({
      reply: applyResponseGuardrails(reply),
      source: "groq",
      model: DEFAULT_GROQ_MODEL,
      configured: true,
    });
  } catch (error) {
    console.error("Chat route error:", error);
    const payloadObject = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const payloadMessage = typeof payloadObject?.message === "string" ? payloadObject.message : null;
    const payloadContext = typeof payloadObject?.context === "string" ? payloadObject.context : undefined;
    const hasConfiguredKey = Boolean(normalizeApiKey(process.env.GROQ_API_KEY || ""));

    const fallbackMessage =
      payloadMessage
        ? fallbackReply(
          payloadMessage,
          "automation",
          payloadContext,
        )
        : "I hit a temporary issue while processing that. Please try again in a moment.";

    return NextResponse.json({
      reply: fallbackMessage,
      source: "error",
      model: DEFAULT_GROQ_MODEL,
      configured: hasConfiguredKey,
    });
  }
}
