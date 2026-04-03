import { NextResponse } from 'next/server';
import { getWhatsAppStatus, getWhatsAppClient } from '@/lib/whatsapp';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Check if a saved WhatsApp session exists on disk
function hasSavedSession(): boolean {
    const sessionPath = path.join(process.cwd(), '.wwebjs_auth/session-zynco-hub');
    // The session folder exists and has a Default subfolder = valid saved session
    const defaultPath = path.join(sessionPath, 'Default');
    return fs.existsSync(defaultPath);
}

export async function GET() {
    try {
        const { status, qr } = getWhatsAppStatus();

        // 🛡️ [PROTECTION] If a Whapi Token is detected on the client-side/env, do not trigger auto-reconnect
        // of the legacy headless engine to avoid resource conflicts.
        const whapiEnabled = !!process.env.WHAPI_API_TOKEN;
        if (whapiEnabled) {
            return NextResponse.json({ status: 'READY', qr: null, mode: 'cloud' });
        }

        // Auto-reconnect: if status is DISCONNECTED but a saved session exists,
        if (status === 'DISCONNECTED' && hasSavedSession()) {
            console.log('[WhatsApp] Saved session detected — auto-reconnecting legacy core...');
            await getWhatsAppClient(); // boots the client, sets status to INITIALIZING
            return NextResponse.json({ status: 'INITIALIZING', qr: null });
        }

        return NextResponse.json({ status, qr });
    } catch (error) {
        return NextResponse.json({ status: 'ERROR', error: String(error) }, { status: 500 });
    }
}

export async function POST() {
    try {
        await getWhatsAppClient();
        return NextResponse.json({ status: 'INITIALIZING' });
    } catch (error) {
        return NextResponse.json({ status: 'ERROR', error: String(error) }, { status: 500 });
    }
}
