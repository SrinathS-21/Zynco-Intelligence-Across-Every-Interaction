import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { text, title, userId, media, token } = await req.json();
        const ayrshareApiKey = token || process.env.AYRSHARE_API_KEY;
        let finalResponseData: any = { status: "MOCKED_SUCCESS", id: `ig_${Date.now()}` };

        // Instagram strict requirement
        if (!media) {
             return NextResponse.json({ error: 'Instagram requires at least one media asset (image/video) to publish.' }, { status: 400 });
        }

        if (ayrshareApiKey) {
             let finalMediaUrl = media;
             if (media && media.startsWith("data:image")) {
                 try {
                     const base64Data = media.split(",")[1];
                     const buffer = Buffer.from(base64Data, "base64");
                     const blob = new Blob([buffer], { type: "image/jpeg" });
                     
                     const catboxForm = new FormData();
                     catboxForm.append("reqtype", "fileupload");
                     catboxForm.append("fileToUpload", blob, "upload.jpg");

                     const catboxRes = await fetch("https://catbox.moe/user/api.php", {
                         method: "POST",
                         body: catboxForm
                     });
                     
                     const catboxText = await catboxRes.text();
                     if (catboxRes.ok && catboxText.startsWith("http")) {
                         finalMediaUrl = catboxText;
                     } else {
                         throw new Error(`Catbox upload failed: ${catboxText}`);
                     }
                 } catch (err: any) {
                     console.error("Catbox Upload Error:", err);
                     return NextResponse.json({ error: "Failed to convert image to public CDN. Facebook requires a public accessible URL." }, { status: 400 });
                 }
             }

             const res = await fetch("https://app.ayrshare.com/api/post", {
                 method: "POST",
                 headers: {
                     "Authorization": `Bearer ${ayrshareApiKey}`,
                     "Content-Type": "application/json"
                 },
                 body: JSON.stringify({ 
                     post: text, 
                     platforms: ["instagram"], 
                     mediaUrls: [finalMediaUrl] 
                 })
             });
             if (res.ok) {
                finalResponseData = await res.json();
                finalResponseData._injectedMediaUrl = finalMediaUrl;
             } else {
                 const apiErr = await res.json();
                 console.error("Ayrshare API Error:", apiErr);
                 const extractError = apiErr.errors?.[0]?.message || apiErr.message || apiErr.error || "Ayrshare rejected the payload";
                 return NextResponse.json({ error: extractError }, { status: 400 });
             }
        } else {
             console.log("No ayrshare API Key found, recording mock publication against DB.");
        }

        // --- DATABASE PERSISTENCE ---
        try {
            const currentPrisma = (global as any).__mailAgentPrisma || prisma;
            if (currentPrisma && currentPrisma.unifiedMessage) {
                await currentPrisma.unifiedMessage.create({
                    data: {
                        userId: userId || "default",
                        platform: "instagram",
                        contactId: "self",
                        content: text || "",
                        direction: "OUTBOUND",
                        metadata: { 
                            title: title || "Instagram Post",
                            mediaUrl: finalResponseData._injectedMediaUrl || (media.length < 3000000 ? media : "UPLOADED_BINARY"),
                            instagramUrn: finalResponseData.id || `sim_${Date.now()}`,
                            status: "PUBLISHED"
                        }
                    }
                });
            }
        } catch (dbErr) {
            console.error("Failed to save Instagram post to DB:", dbErr);
        }
        // ----------------------------

        return NextResponse.json({ success: true, post: finalResponseData });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
