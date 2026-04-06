import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const GROQ_TRANSCRIBE_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_TRANSCRIBE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo";

function normalizeApiKey(input: string | undefined | null) {
    if (!input) return "";
    return input.trim().replace(/^['\"]|['\"]$/g, "");
}

export async function POST(request: NextRequest) {
    try {
        await requireUser(request);

        const groqApiKey = normalizeApiKey(process.env.GROQ_API_KEY || "");
        if (!groqApiKey) {
            return NextResponse.json({ error: "GROQ_API_KEY is required for transcription." }, { status: 500 });
        }

        const formData = await request.formData();
        const audio = formData.get("audio");

        if (!(audio instanceof File) || audio.size === 0) {
            return NextResponse.json({ error: "audio file is required" }, { status: 400 });
        }

        const transcriptionFormData = new FormData();
        transcriptionFormData.append("file", audio, audio.name || `voice-note-${Date.now()}.webm`);
        transcriptionFormData.append("model", GROQ_TRANSCRIBE_MODEL);
        transcriptionFormData.append("temperature", "0");

        const response = await fetch(GROQ_TRANSCRIBE_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${groqApiKey}`,
            },
            body: transcriptionFormData,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const message =
                (payload && typeof payload === "object" && typeof (payload as { error?: { message?: string } }).error?.message === "string"
                    ? (payload as { error: { message: string } }).error.message
                    : "Failed to transcribe audio");
            return NextResponse.json({ error: message }, { status: response.status || 500 });
        }

        const transcript =
            payload && typeof payload === "object" && typeof (payload as { text?: string }).text === "string"
                ? (payload as { text: string }).text.trim()
                : "";

        if (!transcript) {
            return NextResponse.json({ error: "Transcription returned empty text" }, { status: 502 });
        }

        return NextResponse.json({ transcript });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to transcribe audio" },
            { status: 500 },
        );
    }
}
