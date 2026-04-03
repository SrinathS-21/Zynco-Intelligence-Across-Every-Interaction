import { NextResponse } from 'next/server';
import { getWhatsAppClient } from '@/lib/whatsapp';

export async function POST() {
    try {
        console.log('API Request: Triggering WhatsApp Initialization Sequence...');
        // Initiating the client without awaiting immediately so the UI doesn't hang
        await getWhatsAppClient();
        return NextResponse.json({ success: true, message: 'Initialization signal dispatched successfully. Please poll /status for the QR.' });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to dispatch initialization signal' }, { status: 500 });
    }
}
