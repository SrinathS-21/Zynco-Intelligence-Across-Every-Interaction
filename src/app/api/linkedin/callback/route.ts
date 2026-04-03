import { NextResponse } from "next/server";

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID?.replace(/['"]/g, '');
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET?.replace(/['"]/g, '');
const REDIRECT_URI = `${(process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/['"]/g, '')}/api/linkedin/callback`;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");

    if (error) {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/unified?linkedin_error=${encodeURIComponent(error_description || error)}&platform=linkedin`);
    }

    if (!code) {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/unified?linkedin_error=No%20authorization%20code%20provided&platform=linkedin`);
    }

    try {
        const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID!,
                client_secret: CLIENT_SECRET!
            })
        });

        const data = await tokenRes.json();

        if (data.access_token) {
            // In a real application, you would save this token to the user record in the database.
            // For now, since we're in a demo/local environment, we'll inform the user to add it to .env
            // or we could set it in a secured cookie.
            return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/unified?linkedin_success=1&access_token=${data.access_token}&platform=linkedin`);
        } else {
            return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/unified?linkedin_error=Failed%20to%20obtain%20access%20token&platform=linkedin`);
        }
    } catch (err) {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/unified?linkedin_error=Callback%20Exchange%20Failed&platform=linkedin`);
    }
}
