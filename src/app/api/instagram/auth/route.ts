import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    // Simulate Ayrshare / Instagram connection handshake
    return NextResponse.redirect(`${baseUrl}/dashboard/unified?instagram_success=1&instagram_token=ayr_sim_${Date.now()}&platform=instagram`);
}
