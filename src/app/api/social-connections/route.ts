import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getConfig, getData, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";
import { AgentConfig, AgentData, ActivityLog, DashboardMetricsSnapshot, SocialChannel } from "@/lib/types";

const updateSchema = z.object({
  channel: z.enum(["instagram", "linkedin", "twitter"]).optional(),
  accountId: z.string().optional(),
  recipients: z.array(z.string().min(1).max(120)).max(50).optional(),
  onboardingCompleted: z.boolean().optional(),
});

function sanitizeRecipients(value: string[] | undefined) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  value.forEach((item) => {
    const trimmed = String(item || "").trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });

  return result.slice(0, 50);
}

function createActivityLog(channel: SocialChannel, accountId: string): ActivityLog {
  const connected = Boolean(accountId);
  return {
    id: globalThis.crypto?.randomUUID?.() || `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "connection",
    action: connected ? `Connected ${channel}` : `Disconnected ${channel}`,
    details: connected
      ? `${channel} account linked (${accountId.slice(0, 24)})`
      : `${channel} account unlinked`,
    status: "success",
    timestamp: new Date().toISOString(),
    metadata: {
      channel,
      connected,
      accountId,
    },
  };
}

function buildConnectionMetrics(config: AgentConfig, data: AgentData): DashboardMetricsSnapshot {
  const socialConnections = config.socialConnections || {};
  const recipients = config.directMessageRecipients || {};
  const emails = Array.isArray(data.emails) ? data.emails : [];

  const unreadEmails = emails.filter((email) => !Boolean(email?.isRead ?? email?.read)).length;
  const highPriorityEmails = emails.filter((email) => {
    const priority = String(email?.priority || "").toLowerCase();
    return priority === "high" || priority === "critical";
  }).length;

  const connections = {
    gmail: Boolean(config.accessToken),
    instagram: Boolean(socialConnections.instagram?.accountId),
    linkedin: Boolean(socialConnections.linkedin?.accountId),
    twitter: Boolean(socialConnections.twitter?.accountId),
    jira: Boolean(config.jira?.accessToken),
  };

  const connectedChannels = Object.values(connections).filter(Boolean).length;

  return {
    connectedChannels,
    totalChannels: 5,
    connections,
    activity: {
      totalUpdates: 0,
      failedUpdates: 0,
      pendingUpdates: 0,
      outboundRate: 0,
      outboundCount: 0,
      inboundCount: 0,
    },
    email: {
      totalEmails: emails.length,
      unreadEmails,
      highPriorityEmails,
    },
    social: {
      instagramRecipients: sanitizeRecipients(recipients.instagram).length,
      linkedinRecipients: sanitizeRecipients(recipients.linkedin).length,
      twitterRecipients: sanitizeRecipients(recipients.twitter).length,
    },
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeConnections(config: AgentConfig, data: AgentData) {
  const metrics = data.dashboardMetrics || buildConnectionMetrics(config, data);

  return {
    connections: {
      instagram: config.socialConnections?.instagram?.accountId || "",
      linkedin: config.socialConnections?.linkedin?.accountId || "",
      twitter: config.socialConnections?.twitter?.accountId || "",
    },
    recipients: {
      instagram: sanitizeRecipients(config.directMessageRecipients?.instagram),
      linkedin: sanitizeRecipients(config.directMessageRecipients?.linkedin),
      twitter: sanitizeRecipients(config.directMessageRecipients?.twitter),
    },
    connectionMeta: {
      instagram: {
        connectedAt: config.socialConnections?.instagram?.connectedAt || null,
        status: config.socialConnections?.instagram?.status || "disconnected",
      },
      linkedin: {
        connectedAt: config.socialConnections?.linkedin?.connectedAt || null,
        status: config.socialConnections?.linkedin?.status || "disconnected",
      },
      twitter: {
        connectedAt: config.socialConnections?.twitter?.connectedAt || null,
        status: config.socialConnections?.twitter?.status || "disconnected",
      },
    },
    onboardingCompleted: Boolean(config.socialOnboardingCompleted),
    metrics,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const agent = await getOrCreateDefaultAgent(user.id);
    const config = getConfig(agent);
    const data = getData(agent);
    return ok(sanitizeConnections(config, data));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return serverError(error, "Failed to load social connections");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid payload");
    }

    const { channel, accountId, recipients, onboardingCompleted } = parsed.data;

    if (!channel && typeof onboardingCompleted !== "boolean") {
      return badRequest("Nothing to update");
    }

    if (recipients && !channel) {
      return badRequest("channel is required when updating recipients");
    }

    const agent = await getOrCreateDefaultAgent(user.id);
    const currentConfig = getConfig(agent);
    const currentData = getData(agent);

    const nextConfig: AgentConfig = {
      ...currentConfig,
      socialConnections: {
        instagram: { ...(currentConfig.socialConnections?.instagram || {}) },
        linkedin: { ...(currentConfig.socialConnections?.linkedin || {}) },
        twitter: { ...(currentConfig.socialConnections?.twitter || {}) },
      },
      directMessageRecipients: {
        instagram: sanitizeRecipients(currentConfig.directMessageRecipients?.instagram),
        linkedin: sanitizeRecipients(currentConfig.directMessageRecipients?.linkedin),
        twitter: sanitizeRecipients(currentConfig.directMessageRecipients?.twitter),
      },
    };

    if (channel && typeof accountId === "string") {
      const nextAccountId = (accountId || "").trim();
      nextConfig.socialConnections![channel] = {
        accountId: nextAccountId,
        connectedAt: nextAccountId ? new Date().toISOString() : null,
        disconnectedAt: nextAccountId ? null : new Date().toISOString(),
        status: nextAccountId ? "connected" : "disconnected",
      };

      const currentLogs = Array.isArray(currentConfig.activityLogs) ? currentConfig.activityLogs : [];
      nextConfig.activityLogs = [createActivityLog(channel, nextAccountId), ...currentLogs].slice(0, 300);
    }

    if (typeof onboardingCompleted === "boolean") {
      nextConfig.socialOnboardingCompleted = onboardingCompleted;
    }

    if (channel && recipients) {
      nextConfig.directMessageRecipients![channel] = sanitizeRecipients(recipients);
    }

    const nextData: AgentData = {
      ...currentData,
      dashboardMetrics: buildConnectionMetrics(nextConfig, currentData),
    };

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        config: nextConfig as any,
        data: nextData as any,
      },
    });

    return ok(sanitizeConnections(nextConfig, nextData));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return serverError(error, "Failed to save social connections");
  }
}
