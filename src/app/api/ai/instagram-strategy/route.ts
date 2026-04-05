import { NextResponse } from "next/server";

async function transcribeVoiceNote(file: File, apiKey: string) {
  const formData = new FormData();
  formData.append("file", file, file.name || "voice-note.webm");
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("temperature", "0");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voice transcription failed: ${errorText}`);
  }

  const payload = await response.json();
  return typeof payload?.text === "string" ? payload.text.trim() : "";
}

async function buildStrategy(prompt: string, apiKey: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You are an Instagram growth strategist. Produce concise, practical plans for creators and brands. Include best posting times, format mix, and CTA ideas. Output must be valid markdown only. Use headings, bullets, numbered lists, and short paragraphs. Do not add decorative separators like =====, ----, or extra title lines above the first section.",
        },
        {
          role: "user",
          content:
            `Create an Instagram strategy from this user input:\n\n${prompt}\n\n` +
            "Return sections exactly in this order using markdown H2 headings: 1) Positioning, 2) Content Pillars, 3) Weekly Posting Plan, 4) Best Posting Times, 5) Reels & Stories Tactics, 6) CTA + Hashtag Framework, 7) First 7 Post Ideas.",
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strategy generation failed: ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

function fallbackStrategy(prompt: string) {
  return [
    "## Positioning",
    "Focus on one clear promise: solve one audience problem repeatedly with visual proof.",
    "",
    "## Content Pillars",
    "1. Education: short practical tips and mini tutorials",
    "2. Authority: results, case studies, before/after",
    "3. Personal: founder voice, behind-the-scenes, values",
    "",
    "## Weekly Posting Plan",
    "- 3 Reels (Mon, Wed, Fri)",
    "- 2 Carousels (Tue, Sat)",
    "- Stories daily (3-7 frames)",
    "",
    "## Best Posting Times",
    "- Weekdays: 9:00-11:00 AM and 6:00-8:00 PM",
    "- Weekends: 10:00 AM-12:00 PM",
    "",
    "## Reels & Stories Tactics",
    "- Hook in first 2 seconds",
    "- Keep reels 15-35 seconds with captions",
    "- Add polls/questions in stories to drive replies",
    "",
    "## CTA + Hashtag Framework",
    "- One CTA per post: Save, Share, or DM",
    "- Use 3-5 niche hashtags + 1 branded hashtag",
    "",
    "## First 7 Post Ideas",
    "1. Biggest mistake your audience makes",
    "2. Step-by-step framework",
    "3. Quick myth vs fact",
    "4. Behind-the-scenes workflow",
    "5. Client result snapshot",
    "6. Tool stack and why",
    "7. Weekly Q&A roundup",
    "",
    `Input summary: ${prompt.slice(0, 220)}`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const groqApiKey = process.env.GROQ_API_KEY;

    let prompt = "";
    let voiceFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = String(formData.get("prompt") || "").trim();
      const maybeVoice = formData.get("voiceNote");
      if (maybeVoice instanceof File && maybeVoice.size > 0) {
        voiceFile = maybeVoice;
      }
    } else {
      const payload = await request.json();
      prompt = String(payload?.prompt || "").trim();
    }

    let transcript = "";
    if (voiceFile) {
      if (!groqApiKey) {
        return NextResponse.json(
          { error: "GROQ_API_KEY is required to transcribe voice notes." },
          { status: 500 },
        );
      }
      transcript = await transcribeVoiceNote(voiceFile, groqApiKey);
    }

    const mergedPrompt = [prompt, transcript].filter(Boolean).join("\n\nVoice note transcript:\n");

    if (!mergedPrompt.trim()) {
      return NextResponse.json(
        { error: "Provide a text prompt or voice note." },
        { status: 400 },
      );
    }

    let strategy = "";
    if (groqApiKey) {
      strategy = await buildStrategy(mergedPrompt, groqApiKey);
    } else {
      strategy = fallbackStrategy(mergedPrompt);
    }

    return NextResponse.json({
      strategy: strategy || fallbackStrategy(mergedPrompt),
      transcript,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate Instagram strategy" },
      { status: 500 },
    );
  }
}
