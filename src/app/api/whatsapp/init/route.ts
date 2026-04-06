import { NextResponse } from 'next/server';
import { getWhatsAppClient } from '@/lib/whatsapp';

export async function POST() {
    try {
        const whapiEnabled = !!process.env.WHAPI_API_TOKEN;
        if (whapiEnabled) {
            return NextResponse.json({
                success: true,
                status: 'READY',
                mode: 'cloud',
                message: 'WhatsApp cloud mode is enabled via WHAPI_API_TOKEN.',
            });
        }

        if (process.env.VERCEL === '1') {
            return NextResponse.json({
                success: false,
                status: 'DISCONNECTED',
                mode: 'unsupported',
                message: 'Legacy WhatsApp Web session is not supported on Vercel. Set WHAPI_API_TOKEN to use cloud mode.',
            });
        }

        console.log('API Request: Triggering WhatsApp Initialization Sequence...');
        // Initiating the client without awaiting immediately so the UI doesn't hang
        await getWhatsAppClient();
        return NextResponse.json({ success: true, message: 'Initialization signal dispatched successfully. Please poll /status for the QR.' });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to dispatch initialization signal' }, { status: 500 });
    }
}
