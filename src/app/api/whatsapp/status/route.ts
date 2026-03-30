import { NextResponse } from 'next/server';
import { getWhatsAppStatus, getWhatsAppClient } from '@/lib/whatsapp';

export async function GET() {
    try {
        const { status, qr } = getWhatsAppStatus();
        return NextResponse.json({ status, qr });
    } catch (error) {
        return NextResponse.json({ status: 'ERROR', error: String(error) }, { status: 500 });
    }
}

export async function POST() {
    try {
        // Trigger initialization if not already done
        const client = getWhatsAppClient();
        return NextResponse.json({ status: 'INITIALIZING' });
    } catch (error) {
        return NextResponse.json({ status: 'ERROR', error: String(error) }, { status: 500 });
    }
}
