import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const currentPrisma = global.__mailAgentPrisma || prisma;
        if (!currentPrisma || !currentPrisma.unifiedMessage) {
            return NextResponse.json({ error: 'Database model not initialized' }, { status: 500 });
        }

        // Group messages by contactId and get the latest message for each
        const messages = await currentPrisma.unifiedMessage.findMany({
            where: {
                platform: 'whatsapp',
                userId: 'default'
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        // Unique contacts based on latest message
        const contactsMap: Record<string, any> = {};
        messages.forEach(m => {
            if (!contactsMap[m.contactId]) {
                contactsMap[m.contactId] = {
                    id: m.contactId,
                    name: (m.contactName || m.contactId || "Unknown").split('@')[0],
                    lastMessage: m.content || "",
                    lastTimestamp: m.timestamp,
                    platform: 'whatsapp'
                };
            }
        });

        const contacts = Object.values(contactsMap);
        return NextResponse.json(contacts);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
