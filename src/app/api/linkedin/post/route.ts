import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// In a real app, you would store this in a database per user.
// For this demo, let's use a mock or environment variable if provided.
const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN; 

export async function POST(req: Request) {
    try {
        const { text, title, userId, token, media } = await req.json();
        const ACCESS_TOKEN = token || process.env.LINKEDIN_ACCESS_TOKEN; 

        if (!ACCESS_TOKEN) {
            return NextResponse.json({ 
                error: "LinkedIn integration is not fully authorized. Please Connect via Hub.",
                info: "You must connect your LinkedIn account to obtain an access token."
            }, { status: 401 });
        }

        // 1. Fetch current user profile to get URN (Trying /userinfo for OIDC and /v2/me for legacy)
        let profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
        });

        // Fallback to /v2/me if /userinfo fails
        if (!profileRes.ok) {
            profileRes = await fetch("https://api.linkedin.com/v2/me", {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
            });
        }

        if (!profileRes.ok) {
            const errorText = await profileRes.text();
            return NextResponse.json({ 
                error: "Could not fetch LinkedIn profile URN", 
                details: errorText 
            }, { status: profileRes.status });
        }

        const profile = await profileRes.json();
        const urn = profile.sub || profile.id; // sub is used in OIDC, id in legacy V2
        const profileUrn = `urn:li:person:${urn}`;

        if (!urn) {
            return NextResponse.json({ error: "LinkedIn ID (sub or id) not found in profile response" }, { status: 400 });
        }

        let mediaAsset = null;

        // Optional: Image Upload Flow
        if (media && media.startsWith('data:image/')) {
            try {
                // Step A: Register Upload
                const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${ACCESS_TOKEN}`,
                        "X-Restli-Protocol-Version": "2.0.0",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        registerUploadRequest: {
                            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                            owner: profileUrn,
                            serviceRelationships: [{
                                relationshipType: "OWNER",
                                identifier: "urn:li:userGeneratedContent"
                            }]
                        }
                    })
                });

                const registerData = await registerRes.json();
                const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
                mediaAsset = registerData.value.asset;

                // Step B: Upload Binary
                const base64Data = media.split(',')[1];
                const binaryData = Buffer.from(base64Data, 'base64');
                
                await fetch(uploadUrl, {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
                    body: binaryData
                });
            } catch (mediaErr: any) {
                console.error("LinkedIn Media Upload Failed", mediaErr);
                // Continue with text-only post if media fails, or error out?
                // Let's error out to be safe for the user.
                return NextResponse.json({ error: "Media upload failed", details: mediaErr.message }, { status: 500 });
            }
        }

        // 3. Create the post (UGC API)
        const postData: any = {
            author: profileUrn,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: {
                        text: text
                    },
                    shareMediaCategory: mediaAsset ? "IMAGE" : "NONE",
                    media: mediaAsset ? [{
                        status: "READY",
                        description: { text: "Image shared via Zynco Hub" },
                        media: mediaAsset,
                        title: { text: title || "Media Post" }
                    }] : undefined
                }
            },
            visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        };

        const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(postData)
        });

        const result = await postRes.json();
        if (!postRes.ok) {
            return NextResponse.json({ error: result }, { status: postRes.status });
        }

        // --- DATABASE PERSISTENCE ---
        try {
            // Using global prisma instance if available to avoid multiple connections in dev
            const currentPrisma = (global as any).__mailAgentPrisma || prisma;
            if (currentPrisma && currentPrisma.unifiedMessage) {
                await currentPrisma.unifiedMessage.create({
                    data: {
                        userId: userId || "default",
                        platform: "linkedin",
                        contactId: profileUrn,
                        content: text || "",
                        direction: "OUTBOUND",
                        metadata: { 
                            title: title || "Media Post",
                            mediaUrl: mediaAsset ? "UPLOADED_BINARY" : null,
                            linkedinUrn: result.id,
                            status: "PUBLISHED"
                        }
                    }
                });
            }
        } catch (dbErr) {
            console.error("Failed to save LinkedIn post to DB:", dbErr);
            // Non-blocking error, we still return success to the user
        }
        // ----------------------------

        return NextResponse.json({ success: true, post: result });


    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// Basic summary fetching (e.g. for feed/profile)
export async function GET() {
    return NextResponse.json({ 
        message: "LinkedIn API Node Active",
        endpoints: ["/api/linkedin/auth", "/api/linkedin/post"]
    });
}
