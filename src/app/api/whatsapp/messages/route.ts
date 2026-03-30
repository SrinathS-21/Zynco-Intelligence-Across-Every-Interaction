import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const contactId = searchParams.get('contactId');

        if (!contactId) {
            return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
        }

        const currentPrisma = global.__mailAgentPrisma || prisma;
        if (!currentPrisma || !currentPrisma.unifiedMessage) {
            return NextResponse.json({ error: 'Database model not initialized' }, { status: 500 });
        }

        const messages = await currentPrisma.unifiedMessage.findMany({
            where: {
                platform: 'whatsapp',
                contactId: contactId,
                userId: 'default'
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        return NextResponse.json(messages);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
