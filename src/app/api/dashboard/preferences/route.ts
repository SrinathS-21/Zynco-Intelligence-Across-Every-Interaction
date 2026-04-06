import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConfig, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";
import { AgentConfig } from "@/lib/types";

const dashboardSectionSchema = z.enum([
  "workspace",
  "email",
  "instagram",
  "linkedin",
  "twitter",
  "network",
  "updates",
  "chat",
  "docs",
  "projects",
  "insights",
]);

type DashboardSection = z.infer<typeof dashboardSectionSchema>;

type DashboardPreferences = {
  notifications: {
    lastReadAt: string | null;
    showOnlyUnread: boolean;
    muteSound: boolean;
  };
  workspace: {
    compactMode: boolean;
    defaultSection: DashboardSection;
  };
};

type AgentConfigWithDashboardPreferences = AgentConfig & {
  dashboardPreferences?: Partial<DashboardPreferences>;
};

const dashboardPreferencesPatchSchema = z
  .object({
    notifications: z
      .object({
        lastReadAt: z.string().datetime().nullable().optional(),
        showOnlyUnread: z.boolean().optional(),
        muteSound: z.boolean().optional(),
      })
      .optional(),
    workspace: z
      .object({
        compactMode: z.boolean().optional(),
        defaultSection: dashboardSectionSchema.optional(),
      })
      .optional(),
  })
  .strict();

const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  notifications: {
    lastReadAt: null,
    showOnlyUnread: false,
    muteSound: false,
  },
  workspace: {
    compactMode: false,
    defaultSection: "workspace",
  },
};

function normalizeDashboardPreferences(raw: unknown): DashboardPreferences {
  const incoming = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const notificationsRaw =
    incoming.notifications && typeof incoming.notifications === "object"
      ? (incoming.notifications as Record<string, unknown>)
      : {};

  const workspaceRaw =
    incoming.workspace && typeof incoming.workspace === "object"
      ? (incoming.workspace as Record<string, unknown>)
      : {};

  const parsedLastReadAt =
    typeof notificationsRaw.lastReadAt === "string" && !Number.isNaN(new Date(notificationsRaw.lastReadAt).getTime())
      ? notificationsRaw.lastReadAt
      : null;

  const parsedDefaultSection =
    typeof workspaceRaw.defaultSection === "string" && dashboardSectionSchema.safeParse(workspaceRaw.defaultSection).success
      ? (workspaceRaw.defaultSection as DashboardSection)
      : DEFAULT_DASHBOARD_PREFERENCES.workspace.defaultSection;

  return {
    notifications: {
      lastReadAt: parsedLastReadAt,
      showOnlyUnread:
        typeof notificationsRaw.showOnlyUnread === "boolean"
          ? notificationsRaw.showOnlyUnread
          : DEFAULT_DASHBOARD_PREFERENCES.notifications.showOnlyUnread,
      muteSound:
        typeof notificationsRaw.muteSound === "boolean"
          ? notificationsRaw.muteSound
          : DEFAULT_DASHBOARD_PREFERENCES.notifications.muteSound,
    },
    workspace: {
      compactMode:
        typeof workspaceRaw.compactMode === "boolean"
          ? workspaceRaw.compactMode
          : DEFAULT_DASHBOARD_PREFERENCES.workspace.compactMode,
      defaultSection: parsedDefaultSection,
    },
  };
}

function mergeDashboardPreferences(
  current: DashboardPreferences,
  patch: z.infer<typeof dashboardPreferencesPatchSchema>,
): DashboardPreferences {
  return {
    notifications: {
      ...current.notifications,
      ...(patch.notifications || {}),
    },
    workspace: {
      ...current.workspace,
      ...(patch.workspace || {}),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const agent = await getOrCreateDefaultAgent(user.id);
    const config = getConfig(agent) as AgentConfigWithDashboardPreferences;
    const preferences = normalizeDashboardPreferences(config.dashboardPreferences);

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      preferences,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return serverError(error, "Failed to load dashboard preferences");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const parsed = dashboardPreferencesPatchSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid dashboard preferences payload");
    }

    if (!parsed.data.notifications && !parsed.data.workspace) {
      return badRequest("Nothing to update");
    }

    const agent = await getOrCreateDefaultAgent(user.id);
    const currentConfig = getConfig(agent) as AgentConfigWithDashboardPreferences;
    const currentPreferences = normalizeDashboardPreferences(currentConfig.dashboardPreferences);
    const nextPreferences = mergeDashboardPreferences(currentPreferences, parsed.data);

    const nextConfig: AgentConfigWithDashboardPreferences = {
      ...currentConfig,
      dashboardPreferences: nextPreferences,
    };

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        config: nextConfig as any,
      },
    });

    return ok({ preferences: nextPreferences });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return serverError(error, "Failed to save dashboard preferences");
  }
}
