import { NextResponse } from 'next/server';
import { saveTokens } from '@/lib/google';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    try {
        await saveTokens(code);
        return new NextResponse('<h1>✅ Google Connected Successfully!</h1><p>You can close this window and return to the dashboard.</p>', {
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
