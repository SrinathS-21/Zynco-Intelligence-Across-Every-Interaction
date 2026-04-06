import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { ensureTwitterAccessToken } from "@/lib/twitter/oauth";

export async function GET(request: NextRequest) {
    try {
        const user = await requireUser(request);

        try {
            const agent = await getOrCreateDefaultAgent(user.id);
            const config = getConfig(agent);
            const hasTwitterConnection = Boolean(config.socialConnections?.twitter?.accountId || config.socialConnections?.twitter?.username);
            if (hasTwitterConnection) {
                await ensureTwitterAccessToken({
                    agentId: agent.id,
                    config,
                });
            }
        } catch {
            // Silent refresh failures should not block local history reads.
        }

        const posts = await prisma.unifiedMessage.findMany({
            where: {
                platform: "twitter",
                direction: "OUTBOUND",
                userId: user.id,
            },
            orderBy: {
                timestamp: "desc",
            },
            take: 30,
        });

        const formattedPosts = posts.map((post) => {
            const metadata =
                post.metadata && typeof post.metadata === "object"
                    ? (post.metadata as Record<string, unknown>)
                    : {};

            const urn =
                typeof metadata.twitterUrn === "string"
                    ? metadata.twitterUrn
                    : typeof metadata.tweetId === "string"
                        ? metadata.tweetId
                        : null;

            const url = typeof metadata.url === "string" ? metadata.url : null;

            return {
                id: post.id,
                content: post.content,
                timestamp: post.timestamp,
                title: typeof metadata.title === "string" ? metadata.title : "Twitter Update",
                status: typeof metadata.status === "string" ? metadata.status : "PUBLISHED",
                urn,
                url,
            };
        });

        return NextResponse.json(formattedPosts);
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.error("Error fetching Twitter post history:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
