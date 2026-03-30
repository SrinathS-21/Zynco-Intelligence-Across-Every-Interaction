import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { to, content, scheduleAt } = await req.json();
        
        // Handle bulk recipients (comma separated)
        const recipientList = to.split(',').map((r: string) => r.trim()).filter(Boolean);
        const results = [];

        for (const recipient of recipientList) {
            try {
                const client = global.__whatsappClient;
                const waStatus = global.__whatsappStatus;

                if (!client || waStatus !== 'READY') {
                    results.push({ recipient, error: 'WhatsApp Client not ready' });
                    continue;
                }

                // Resolve the number to a valid WhatsApp ID if it doesn't already have a suffix
                let targetId = recipient;
                if (!recipient.includes('@')) {
                    const cleanNumber = recipient.replace(/\D/g, '');
                    const numberId = await client.getNumberId(cleanNumber);
                    if (!numberId) {
                        results.push({ recipient, error: 'Number not on WhatsApp' });
                        continue;
                    }
                    targetId = numberId._serialized;
                }

                const currentPrisma = global.__mailAgentPrisma || prisma;

                // 1. If scheduling for future
                if (scheduleAt && new Date(scheduleAt) > new Date()) {
                    await currentPrisma.scheduledMessage.create({
                        data: {
                            userId: 'default',
                            to: targetId,
                            content: content,
                            platform: 'whatsapp',
                            scheduledFor: new Date(scheduleAt),
                            status: 'PENDING'
                        }
                    });
                    results.push({ recipient, status: 'SCHEDULED' });
                } else {
                    // 2. Send immediately
                    await client.sendMessage(targetId, content);
                    
                    // 3. Persist to unified message history
                    try {
                        const contact = await client.getContactById(targetId);
                        await currentPrisma.unifiedMessage.create({
                            data: {
                                userId: 'default',
                                platform: 'whatsapp',
                                contactId: targetId,
                                contactName: contact.pushname || contact.name || targetId.split('@')[0],
                                content: content,
                                direction: 'OUTBOUND',
                            }
                        });
                    } catch (persistErr) {
                        console.error('Failed to persist outbound message history:', persistErr);
                    }
                    results.push({ recipient, status: 'SENT' });
                }
            } catch (err: any) {
                console.error(`Error sending to ${recipient}:`, err);
                results.push({ recipient, error: err.message });
            }
        }

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Bulk send error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
