import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    try {
        const messages = await prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { timestamp: 'asc' }
        });

        return NextResponse.json(messages);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}
