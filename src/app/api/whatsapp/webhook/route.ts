import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('📬 [WHAPI WEBHOOK] Received payload:', JSON.stringify(body, null, 2));

        // Whapi typical message payload structure
        // Usually contains an array of messages or a single message object
        const messages = body.messages || [];

        for (const msg of messages) {
            // Skip outbound messages sent from the account itself if they are in the webhook
            if (msg.from_me) continue;

            const contactId = msg.chat_id || msg.from;
            const contactName = msg.sender_name || contactId.split('@')[0];
            const content = msg.text?.body || msg.body || '';

            // 1. Save inbound message to Unified Database
            await prisma.unifiedMessage.create({
                data: {
                    userId: 'default', // Mapping to current user
                    platform: 'whatsapp',
                    contactId: contactId,
                    contactName: contactName,
                    content: content,
                    direction: 'INBOUND',
                }
            });

            // 2. Execute AI Auto-Responder Logic
            // Retrieve active rule from global memory or DB
            // (We'll use global variable for now to match current engine, 
            // but in production this should be in DB)
            const rule = global.__whatsappRule;
            
            if (rule && content) {
                console.log(`🤖 [WHAPI] Triggering AI Responder for ${contactId}`);
                
                // Simulate processing delay
                await new Promise(resolve => setTimeout(resolve, 1500));

                const persona = rule.persona || 'assistant';
                const responseText = `*[Zynco AI]* Thanks for reaching out! I'm acting as your ${persona}.\n\n_Powered by Whapi.cloud_`;

                // 3. Dispatch outbound message via Whapi REST API
                const apiToken = process.env.WHAPI_API_TOKEN || localStorage.getItem('whapi_token');
                
                if (apiToken) {
                    await fetch('https://gate.whapi.cloud/messages/text', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            to: contactId,
                            body: responseText
                        })
                    });
                    
                    // 4. Log outbound response
                    await prisma.unifiedMessage.create({
                        data: {
                            userId: 'default',
                            platform: 'whatsapp',
                            contactId: contactId,
                            contactName: contactName,
                            content: responseText,
                            direction: 'OUTBOUND',
                        }
                    });
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('❌ [WHAPI WEBHOOK ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Support for Whapi verification if needed
export async function GET() {
    return NextResponse.json({ status: 'Whapi Webhook Operational' });
}
