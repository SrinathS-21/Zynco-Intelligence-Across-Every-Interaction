import { NextResponse } from 'next/server';

export async function POST() {
    try {
        if (process.env.VERCEL === '1') {
            return NextResponse.json({ status: 'RESET', mode: 'unsupported' });
        }

        const { resetWhatsApp } = await import('@/lib/whatsapp');
        await resetWhatsApp();
        return NextResponse.json({ status: 'RESET' });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
