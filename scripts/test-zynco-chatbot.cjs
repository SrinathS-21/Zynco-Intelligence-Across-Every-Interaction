#!/usr/bin/env node

/*
  End-to-end QA script for Zynco AI chatbot.
  It validates two capabilities:
  1) General assistance (drafting messages, emails, etc.)
  2) Context-aware assistance (uses current page context for personalized replies)

  Usage:
    npm run test:bot

  Optional env vars:
    BOT_TEST_BASE_URL=http://localhost:3000
    BOT_TEST_TIMEOUT_MS=30000
    BOT_TEST_REQUIRE_GROQ=1
*/

const BASE_URL = (process.env.BOT_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ENDPOINT = `${BASE_URL}/api/ai/chat`;
const REQUEST_TIMEOUT_MS = Number(process.env.BOT_TEST_TIMEOUT_MS || 30000);
const REQUIRE_GROQ = process.env.BOT_TEST_REQUIRE_GROQ === "1";

function norm(value) {
    return String(value || "").toLowerCase();
}

function countKeywordMatches(text, words) {
    const hay = norm(text);
    let count = 0;
    for (const word of words || []) {
        if (hay.includes(norm(word))) {
            count += 1;
        }
    }
    return count;
}

async function postChat(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        const json = await response.json().catch(() => ({}));
        return {
            ok: response.ok,
            status: response.status,
            body: json,
        };
    } finally {
        clearTimeout(timer);
    }
}

function evaluateReply(testCase, replyText, responseMeta) {
    const failures = [];
    const checks = testCase.checks || {};

    if (!replyText || replyText.trim().length === 0) {
        failures.push("Reply is empty.");
        return failures;
    }

    if (checks.minLength && replyText.trim().length < checks.minLength) {
        failures.push(`Reply too short (${replyText.trim().length} chars), expected >= ${checks.minLength}.`);
    }

    const forbidden = checks.forbidden || [];
    const lowered = norm(replyText);
    for (const bad of forbidden) {
        if (lowered.includes(norm(bad))) {
            failures.push(`Reply contains forbidden phrase: \"${bad}\".`);
        }
    }

    const requiredAll = checks.requiredAll || [];
    for (const token of requiredAll) {
        if (!lowered.includes(norm(token))) {
            failures.push(`Missing required token: \"${token}\".`);
        }
    }

    const requiredAny = checks.requiredAny || [];
    if (requiredAny.length > 0) {
        const minAnyMatches = checks.minAnyMatches || 1;
        const matches = countKeywordMatches(replyText, requiredAny);
        if (matches < minAnyMatches) {
            failures.push(
                `Missing required semantic coverage: found ${matches}/${minAnyMatches} matches in [${requiredAny.join(", ")}].`,
            );
        }
    }

    const contextAnchors = checks.contextAnchors || [];
    if (contextAnchors.length > 0) {
        const minContextMatches = checks.minContextMatches || 1;
        const contextMatches = countKeywordMatches(replyText, contextAnchors);
        if (contextMatches < minContextMatches) {
            failures.push(
                `Context grounding weak: found ${contextMatches}/${minContextMatches} context anchors in [${contextAnchors.join(", ")}].`,
            );
        }
    }

    if (REQUIRE_GROQ && responseMeta?.source !== "groq") {
        failures.push(`Expected Groq response source, got \"${String(responseMeta?.source || "unknown")}\".`);
    }

    return failures;
}

const TEST_CASES = [
    {
        id: "general-email-draft",
        category: "general",
        payload: {
            source: "email",
            message:
                "Draft a professional client email explaining a two-day delivery delay, include apology, revised timeline, and clear next steps.",
            history: [],
        },
        checks: {
            minLength: 120,
            requiredAny: ["email", "client", "delay", "timeline", "next step", "apolog"],
            minAnyMatches: 2,
            forbidden: ["temporarily unavailable", "try again in a moment"],
        },
    },
    {
        id: "general-whatsapp-followup",
        category: "general",
        payload: {
            source: "whatsapp",
            message:
                "Write a friendly WhatsApp follow-up for a warm lead who has not replied in 3 days. Keep it concise and conversion-focused.",
            history: [],
        },
        checks: {
            minLength: 90,
            requiredAny: ["follow", "lead", "message", "hello", "hi", "reply"],
            minAnyMatches: 2,
            forbidden: ["temporarily unavailable", "try again in a moment"],
        },
    },
    {
        id: "context-twitter-personalized",
        category: "context",
        payload: {
            source: "twitter",
            context: [
                "Current page: Twitter/X (twitter).",
                "Page purpose: Connect your X account and manage publishing from one panel.",
                "Active social workspace: Twitter/X.",
                "Unread notifications: 7.",
                "Twitter profile in view: @zyncoai.",
            ].join("\n"),
            message:
                "Use the current page context and draft 3 personalized reply options for unread notifications. Include @zyncoai in the options.",
            history: [],
        },
        checks: {
            minLength: 140,
            requiredAll: ["@zyncoai"],
            requiredAny: ["notification", "reply", "option", "personalized"],
            minAnyMatches: 2,
            contextAnchors: ["twitter", "@zyncoai", "notification", "unread"],
            minContextMatches: 2,
            forbidden: ["temporarily unavailable", "try again in a moment"],
        },
    },
    {
        id: "context-docs-assistant",
        category: "context",
        payload: {
            source: "automation",
            context: [
                "Current page: Docs (docs).",
                "Page purpose: Knowledge base and workspace docs.",
                "Current user: Alex.",
            ].join("\n"),
            message:
                "Take this page as context: I am confused. Explain what I can do on this page and give 4 quick actions I should take.",
            history: [],
        },
        checks: {
            minLength: 120,
            requiredAny: ["docs", "knowledge", "quick action", "page", "document"],
            minAnyMatches: 2,
            contextAnchors: ["docs", "knowledge", "alex"],
            minContextMatches: 1,
            forbidden: ["temporarily unavailable", "try again in a moment"],
        },
    },
];

async function main() {
    console.log(`\nZynco Chatbot Test Runner`);
    console.log(`Endpoint: ${ENDPOINT}`);
    console.log(`Cases: ${TEST_CASES.length} (general + context-aware)`);

    let passCount = 0;
    let failCount = 0;

    for (const testCase of TEST_CASES) {
        process.stdout.write(`\n[${testCase.category}] ${testCase.id} ... `);

        let result;
        try {
            result = await postChat(testCase.payload);
        } catch (error) {
            failCount += 1;
            console.log("FAIL");
            console.log(`  Request error: ${error instanceof Error ? error.message : String(error)}`);
            continue;
        }

        if (!result.ok) {
            failCount += 1;
            console.log("FAIL");
            console.log(`  HTTP ${result.status} from chatbot endpoint.`);
            console.log(`  Body: ${JSON.stringify(result.body)}`);
            continue;
        }

        const reply = typeof result.body?.reply === "string" ? result.body.reply : "";
        const failures = evaluateReply(testCase, reply, result.body);

        if (failures.length === 0) {
            passCount += 1;
            console.log("PASS");
            console.log(`  source=${String(result.body?.source || "unknown")}, model=${String(result.body?.model || "unknown")}`);
        } else {
            failCount += 1;
            console.log("FAIL");
            console.log(`  source=${String(result.body?.source || "unknown")}, model=${String(result.body?.model || "unknown")}`);
            for (const item of failures) {
                console.log(`  - ${item}`);
            }
            const preview = reply.replace(/\s+/g, " ").slice(0, 240);
            console.log(`  Reply preview: ${preview}${reply.length > 240 ? "..." : ""}`);
        }
    }

    console.log("\nSummary");
    console.log(`  Passed: ${passCount}`);
    console.log(`  Failed: ${failCount}`);

    if (failCount > 0) {
        process.exitCode = 1;
        return;
    }

    console.log("  Result: All chatbot tests passed.");
}

main().catch((error) => {
    console.error("Fatal test runner error:", error);
    process.exitCode = 1;
});
