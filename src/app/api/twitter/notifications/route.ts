import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import type { AgentConfig } from "@/lib/types";

type DashboardPreferences = {
    notifications: {
        lastReadAt: string | null;
        showOnlyUnread: boolean;
        muteSound: boolean;
        readItemIds: string[];
        unreadItemIds: string[];
    };
    workspace: {
        compactMode: boolean;
        defaultSection: string;
    };
};

type AgentConfigWithDashboardPreferences = AgentConfig & {
    dashboardPreferences?: Partial<DashboardPreferences>;
};

const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
    notifications: {
        lastReadAt: null,
        showOnlyUnread: false,
        muteSound: false,
        readItemIds: [],
        unreadItemIds: [],
    },
    workspace: {
        compactMode: false,
        defaultSection: "workspace",
    },
};

function normalizeDashboardPreferences(raw: unknown): DashboardPreferences {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

    const notifications =
        source.notifications && typeof source.notifications === "object"
            ? (source.notifications as Record<string, unknown>)
            : {};

    const workspace =
        source.workspace && typeof source.workspace === "object"
            ? (source.workspace as Record<string, unknown>)
            : {};

    const parsedLastReadAt =
        typeof notifications.lastReadAt === "string" && !Number.isNaN(new Date(notifications.lastReadAt).getTime())
            ? notifications.lastReadAt
            : null;

    const readItemIds = Array.isArray(notifications.readItemIds)
        ? notifications.readItemIds
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
            .slice(0, 400)
        : [];

    const unreadItemIds = Array.isArray(notifications.unreadItemIds)
        ? notifications.unreadItemIds
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
            .slice(0, 400)
        : [];

    return {
        notifications: {
            lastReadAt: parsedLastReadAt,
            showOnlyUnread:
                typeof notifications.showOnlyUnread === "boolean"
                    ? notifications.showOnlyUnread
                    : DEFAULT_DASHBOARD_PREFERENCES.notifications.showOnlyUnread,
            muteSound:
                typeof notifications.muteSound === "boolean"
                    ? notifications.muteSound
                    : DEFAULT_DASHBOARD_PREFERENCES.notifications.muteSound,
            readItemIds,
            unreadItemIds,
        },
        workspace: {
            compactMode:
                typeof workspace.compactMode === "boolean"
                    ? workspace.compactMode
                    : DEFAULT_DASHBOARD_PREFERENCES.workspace.compactMode,
            defaultSection:
                typeof workspace.defaultSection === "string" && workspace.defaultSection.trim()
                    ? workspace.defaultSection
                    : DEFAULT_DASHBOARD_PREFERENCES.workspace.defaultSection,
        },
    };
}

function normalizeStatus(value: unknown): "success" | "failed" | "pending" {
    if (value === "failed") return "failed";
    if (value === "pending") return "pending";
    return "success";
}

function parseLimit(value: string | null) {
    const parsed = Number(value || "40");
    if (!Number.isFinite(parsed)) return 40;
    return Math.max(10, Math.min(120, Math.trunc(parsed)));
}

function readMetadata(metadata: unknown) {
    if (!metadata || typeof metadata !== "object") return {} as Record<string, unknown>;
    return metadata as Record<string, unknown>;
}

function readTimestampOrNow(value: unknown) {
    if (typeof value === "string" && !Number.isNaN(new Date(value).getTime())) {
        return value;
    }
    return new Date().toISOString();
}

export async function GET(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const agent = await getOrCreateDefaultAgent(user.id);
        const config = getConfig(agent) as AgentConfigWithDashboardPreferences;

        const preferences = normalizeDashboardPreferences(config.dashboardPreferences);
        const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
        const unreadOnly = request.nextUrl.searchParams.get("unread_only") === "1";

        const cutoffMs = preferences.notifications.lastReadAt
            ? new Date(preferences.notifications.lastReadAt).getTime()
            : null;
        const readItemIdSet = new Set(preferences.notifications.readItemIds);
        const unreadItemIdSet = new Set(preferences.notifications.unreadItemIds);

        const rows = await prisma.unifiedMessage.findMany({
            where: {
                userId: user.id,
                platform: "twitter",
            },
            orderBy: {
                timestamp: "desc",
            },
            take: Math.max(limit * 2, 120),
        });

        const items = rows.map((row) => {
            const metadata = readMetadata(row.metadata);
            const direction = row.direction === "OUTBOUND" ? "OUTBOUND" : "INBOUND";
            const timestamp = row.timestamp.toISOString();
            const itemMs = new Date(timestamp).getTime();
            const unread = unreadItemIdSet.has(row.id)
                || (!readItemIdSet.has(row.id) && (cutoffMs === null || Number.isNaN(itemMs) || itemMs > cutoffMs));
            const tweetId =
                typeof metadata.tweetId === "string"
                    ? metadata.tweetId
                    : typeof metadata.twitterUrn === "string"
                        ? metadata.twitterUrn
                        : typeof metadata.id === "string"
                            ? metadata.id
                            : "";
            const url =
                typeof metadata.url === "string" && metadata.url.trim()
                    ? metadata.url.trim()
                    : null;

            return {
                id: row.id,
                title:
                    direction === "OUTBOUND"
                        ? "Tweet activity updated"
                        : "New conversation activity",
                description: row.content.slice(0, 220),
                timestamp,
                status: normalizeStatus(metadata.status),
                direction,
                contactName: row.contactName || row.contactId || null,
                tweetId: tweetId || null,
                url,
                unread,
            };
        });

        const filtered = unreadOnly ? items.filter((item) => item.unread) : items;
        const sliced = filtered.slice(0, limit);

        return NextResponse.json({
            success: true,
            items: sliced,
            summary: {
                totalCount: items.length,
                unreadCount: items.filter((item) => item.unread).length,
                inboundCount: items.filter((item) => item.direction === "INBOUND").length,
                outboundCount: items.filter((item) => item.direction === "OUTBOUND").length,
                lastReadAt: preferences.notifications.lastReadAt,
            },
            preferences: {
                showOnlyUnread: preferences.notifications.showOnlyUnread,
                lastReadAt: preferences.notifications.lastReadAt,
                readItemIds: preferences.notifications.readItemIds,
                unreadItemIds: preferences.notifications.unreadItemIds,
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to load Twitter notifications";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await requireUser(request);
        const body = await request.json().catch(() => ({}));

        const action = typeof body?.action === "string" ? body.action : "";
        if (action !== "mark_all_read" && action !== "mark_read" && action !== "mark_unread") {
            return NextResponse.json(
                { error: "Unsupported action. Use action=mark_all_read, action=mark_read, or action=mark_unread." },
                { status: 400 },
            );
        }

        const agent = await getOrCreateDefaultAgent(user.id);
        const currentConfig = getConfig(agent) as AgentConfigWithDashboardPreferences;
        const currentPreferences = normalizeDashboardPreferences(currentConfig.dashboardPreferences);

        if (action === "mark_read") {
            const notificationId = typeof body?.notificationId === "string" ? body.notificationId.trim() : "";
            if (!notificationId) {
                return NextResponse.json({ error: "notificationId is required for mark_read." }, { status: 400 });
            }

            const nextReadItemIds = [
                notificationId,
                ...currentPreferences.notifications.readItemIds.filter((id) => id !== notificationId),
            ].slice(0, 400);

            const nextConfig: AgentConfigWithDashboardPreferences = {
                ...currentConfig,
                dashboardPreferences: {
                    notifications: {
                        ...currentPreferences.notifications,
                        readItemIds: nextReadItemIds,
                        unreadItemIds: currentPreferences.notifications.unreadItemIds.filter((id) => id !== notificationId),
                    },
                    workspace: {
                        ...currentPreferences.workspace,
                    },
                },
            };

            await prisma.agent.update({
                where: { id: agent.id },
                data: {
                    config: nextConfig as any,
                },
            });

            return NextResponse.json({
                success: true,
                action,
                notificationId,
            });
        }

        if (action === "mark_unread") {
            const notificationId = typeof body?.notificationId === "string" ? body.notificationId.trim() : "";
            if (!notificationId) {
                return NextResponse.json({ error: "notificationId is required for mark_unread." }, { status: 400 });
            }

            const nextUnreadItemIds = [
                notificationId,
                ...currentPreferences.notifications.unreadItemIds.filter((id) => id !== notificationId),
            ].slice(0, 400);

            const nextConfig: AgentConfigWithDashboardPreferences = {
                ...currentConfig,
                dashboardPreferences: {
                    notifications: {
                        ...currentPreferences.notifications,
                        unreadItemIds: nextUnreadItemIds,
                        readItemIds: currentPreferences.notifications.readItemIds.filter((id) => id !== notificationId),
                    },
                    workspace: {
                        ...currentPreferences.workspace,
                    },
                },
            };

            await prisma.agent.update({
                where: { id: agent.id },
                data: {
                    config: nextConfig as any,
                },
            });

            return NextResponse.json({
                success: true,
                action,
                notificationId,
            });
        }

        const nextLastReadAt = readTimestampOrNow(body?.lastReadAt);

        const nextConfig: AgentConfigWithDashboardPreferences = {
            ...currentConfig,
            dashboardPreferences: {
                notifications: {
                    ...currentPreferences.notifications,
                    lastReadAt: nextLastReadAt,
                    readItemIds: [],
                    unreadItemIds: [],
                },
                workspace: {
                    ...currentPreferences.workspace,
                },
            },
        };

        await prisma.agent.update({
            where: { id: agent.id },
            data: {
                config: nextConfig as any,
            },
        });

        return NextResponse.json({
            success: true,
            action,
            lastReadAt: nextLastReadAt,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const message = error instanceof Error ? error.message : "Failed to update Twitter notifications";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
