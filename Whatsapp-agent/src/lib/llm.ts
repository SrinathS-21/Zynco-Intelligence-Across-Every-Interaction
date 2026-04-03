import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export interface LLMResponse {
    intent: 'book_appointment' | 'check_availability' | 'reschedule' | 'cancel' | 'general';
    confidence: number;
    extracted_info: {
        patient_name?: string;
        preferred_date?: string;
        preferred_time?: string;
        doctor?: string;
        department?: string;
        appointment_id?: string;
    };
    reply: string;
    requires_clarification: boolean;
    missing_fields: string[];
}

export async function processMessage(
    message: string,
    context: {
        name?: string;
        history?: { role: string; content: string }[];
        accumulated?: Record<string, string>;
    }
): Promise<LLMResponse> {
    const acc = context.accumulated || {};

    const systemPrompt = `
You are the Digital Health Assistant for *SPINaBOT Health* 🏥.
You are the ONLY system handling the conversation. YOU drive the entire interaction.

STYLE RULES (for the 'reply' field):
- Use NUMBERED lists (1, 2, 3...) for ALL options so users can reply with just a number.
- Use *Bold* for key details.
- Keep responses short and clear. Max 3-4 lines.

CONTEXT:
- Patient name: ${context.name || acc.patient_name || 'Unknown'}
- Today: ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('en-US', { weekday: 'long' })})

ALREADY COLLECTED (DO NOT re-ask for these):
${acc.patient_name ? `- Patient Name: ${acc.patient_name} ✅` : '- Patient Name: ❌ not collected'}
${acc.department ? `- Department: ${acc.department} ✅` : '- Department: ❌ not collected'}
${acc.preferred_date ? `- Date: ${acc.preferred_date} ✅` : '- Date: ❌ not collected'}
${acc.preferred_time ? `- Time: ${acc.preferred_time} ✅` : '- Time: ❌ not collected'}

BOOKING REQUIRES EXACTLY 4 FIELDS: patient_name, department, preferred_date, preferred_time.
- Doctor is NOT required. The system auto-assigns a doctor. NEVER ask for a doctor name.

STRICT OUTPUT FORMAT (JSON only):
{
  "intent": "book_appointment|check_availability|reschedule|cancel|general",
  "confidence": 0.0-1.0,
  "extracted_info": {
    "patient_name": "string or null",
    "preferred_date": "YYYY-MM-DD or null",
    "preferred_time": "HH:MM or null",
    "department": "string or null"
  },
  "reply": "your response",
  "requires_clarification": true/false,
  "missing_fields": []
}

CRITICAL RULES:
1. Greeting ("Hi/Hello/Hey") → Show main menu:
   1. Book Appointment
   2. Check Availability
   3. Our Departments
   4. Emergency Support

2. Department selection → ALWAYS show numbered:
   1. Cardiology
   2. Pediatrics
   3. General Medicine
   4. Orthopedics
   5. Dermatology

3. Number mapping:
   - For main menu selection: 1=Book Appointment, 4=Emergency, etc.
   - For department selection: 1=Cardiology, 2=Pediatrics, 3=General Medicine, 4=Orthopedics, 5=Dermatology.

4. NEVER re-ask for info already marked ✅ in ALREADY COLLECTED.

5. Ask for only ONE missing field at a time, in this order: patient_name → department → preferred_date → preferred_time.

6. CONFIRMATION FLOW: Once all 4 fields are collected (marked ✅), show a summary and ask "Shall I confirm this booking? (yes/no)". In your JSON, set requires_clarification=true and missing_fields=[].

7. When user says "yes/yeah/confirm/ok/sure" to confirm a booking summary:
   - Set requires_clarification=false
   - Set intent="book_appointment"
   - Include ALL collected info in extracted_info
   - The system will automatically create the booking.

8. Normalize: "tomorrow" → YYYY-MM-DD, "10am" → "10:00", "2:30pm" → "14:30".

9. extracted_info must ALWAYS carry forward ALL known info from "ALREADY COLLECTED" plus any new info.
`;

    // Build chat messages with history
    const chatMessages = [
        { role: "system" as const, content: systemPrompt },
        ...(context.history || []).map(m => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content
        })),
        { role: "user" as const, content: message }
    ];

    if (!groq && !genAI) {
        throw new Error("No LLM provider configured (GROQ_API_KEY or GEMINI_API_KEY is missing)");
    }

    // Try Groq first
    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: chatMessages as any,
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                temperature: 0.1
            });
            const content = completion.choices[0].message.content;
            if (content) {
                const parsed = JSON.parse(content);
                return normalizeResponse(parsed, acc);
            }
        } catch (error) {
            console.error("Groq API error:", error);
            if (!genAI) throw error;
        }
    }

    // Fallback to Gemini
    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const historyText = (context.history || [])
                .map(m => `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`)
                .join('\n');
            const prompt = `${systemPrompt}\n\nConversation so far:\n${historyText}\n\nPatient: ${message}\n\nRespond with ONLY a JSON object:`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            return normalizeResponse(parsed, acc);
        } catch (error) {
            console.error("Gemini API error:", error);
            throw error;
        }
    }

    throw new Error("Failed to process message with LLM");
}

/**
 * Ensures the LLM response carries forward accumulated data properly
 */
function normalizeResponse(parsed: any, accumulated: Record<string, string>): LLMResponse {
    const info = parsed.extracted_info || {};

    // Merge: keep accumulated values, overlay with new non-null values from LLM
    const merged: Record<string, string | undefined> = {
        patient_name: validStr(info.patient_name) || accumulated.patient_name,
        preferred_date: validStr(info.preferred_date) || accumulated.preferred_date,
        preferred_time: validStr(info.preferred_time) || accumulated.preferred_time,
        doctor: validStr(info.doctor) || accumulated.doctor,
        department: validStr(info.department) || accumulated.department,
        appointment_id: validStr(info.appointment_id) || accumulated.appointment_id,
    };

    return {
        intent: parsed.intent || 'general',
        confidence: parsed.confidence || 0.5,
        extracted_info: merged as any,
        reply: parsed.reply || '',
        requires_clarification: parsed.requires_clarification ?? true,
        missing_fields: parsed.missing_fields || []
    };
}

function validStr(v: any): string | undefined {
    if (!v) return undefined;
    const s = String(v).trim();
    if (s === '' || s === 'null' || s === 'string' || s === 'undefined') return undefined;
    return s;
}
