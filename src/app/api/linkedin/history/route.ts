import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId') || 'default';

        const currentPrisma = (global as any).__mailAgentPrisma || prisma;
        
        if (!currentPrisma || !currentPrisma.unifiedMessage) {
            return NextResponse.json({ error: 'Database model not initialized' }, { status: 500 });
        }

        const posts = await currentPrisma.unifiedMessage.findMany({
            where: {
                platform: 'linkedin',
                direction: 'OUTBOUND',
                userId: userId
            },
            orderBy: {
                timestamp: 'desc'
            },
            take: 20
        });

        const formattedPosts = posts.map((post: any) => {
            const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {});
            return {
                id: post.id,
                content: post.content,
                timestamp: post.timestamp,
                mediaUrl: metadata.mediaUrl,
                title: metadata.title || 'LinkedIn Update',
                status: metadata.status || 'PUBLISHED',
                urn: metadata.linkedinUrn
            };
        });

        return NextResponse.json(formattedPosts);
    } catch (error) {
        console.error('Error fetching LinkedIn post history:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
