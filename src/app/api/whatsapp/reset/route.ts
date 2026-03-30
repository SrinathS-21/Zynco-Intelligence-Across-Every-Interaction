import { NextResponse } from 'next/server';
import { resetWhatsApp } from '@/lib/whatsapp';

export async function POST() {
    try {
        await resetWhatsApp();
        return NextResponse.json({ status: 'RESET' });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
