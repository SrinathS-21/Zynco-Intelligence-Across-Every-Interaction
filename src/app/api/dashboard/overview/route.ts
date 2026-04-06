import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConfig, getData, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { ok, serverError, unauthorized } from "@/lib/http";
import { AgentConfig, AgentData, DashboardMetricsSnapshot, StoredEmail } from "@/lib/types";

type SocialChannel = "instagram" | "linkedin" | "twitter";

type DashboardUpdate = {
  id: string;
  source: "email" | "instagram" | "linkedin" | "twitter" | "whatsapp" | "automation";
  platform: string;
  title: string;
  description: string;
  timestamp: string;
  status: "success" | "failed" | "pending";
  kind: "message" | "post" | "activity";
  direction?: "INBOUND" | "OUTBOUND";
  contactName?: string;
};

function normalizeStatus(value: unknown): "success" | "failed" | "pending" {
  if (value === "failed") return "failed";
  if (value === "pending") return "pending";
  return "success";
}

function normalizeRecipients(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  const result = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 50);
  return result;
}

function readMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return {} as Record<string, unknown>;
  return metadata as Record<string, unknown>;
}

function sourceFromPlatform(platform: string): DashboardUpdate["source"] {
  const normalized = platform.toLowerCase().trim();
  if (normalized === "email" || normalized === "gmail") return "email";
  if (normalized === "instagram") return "instagram";
  if (normalized === "linkedin") return "linkedin";
  if (normalized === "twitter" || normalized === "x") return "twitter";
  if (normalized === "whatsapp") return "whatsapp";
  return "automation";
}

function sourceFromActivityLog(log: Record<string, unknown>): DashboardUpdate["source"] {
  const haystack = `${String(log.type || "")} ${String(log.action || "")} ${String(log.details || "")} ${String(log.platform || "")}`.toLowerCase();

  if (/(gmail|email|inbox)/.test(haystack)) return "email";
  if (/instagram/.test(haystack)) return "instagram";
  if (/linkedin/.test(haystack)) return "linkedin";
  if (/(twitter|\bx\b)/.test(haystack)) return "twitter";
  if (/whatsapp/.test(haystack)) return "whatsapp";

  return "automation";
}

function titleForMessage(platform: string, direction: string) {
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  if (direction === "OUTBOUND") return `${platformLabel} update published`;
  return `${platformLabel} conversation updated`;
}

function parseIsoDateOrNow(value: unknown) {
  const raw = String(value || "").trim();
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

function normalizeSender(value: unknown) {
  const from = String(value || "").trim();
  if (!from) return "Unknown sender";

  const match = from.match(/^\s*([^<]+)\s*<[^>]+>\s*$/);
  if (match?.[1]) return match[1].trim();
  return from;
}

function buildMetricsSnapshot(params: {
  config: AgentConfig;
  emails: StoredEmail[];
  updates: DashboardUpdate[];
  recipients: Partial<Record<SocialChannel, string[]>>;
}) {
  const { config, emails, updates, recipients } = params;

  const connections = {
    gmail: Boolean(config.accessToken),
    instagram: Boolean(config.socialConnections?.instagram?.accountId),
    linkedin: Boolean(config.socialConnections?.linkedin?.accountId),
    twitter: Boolean(config.socialConnections?.twitter?.accountId),
    jira: Boolean(config.jira?.accessToken),
  };

  const connectedChannels = Object.values(connections).filter(Boolean).length;
  const failedUpdates = updates.filter((item) => item.status === "failed").length;
  const pendingUpdates = updates.filter((item) => item.status === "pending").length;

  const directional = updates.filter((item) => item.direction === "INBOUND" || item.direction === "OUTBOUND");
  const outboundCount = directional.filter((item) => item.direction === "OUTBOUND").length;
  const inboundCount = directional.filter((item) => item.direction === "INBOUND").length;
  const outboundRate = directional.length > 0 ? Math.round((outboundCount / directional.length) * 100) : 0;

  const unreadEmails = emails.filter((email) => !Boolean(email?.isRead ?? email?.read)).length;
  const highPriorityEmails = emails.filter((email) => {
    const priority = String(email?.priority || "").toLowerCase();
    return priority === "high" || priority === "critical";
  }).length;

  const metrics: DashboardMetricsSnapshot = {
    connectedChannels,
    totalChannels: 5,
    connections,
    activity: {
      totalUpdates: updates.length,
      failedUpdates,
      pendingUpdates,
      outboundRate,
      outboundCount,
      inboundCount,
    },
    email: {
      totalEmails: emails.length,
      unreadEmails,
      highPriorityEmails,
    },
    social: {
      instagramRecipients: normalizeRecipients(recipients.instagram).length,
      linkedinRecipients: normalizeRecipients(recipients.linkedin).length,
      twitterRecipients: normalizeRecipients(recipients.twitter).length,
    },
    updatedAt: new Date().toISOString(),
  };

  return metrics;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const agent = await getOrCreateDefaultAgent(user.id);
    const config = getConfig(agent);
    const data = getData(agent);

    const socialConnections = config.socialConnections || {};
    const directRecipients = config.directMessageRecipients || {};
    const twitterConnection = socialConnections.twitter || {};
    const twitterTokenPresent = Boolean(twitterConnection.oauthAccessToken || twitterConnection.oauthRefreshToken);
    const twitterConnected = Boolean(
      twitterConnection.accountId
      && twitterTokenPresent
      && twitterConnection.status !== "disconnected",
    );

    const emails = Array.isArray(data.emails) ? data.emails : [];
    const unreadEmails = emails.filter((email) => !Boolean(email?.isRead ?? email?.read)).length;
    const highPriorityEmails = emails.filter((email) => {
      const priority = String(email?.priority || "").toLowerCase();
      return priority === "high" || priority === "critical";
    }).length;

    const activityLogs = Array.isArray(config.activityLogs) ? config.activityLogs : [];

    const messages = await prisma.unifiedMessage.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: "desc" },
      take: 260,
    });

    const messageUpdates: DashboardUpdate[] = messages.map((message) => {
      const metadata = readMetadata(message.metadata);
      const status = normalizeStatus(metadata.status);
      const direction = String(message.direction || "INBOUND") === "OUTBOUND" ? "OUTBOUND" : "INBOUND";

      return {
        id: message.id,
        source: sourceFromPlatform(message.platform),
        platform: message.platform,
        title: titleForMessage(message.platform, direction),
        description: String(message.content || "").slice(0, 200),
        timestamp: message.timestamp.toISOString(),
        status,
        kind: direction === "OUTBOUND" ? "post" : "message",
        direction,
        contactName: message.contactName || message.contactId,
      };
    });

    const emailInboxUpdates: DashboardUpdate[] = emails
      .slice(0, 180)
      .map((email) => {
        const isUnread = !Boolean(email?.isRead ?? email?.read);
        const priority = String(email?.priority || "").toLowerCase();

        return {
          id: `email_${String(email?.id || Math.random().toString(36).slice(2, 10))}`,
          source: "email",
          platform: "gmail",
          title: String(email?.subject || "(No subject)"),
          description: String(email?.snippet || email?.body || "No preview available").slice(0, 220),
          timestamp: parseIsoDateOrNow(email?.date),
          status: isUnread || priority === "high" || priority === "critical" ? "pending" : "success",
          kind: "message",
          direction: "INBOUND",
          contactName: normalizeSender(email?.from),
        };
      });

    const emailAndAutomationUpdates: DashboardUpdate[] = activityLogs.map((log) => {
      const normalizedLog = (log && typeof log === "object") ? (log as unknown as Record<string, unknown>) : {};

      return {
        id: String(normalizedLog.id || `log_${Math.random().toString(36).slice(2, 8)}`),
        source: sourceFromActivityLog(normalizedLog),
        platform: String(normalizedLog.type || normalizedLog.platform || "activity"),
        title: String(normalizedLog.action || "Activity"),
        description: String(normalizedLog.details || ""),
        timestamp: String(normalizedLog.timestamp || new Date().toISOString()),
        status: normalizeStatus(normalizedLog.status),
        kind: "activity",
      };
    });

    const updates = [...emailInboxUpdates, ...messageUpdates, ...emailAndAutomationUpdates]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 220);

    const metrics = buildMetricsSnapshot({
      config,
      emails,
      updates,
      recipients: directRecipients,
    });

    const nextData: AgentData = {
      ...(data as AgentData),
      dashboardMetrics: metrics,
    };

    await prisma.agent.update({
      where: { id: agent.id },
      data: { data: nextData as any },
    });

    const response = {
      connections: {
        gmail: Boolean(config.accessToken),
        instagram: Boolean(socialConnections.instagram?.accountId),
        linkedin: Boolean(socialConnections.linkedin?.accountId),
        twitter: twitterConnected,
        jira: Boolean(config.jira?.accessToken),
      },
      socialAccounts: {
        instagram: socialConnections.instagram?.accountId || "",
        linkedin: socialConnections.linkedin?.accountId || "",
        twitter: socialConnections.twitter?.accountId || "",
      },
      connectionMeta: {
        instagram: {
          accountId: socialConnections.instagram?.accountId || null,
          username: socialConnections.instagram?.username || null,
          displayName: socialConnections.instagram?.displayName || null,
          avatarUrl: socialConnections.instagram?.avatarUrl || null,
          externalUserId: socialConnections.instagram?.externalUserId || null,
          connectedAt: socialConnections.instagram?.connectedAt || null,
          status: socialConnections.instagram?.status || "disconnected",
        },
        linkedin: {
          accountId: socialConnections.linkedin?.accountId || null,
          username: socialConnections.linkedin?.username || null,
          displayName: socialConnections.linkedin?.displayName || null,
          avatarUrl: socialConnections.linkedin?.avatarUrl || null,
          externalUserId: socialConnections.linkedin?.externalUserId || null,
          connectedAt: socialConnections.linkedin?.connectedAt || null,
          status: socialConnections.linkedin?.status || "disconnected",
        },
        twitter: {
          accountId: socialConnections.twitter?.accountId || null,
          username: socialConnections.twitter?.username || socialConnections.twitter?.accountId || null,
          displayName: socialConnections.twitter?.displayName || null,
          avatarUrl: socialConnections.twitter?.avatarUrl || null,
          externalUserId: socialConnections.twitter?.externalUserId || null,
          connectedAt: socialConnections.twitter?.connectedAt || null,
          status: socialConnections.twitter?.status || "disconnected",
        },
      },
      recipients: {
        instagram: normalizeRecipients(directRecipients.instagram),
        linkedin: normalizeRecipients(directRecipients.linkedin),
        twitter: normalizeRecipients(directRecipients.twitter),
      },
      gmail: {
        email: config.gmailEmail || null,
        totalEmails: emails.length,
        unreadEmails,
        highPriorityEmails,
        lastSync: data.lastSync || null,
      },
      jira: {
        connected: Boolean(config.jira?.accessToken),
        siteName: config.jira?.siteName || null,
        siteUrl: config.jira?.siteUrl || null,
        projectKey: config.jiraProjectKey || null,
      },
      metrics,
      updates,
      activity: activityLogs.slice(0, 120),
    };

    return ok(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return serverError(error, "Failed to load dashboard overview");
  }
}
