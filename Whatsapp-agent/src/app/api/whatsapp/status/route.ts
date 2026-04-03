import { NextResponse } from 'next/server';
import { getWhatsAppStatus, initWhatsApp } from '@/lib/whatsapp';
import { getGoogleAuthUrl, isGoogleConnected } from '@/lib/google';

export async function GET() {
    try {
        // Start init in background, don't await to keep response fast
        initWhatsApp().catch((err: Error) => console.error('Background init error:', err));

        const { status, qr } = getWhatsAppStatus();
        const googleConnected = await isGoogleConnected();
        const googleAuthUrl = getGoogleAuthUrl();

        return NextResponse.json({
            status,
            qr,
            googleConnected,
            googleAuthUrl
        });
    } catch (error) {
        console.error('Status route error:', error);
        return NextResponse.json({ status: 'ERROR', error: 'Internal Server Error' }, { status: 500 });
    }
}
