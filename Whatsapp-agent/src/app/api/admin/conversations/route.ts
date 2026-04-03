import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const conversations = await prisma.conversation.findMany({
            include: {
                patient: true,
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json(conversations);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }
}
