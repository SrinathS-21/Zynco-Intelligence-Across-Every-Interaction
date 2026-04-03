import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { prompt, context } = await req.json();

        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
             return NextResponse.json({ error: 'LLM configuration missing (GROQ_API_KEY).' }, { status: 500 });
        }

        let systemMessage = "You are an AI assistant tasked with drafting a professional message. Use the user's input to write a clear, concise, and friendly output. Output only the exact text.";

        if (context?.platform === 'linkedin') {
            systemMessage = "You are an elite LinkedIn ghostwriter and social media strategist. Turn the user's short premise into a highly engaging, professional LinkedIn post. Format the text perfectly with paragraph breaks, emojis suitable for professional contexts, and 3-5 relevant hashtags at the bottom. Do NOT include any conversational filler (like 'Here is your post:' or 'How about this?'). Output ONLY the exact text the user should copy and paste.";
        } else if (context?.platform === 'twitter') {
            systemMessage = "You are a highly viral Twitter (X) ghostwriter and social media expert. Turn the user's short premise into an engaging, concise, and punchy Tweet. Keep it concise, engaging, and strictly under 280 characters. Use emojis strategically and include 1-2 relevant hashtags. Do NOT include conversational filler, quotation marks around the output, or acknowledge the instructions. Output ONLY the exact text for the tweet.";
        } else if (context?.platform === 'whatsapp') {
            systemMessage = "You are an AI assisting with drafting a WhatsApp message. Keep it conversational, friendly, directly responsive, and brief. Use appropriate emojis. Output ONLY the exact message text without conversational filler.";
        } else if (context?.platform === 'instagram') {
            systemMessage = "You are a professional Instagram Content Strategist. Turn the user's premise into an engaging, visually-descriptive Instagram caption. Use plenty of aesthetic emojis. Focus heavily on storytelling. strictly add a MAXIMUM of 3-5 hashtags at the bottom (Ayrshare API strictly drops payloads with >5 hashtags). Do NOT include any conversational filler.";
        }

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!groqResponse.ok) {
            console.error("Groq API Error:", await groqResponse.text());
            throw new Error("Failed to communicate with AI provider.");
        }

        const data = await groqResponse.json();
        const draft = data.choices?.[0]?.message?.content || "Could not generate text.";

        return NextResponse.json({ draft: draft.trim() });
    } catch (error) {
        console.error("Draft Generation Error:", error);
        return NextResponse.json({ error: 'Failed to generate AI draft' }, { status: 500 });
    }
}
