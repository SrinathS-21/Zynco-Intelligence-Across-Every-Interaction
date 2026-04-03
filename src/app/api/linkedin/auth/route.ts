import { NextResponse } from "next/server";

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID?.replace(/['"]/g, '');
const REDIRECT_URI = `${(process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/['"]/g, '')}/api/linkedin/callback`;

export async function GET() {
    if (!CLIENT_ID) {
        return NextResponse.json({ error: "LinkedIn Client ID not configured" }, { status: 500 });
    }

    // Using modern OpenID Connect scopes + w_member_social for sharing
    const scope = encodeURIComponent("openid profile email w_member_social"); 
    const state = "zynco_linkedin_state"; 
    
    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&scope=${scope}`;
    
    return NextResponse.redirect(url);
}
