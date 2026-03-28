import prisma from "@/lib/db";
import { NotionClient } from "@/lib/notion/client";
import { createActivityLog, saveActivityLog } from "@/lib/activity-history";

export async function searchNotionResources(agentId: string, userId: string, query?: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const databases = config?.notion?.databases || [];

    let results = databases.map((db: any) => ({
        id: db.id,
        title: db.title || "Untitled Database",
        type: "database",
        icon: db.icon,
    }));

    if (query && query.trim()) {
        const lowerQuery = query.toLowerCase();
        results = results.filter((db: any) =>
            db.title.toLowerCase().includes(lowerQuery)
        );
    }

    return results;
}

export async function createNotionPage(agentId: string, userId: string, input: any) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    const accessToken = config?.notion?.accessToken;

    if (!accessToken) throw new Error("Notion not connected");

    const client = new NotionClient(accessToken);
    const result = await client.createPageWithParentType(
        input.title,
        input.content,
        input.parentId,
        input.parentType
    );

    const log = createActivityLog(
        'notion_page',
        'Notion Page Created',
        `Created from email/context: "${input.title}"`,
        'success',
        { tool: 'notion', pageId: result.id, emailSubject: input.title }
    );
    await saveActivityLog(prisma, agentId, log);

    return { success: true, pageId: result.id, url: result.url };
}
