import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Inject rule into global variable tracked by the whatsapp websocket event loop
        global.__whatsappRule = {
            trigger: body.trigger,
            persona: body.persona,
            prompt: body.prompt
        };
        
        console.log('Deployed new AI Auto-Responder Rule:', global.__whatsappRule);
        
        return NextResponse.json({ success: true, message: 'AI Rule deployed into memory' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ rule: global.__whatsappRule || null });
}
