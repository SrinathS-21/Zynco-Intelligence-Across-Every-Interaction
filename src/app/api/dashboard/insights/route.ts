import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConfig, getData, getOrCreateDefaultAgent } from "@/lib/agent-store";
import { ok, serverError, unauthorized } from "@/lib/http";
import { ActivityLog, StoredEmail } from "@/lib/types";

type InsightPriority = "high" | "medium" | "low";

type InsightItem = {
  title: string;
  detail: string;
  priority: InsightPriority;
};

type InsightPayload = {
  headline: string;
  summary: string;
  anomalies: InsightItem[];
  suggestions: InsightItem[];
  improvements: InsightItem[];
};

type InsightMetrics = {
  signalScore: number;
  totalEvents24h: number;
  failedEvents24h: number;
  outboundRate24h: number;
  connectionCoverage: number;
  unreadEmails: number;
  highPriorityEmails: number;
  topChannel: string;
  topChannelVolume: number;
  activeAutomations7d: number;
  responseMomentum: number;
  channelVolumes24h: Record<string, number>;
  liveEvents15m: number;
  liveEvents1h: number;
  busiestHourEvents: number;
  busiestHourLabel: string;
};

type ChannelSummary = {
  channel: string;
  connected: boolean;
  events24h: number;
  prevEvents24h: number;
  deltaPct: number;
  failed24h: number;
  failureRate24h: number;
  inbound24h: number;
  outbound24h: number;
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const FIFTEEN_MIN = 15 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function readStatus(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const candidate = (metadata as Record<string, unknown>).status;
  return String(candidate || "").toLowerCase();
}

function toPriority(value: unknown): InsightPriority {
  if (value === "high") return "high";
  if (value === "low") return "low";
  return "medium";
}

function pctChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function hasGrounding(detail: string, tokens: string[]) {
  const lower = detail.toLowerCase();
  const hasNumber = /\d/.test(lower);
  const hasToken = tokens.some((token) => lower.includes(token));
  return hasNumber || hasToken;
}

function mergeItems(items: unknown, fallback: InsightItem[], tokens: string[]): InsightItem[] {
  if (!Array.isArray(items)) return fallback;

  const normalized = items
    .slice(0, 4)
    .map((item, index) => {
      if (!item || typeof item !== "object") return fallback[index] || null;
      const source = item as Record<string, unknown>;
      const fallbackItem = fallback[index] || fallback[fallback.length - 1] || null;
      if (!fallbackItem) return null;

      const title = String(source.title || fallbackItem.title).trim().slice(0, 90);
      const detailCandidate = String(source.detail || fallbackItem.detail).trim().slice(0, 220);
      const detail = hasGrounding(detailCandidate, tokens) ? detailCandidate : fallbackItem.detail;

      if (!title || !detail) return fallbackItem;
      return {
        title,
        detail,
        priority: toPriority(source.priority || fallbackItem.priority),
      } satisfies InsightItem;
    })
    .filter((item): item is InsightItem => Boolean(item));

  return normalized.length > 0 ? normalized : fallback;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
      } catch {
        // Continue to code block extraction.
      }
    }

    const codeBlockMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/i);
    if (codeBlockMatch?.[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim()) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildFallbackInsights(metrics: InsightMetrics, channels: ChannelSummary[]): InsightPayload {
  const anomalies: InsightItem[] = [];
  const suggestions: InsightItem[] = [];
  const improvements: InsightItem[] = [];
  const mostUnstableChannel = [...channels].sort((a, b) => b.failureRate24h - a.failureRate24h)[0];
  const largestDrop = [...channels].sort((a, b) => a.deltaPct - b.deltaPct)[0];
  const largestSpike = [...channels].sort((a, b) => b.deltaPct - a.deltaPct)[0];
  const silentConnected = channels.filter((channel) => channel.connected && channel.events24h === 0).map((channel) => channel.channel);
  const outboundGap = [...channels]
    .map((channel) => ({ channel: channel.channel, gap: channel.inbound24h - channel.outbound24h }))
    .sort((a, b) => b.gap - a.gap)[0];

  if (metrics.failedEvents24h > 0) {
    anomalies.push({
      title: "Delivery failures detected",
      detail:
        mostUnstableChannel && mostUnstableChannel.failed24h > 0
          ? `${metrics.failedEvents24h} failed events in 24h; ${mostUnstableChannel.channel} carries ${mostUnstableChannel.failed24h} failures (${mostUnstableChannel.failureRate24h}% rate).`
          : `${metrics.failedEvents24h} events failed in the last 24h. Prioritize retry handling on ${metrics.topChannel}.`,
      priority: metrics.failedEvents24h >= 5 ? "high" : "medium",
    });
  }

  if (metrics.connectionCoverage < 0.8) {
    anomalies.push({
      title: "Channel coverage gap",
      detail: `Only ${Math.round(metrics.connectionCoverage * 100)}% of channels are connected, reducing orchestration reach.`,
      priority: "high",
    });
  }

  if (metrics.unreadEmails > 15) {
    anomalies.push({
      title: "Inbox backlog rising",
      detail: `${metrics.unreadEmails} unread emails are pending triage.`,
      priority: metrics.unreadEmails > 40 ? "high" : "medium",
    });
  }

  if (silentConnected.length > 0) {
    anomalies.push({
      title: "Connected but silent channels",
      detail: `${silentConnected.join(", ")} are connected but produced zero events in 24h. Verify incoming stream and account scopes.`,
      priority: "medium",
    });
  }

  if (largestDrop && largestDrop.deltaPct <= -40 && largestDrop.prevEvents24h >= 5) {
    anomalies.push({
      title: "Engagement volume drop",
      detail: `${largestDrop.channel} dropped ${Math.abs(largestDrop.deltaPct)}% vs previous 24h (${largestDrop.prevEvents24h} -> ${largestDrop.events24h}).`,
      priority: "medium",
    });
  }

  suggestions.push({
    title: "Rebalance outbound cadence",
    detail: `Outbound ratio is ${metrics.outboundRate24h}% based on ${metrics.totalEvents24h} events in 24h. Keep this within 45-65% for balanced engagement.`,
    priority: metrics.outboundRate24h > 70 || metrics.outboundRate24h < 35 ? "high" : "medium",
  });

  suggestions.push({
    title: "Prioritize high intent threads",
    detail: `${metrics.highPriorityEmails} high-priority emails are active. Route these to fast-response workflows first.`,
    priority: metrics.highPriorityEmails > 0 ? "high" : "low",
  });

  suggestions.push({
    title: "Lean into strongest channel",
    detail:
      largestSpike && largestSpike.events24h > 0
        ? `${largestSpike.channel} is trending up ${largestSpike.deltaPct}% vs prior window (${largestSpike.events24h} events). Use it as campaign anchor.`
        : `${metrics.topChannel} generated ${metrics.topChannelVolume} events in 24h. Use it as anchor channel for campaign rollouts.`,
    priority: "medium",
  });

  if (outboundGap && outboundGap.gap > 8) {
    suggestions.push({
      title: "Clear inbound response debt",
      detail: `${outboundGap.channel} has ${outboundGap.gap} more inbound than outbound events in 24h. Queue follow-up automation for stalled threads.`,
      priority: "high",
    });
  }

  improvements.push({
    title: "Expand automation coverage",
    detail: `${metrics.activeAutomations7d} automations executed this week. Add fallback automation for failed-message recovery.`,
    priority: metrics.activeAutomations7d < 5 ? "medium" : "low",
  });

  improvements.push({
    title: "Stabilize response momentum",
    detail: `Response momentum is ${metrics.responseMomentum}%. Use adaptive send windows to flatten volatility.`,
    priority: Math.abs(metrics.responseMomentum) > 35 ? "medium" : "low",
  });

  improvements.push({
    title: "Increase real-time signal checks",
    detail: `${metrics.liveEvents15m} events arrived in the last 15m. Add sub-hour alert thresholds when this drops below expected baseline.`,
    priority: metrics.liveEvents15m === 0 ? "high" : "low",
  });

  const headline =
    metrics.failedEvents24h > 0
      ? "Execution health needs attention before scaling throughput"
      : "Execution health is stable with room to optimize orchestration";

  const summary =
    `${metrics.totalEvents24h} events processed in 24h, ${metrics.liveEvents1h} in the last hour, with ${metrics.outboundRate24h}% outbound ratio. ` +
    `Coverage is ${Math.round(metrics.connectionCoverage * 100)}% across channels.`;

  const cappedAnomalies = anomalies.slice(0, 4);
  const cappedSuggestions = suggestions.slice(0, 4);
  const cappedImprovements = improvements.slice(0, 4);

  return {
    headline,
    summary,
    anomalies:
      cappedAnomalies.length > 0
        ? cappedAnomalies
        : [{ title: "No critical anomalies", detail: "No significant health deviations detected in the current window.", priority: "low" }],
    suggestions: cappedSuggestions,
    improvements: cappedImprovements,
  };
}

async function generateAiInsights(params: {
  metrics: InsightMetrics;
  channels: ChannelSummary[];
  fallback: InsightPayload;
}) {
  const { metrics, channels, fallback } = params;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { aiUsed: false, insights: fallback };
  }

  const knownTokens = Array.from(
    new Set([
      ...channels.map((channel) => channel.channel.toLowerCase()),
      "gmail",
      "email",
      "jira",
      "automation",
      "inbound",
      "outbound",
      "events",
      "coverage",
      "failures",
    ]),
  );

  const evidence = {
    metrics,
    channels: channels.slice(0, 8),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are an operations strategist for a unified social command center. Output ONLY valid JSON with concrete, data-grounded statements.",
          },
          {
            role: "user",
            content:
              "Using ONLY this evidence, generate JSON with keys: headline, summary, anomalies[], suggestions[], improvements[]. " +
              "Each item requires: title, detail, priority(high|medium|low). Detail MUST include at least one number from evidence and must not invent channels. Evidence: " +
              JSON.stringify(evidence),
          },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return { aiUsed: false, insights: fallback };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return { aiUsed: false, insights: fallback };
  }

  const parsed = parseJsonObject(content);
  if (!parsed) {
    return { aiUsed: false, insights: fallback };
  }

  const aiInsights: InsightPayload = {
    headline: String(parsed.headline || fallback.headline).slice(0, 140),
    summary: String(parsed.summary || fallback.summary).slice(0, 400),
    anomalies: mergeItems(parsed.anomalies, fallback.anomalies, knownTokens),
    suggestions: mergeItems(parsed.suggestions, fallback.suggestions, knownTokens),
    improvements: mergeItems(parsed.improvements, fallback.improvements, knownTokens),
  };

  return { aiUsed: true, insights: aiInsights };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const agent = await getOrCreateDefaultAgent(user.id);
    const config = getConfig(agent);
    const data = getData(agent);

    const now = Date.now();
    const since24 = new Date(now - DAY);
    const since48 = new Date(now - 2 * DAY);
    const since1h = new Date(now - HOUR);
    const since15m = new Date(now - FIFTEEN_MIN);
    const since7d = new Date(now - 7 * DAY);

    const messages = await prisma.unifiedMessage.findMany({
      where: {
        userId: user.id,
        timestamp: { gte: since48 },
      },
      orderBy: { timestamp: "desc" },
      take: 1000,
    });

    const recentMessages = messages.filter((message) => message.timestamp.getTime() >= since24.getTime());
    const previousMessages = messages.filter(
      (message) => message.timestamp.getTime() < since24.getTime() && message.timestamp.getTime() >= since48.getTime(),
    );
    const liveMessages1h = messages.filter((message) => message.timestamp.getTime() >= since1h.getTime());
    const liveMessages15m = messages.filter((message) => message.timestamp.getTime() >= since15m.getTime());

    const activityLogs = Array.isArray(config.activityLogs) ? (config.activityLogs as ActivityLog[]) : [];
    const recentActivity = activityLogs.filter((log) => {
      const date = toDate(log.timestamp);
      return date ? date.getTime() >= since24.getTime() : false;
    });
    const liveActivity1h = activityLogs.filter((log) => {
      const date = toDate(log.timestamp);
      return date ? date.getTime() >= since1h.getTime() : false;
    });
    const liveActivity15m = activityLogs.filter((log) => {
      const date = toDate(log.timestamp);
      return date ? date.getTime() >= since15m.getTime() : false;
    });

    const automations7d = activityLogs.filter((log) => {
      if (log.type !== "automation") return false;
      const date = toDate(log.timestamp);
      if (!date || date.getTime() < since7d.getTime()) return false;
      return String(log.status || "").toLowerCase() !== "failed";
    });

    const channelVolumes24h = recentMessages.reduce<Record<string, number>>((acc, message) => {
      const channel = String(message.platform || "unknown").toLowerCase();
      acc[channel] = (acc[channel] || 0) + 1;
      return acc;
    }, {});

    const channelVolumesPrev24h = previousMessages.reduce<Record<string, number>>((acc, message) => {
      const channel = String(message.platform || "unknown").toLowerCase();
      acc[channel] = (acc[channel] || 0) + 1;
      return acc;
    }, {});

    const channelEntries = Object.entries(channelVolumes24h).sort((a, b) => b[1] - a[1]);
    const [topChannel, topChannelVolume] = channelEntries[0] || ["none", 0];

    const failedMessageEvents = recentMessages.filter((message) => readStatus(message.metadata) === "failed").length;
    const failedActivityEvents = recentActivity.filter((log) => String(log.status || "").toLowerCase() === "failed").length;

    const directionalMessages = recentMessages.filter(
      (message) => message.direction === "INBOUND" || message.direction === "OUTBOUND",
    );
    const outboundMessages = directionalMessages.filter((message) => message.direction === "OUTBOUND").length;
    const outboundRate24h =
      directionalMessages.length > 0 ? Math.round((outboundMessages / directionalMessages.length) * 100) : 0;

    const previousDirectional = previousMessages.filter(
      (message) => message.direction === "INBOUND" || message.direction === "OUTBOUND",
    );
    const previousOutbound = previousDirectional.filter((message) => message.direction === "OUTBOUND").length;
    const responseMomentum =
      previousOutbound > 0
        ? clamp(Math.round(((outboundMessages - previousOutbound) / previousOutbound) * 100), -100, 300)
        : outboundMessages > 0
          ? 100
          : 0;

    const connections = {
      gmail: Boolean(config.accessToken),
      instagram: Boolean(config.socialConnections?.instagram?.accountId),
      linkedin: Boolean(config.socialConnections?.linkedin?.accountId),
      twitter: Boolean(config.socialConnections?.twitter?.accountId),
      jira: Boolean(config.jira?.accessToken),
    };
    const connectedCount = Object.values(connections).filter(Boolean).length;

    const connectedSocialChannels = [
      connections.instagram ? "instagram" : null,
      connections.linkedin ? "linkedin" : null,
      connections.twitter ? "twitter" : null,
    ].filter((value): value is string => Boolean(value));

    const observedChannels = new Set<string>([
      ...connectedSocialChannels,
      ...Object.keys(channelVolumes24h),
      ...Object.keys(channelVolumesPrev24h),
    ]);

    const channelSummaries: ChannelSummary[] = Array.from(observedChannels)
      .map((channel) => {
        const channelMessages24h = recentMessages.filter((message) => String(message.platform).toLowerCase() === channel);
        const failed24h = channelMessages24h.filter((message) => readStatus(message.metadata) === "failed").length;
        const inbound24h = channelMessages24h.filter((message) => message.direction === "INBOUND").length;
        const outbound24h = channelMessages24h.filter((message) => message.direction === "OUTBOUND").length;
        const events24h = channelVolumes24h[channel] || 0;
        const prevEvents24h = channelVolumesPrev24h[channel] || 0;
        const failureRate24h = events24h > 0 ? Math.round((failed24h / events24h) * 100) : 0;

        return {
          channel,
          connected: connectedSocialChannels.includes(channel),
          events24h,
          prevEvents24h,
          deltaPct: pctChange(events24h, prevEvents24h),
          failed24h,
          failureRate24h,
          inbound24h,
          outbound24h,
        } satisfies ChannelSummary;
      })
      .sort((a, b) => b.events24h - a.events24h);

    const hourlyBuckets = recentMessages.reduce<Record<string, number>>((acc, message) => {
      const hour = message.timestamp.getUTCHours().toString().padStart(2, "0");
      const key = `${hour}:00 UTC`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const busiestHourEntry = Object.entries(hourlyBuckets).sort((a, b) => b[1] - a[1])[0] || ["-", 0];

    const emails = Array.isArray(data.emails) ? (data.emails as StoredEmail[]) : [];
    const unreadEmails = emails.filter((email) => !Boolean(email?.isRead ?? email?.read)).length;
    const highPriorityEmails = emails.filter((email) => {
      const priority = String(email?.priority || "").toLowerCase();
      return priority === "high" || priority === "critical";
    }).length;

    const signalScore = clamp(
      Math.round(
        100 -
          (failedMessageEvents + failedActivityEvents) * 4 -
          unreadEmails * 0.5 +
          connectedCount * 6 +
          Math.min(20, automations7d.length * 2),
      ),
      0,
      100,
    );

    const metrics: InsightMetrics = {
      signalScore,
      totalEvents24h: recentMessages.length + recentActivity.length,
      failedEvents24h: failedMessageEvents + failedActivityEvents,
      outboundRate24h,
      connectionCoverage: connectedCount / 5,
      unreadEmails,
      highPriorityEmails,
      topChannel,
      topChannelVolume,
      activeAutomations7d: automations7d.length,
      responseMomentum,
      channelVolumes24h,
      liveEvents15m: liveMessages15m.length + liveActivity15m.length,
      liveEvents1h: liveMessages1h.length + liveActivity1h.length,
      busiestHourEvents: busiestHourEntry[1],
      busiestHourLabel: busiestHourEntry[0],
    };

    const fallback = buildFallbackInsights(metrics, channelSummaries);
    let aiResult: { aiUsed: boolean; insights: InsightPayload } = { aiUsed: false, insights: fallback };

    try {
      aiResult = await generateAiInsights({ metrics, channels: channelSummaries, fallback });
    } catch {
      aiResult = { aiUsed: false, insights: fallback };
    }

    return ok({
      generatedAt: new Date().toISOString(),
      aiUsed: aiResult.aiUsed,
      metrics,
      insights: aiResult.insights,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return serverError(error, "Failed to generate dashboard insights");
  }
}
