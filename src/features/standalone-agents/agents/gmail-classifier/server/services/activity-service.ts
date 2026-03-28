import prisma from "@/lib/db";
import { ActivityLog } from "@/lib/activity-history";

export async function getAgentActivityLogs(agentId: string, userId: string, type?: string) {
    const agent = await prisma.standaloneAgent.findUnique({
        where: { id: agentId, userId },
        select: { config: true },
    });

    if (!agent) throw new Error("Agent not found");

    const config = agent.config as any;
    let activityLogs: ActivityLog[] = config?.activityLogs || [];

    // Filter by type if specified
    if (type && type !== 'all') {
        activityLogs = activityLogs.filter(log => log.type === type);
    }

    // Sort by timestamp descending (newest first)
    activityLogs.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
        success: true,
        logs: activityLogs.slice(0, 50), // Default limit of 50
        total: activityLogs.length,
    };
}
