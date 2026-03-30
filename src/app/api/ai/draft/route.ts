import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { prompt, context } = await req.json();

        // This is a placeholder for your AI engine. 
        // In a real implementation, you would call OpenAI, Claude, or a local LLM here.
        // We simulate a helpful AI response.
        
        let draft = '';
        if (prompt.toLowerCase().includes('professional')) {
            draft = "Hello, I hope this message finds you well. I'm reaching out regarding our recent discussion. Let me know when you have a moment to connect.";
        } else if (prompt.toLowerCase().includes('friendly')) {
            draft = "Hey there! Hope you're having a great day. Just wanted to check in and see how things are going on your end. Talk soon!";
        } else {
            draft = `Regarding "${prompt}": I've reviewed the context and here is a suggested message for you to send.`;
        }

        return NextResponse.json({ draft });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to generate AI draft' }, { status: 500 });
    }
}
