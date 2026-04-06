import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, notFound, ok, serverError, unauthorized } from "@/lib/http";
import { getOrCreateDefaultAgent, getUserAgentById, getConfig, getData, mergeEmails, defaultStats } from "@/lib/agent-store";
import { createActivityLog } from "@/lib/activity";
import { classifyByHeuristics, classifyWithGmailLabels, calculatePriority } from "@/lib/classification";
import { evaluateRules, generateRuleId } from "@/lib/automation";
import { exchangeCodeForTokens, getGmailOAuthUrl, refreshAccessToken } from "@/lib/gmail/oauth";
import { fetchGmailEmails, getGmailMessageDetails, getGmailProfile, getGoogleUserInfo, modifyGmailLabels } from "@/lib/gmail/client";
import {
  createJiraIssue,
  exchangeJiraCodeForTokens,
  exchangeNotionCodeForTokens,
  exchangeSlackCode,
  getJiraAccessibleResources,
  getJiraAuthUrl,
  getJiraProjects,
  getNotionAuthUrl,
  getSlackAuthUrl,
  notionCreatePage,
  notionSearch,
  sendSlackMessage,
} from "@/lib/integrations";
import type { AgentConfig, AgentData, AutomationRule, StoredEmail } from "@/lib/types";

const activeEmailSyncs = new Set<string>();

function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

function stateEncode(payload: Record<string, string>) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function stateDecode(input: string): Record<string, string> {
  const json = Buffer.from(input, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, string>;
}

function readAgentId(request: NextRequest, body?: Record<string, unknown>): string {
  return String(body?.agentId || request.nextUrl.searchParams.get("agentId") || "");
}

async function loadAgentForUser(userId: string, agentId?: string) {
  if (!agentId) return getOrCreateDefaultAgent(userId);
  const agent = await getUserAgentById(userId, agentId);
  return agent;
}

async function persistAgent(agentId: string, config: AgentConfig, data: AgentData) {
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      config: config as any,
      data: data as any,
    },
  });
}

function normalizeEmail(email: any): StoredEmail {
  const isRead = Boolean(email.isRead ?? email.read);
  return {
    id: email.id,
    threadId: email.threadId,
    subject: email.subject || "(No Subject)",
    from: email.from || "Unknown Sender",
    snippet: email.snippet || "",
    body: email.body || "",
    date: email.date || new Date().toISOString(),
    labels: email.labels || [],
    category: email.category || "general",
    priority: email.priority || "medium",
    priorityScore: email.priorityScore,
    read: isRead,
    isRead,
    attachments: email.attachments || [],
  };
}

async function ensureValidToken(config: AgentConfig): Promise<{ accessToken: string; config: AgentConfig }> {
  if (!config.accessToken) {
    throw new Error("Gmail not connected");
  }

  if (!config.tokenExpiresAt || !config.refreshToken) {
    return { accessToken: config.accessToken, config };
  }

  const expiresInMs = new Date(config.tokenExpiresAt).getTime() - Date.now();
  if (expiresInMs > 60_000) {
    return { accessToken: config.accessToken, config };
  }

  const refreshed = await refreshAccessToken(config.refreshToken);
  const nextConfig: AgentConfig = {
    ...config,
    accessToken: refreshed.access_token,
    tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  };

  return { accessToken: refreshed.access_token, config: nextConfig };
}

function buildCategories(emails: StoredEmail[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const email of emails) {
    out[email.category] = (out[email.category] || 0) + 1;
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFocusRulesFromText(preferences: string) {
  const lower = preferences.toLowerCase();
  const keywords = Array.from(
    new Set(
      lower
        .replace(/[^a-z0-9@._\s-]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4 && !token.includes("@"))
    )
  ).slice(0, 30);

  const senders = Array.from(new Set(lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [])).slice(0, 20);

  return {
    highPriorityKeywords: keywords,
    highPrioritySenders: senders,
    lowPriorityKeywords: [] as string[],
    lowPrioritySenders: [] as string[],
  };
}

function inferFocusCategory(email: StoredEmail): "urgent" | "time-sensitive" | "follow-up" | "important" {
  if (email.priority === "critical" || email.category === "requires_action") {
    return "urgent";
  }
  if (email.priority === "high") {
    return "time-sensitive";
  }
  if (email.category === "follow_up") {
    return "follow-up";
  }
  return "important";
}

function getFocusEmailsPayload(emails: StoredEmail[], config: AgentConfig) {
  const focusPrefs = (config as any).focusPreferences;
  const rules = focusPrefs?.rules;
  const raw = String(focusPrefs?.raw || "").trim();

  if (!raw) {
    return {
      total: emails.length,
      focused: 0,
      handled: emails.length,
      categories: {
        urgent: { count: 0, emails: [] as any[] },
        timeSensitive: { count: 0, emails: [] as any[] },
        followUp: { count: 0, emails: [] as any[] },
        important: { count: 0, emails: [] as any[] },
      },
      allEmails: [] as any[],
    };
  }

  const highPriorityKeywords: string[] = Array.isArray(rules?.highPriorityKeywords)
    ? rules.highPriorityKeywords.map((value: string) => String(value).toLowerCase())
    : extractFocusRulesFromText(raw).highPriorityKeywords;
  const highPrioritySenders: string[] = Array.isArray(rules?.highPrioritySenders)
    ? rules.highPrioritySenders.map((value: string) => String(value).toLowerCase())
    : extractFocusRulesFromText(raw).highPrioritySenders;

  const categories = {
    urgent: { count: 0, emails: [] as any[] },
    timeSensitive: { count: 0, emails: [] as any[] },
    followUp: { count: 0, emails: [] as any[] },
    important: { count: 0, emails: [] as any[] },
  };

  const allFocused: any[] = [];

  for (const email of emails) {
    const subject = (email.subject || "").toLowerCase();
    const snippet = (email.snippet || "").toLowerCase();
    const body = (email.body || "").toLowerCase();
    const from = (email.from || "").toLowerCase();
    const content = `${subject} ${snippet} ${body}`;

    const senderMatch = highPrioritySenders.find((sender) => from.includes(sender));
    const keywordMatch = highPriorityKeywords.find((keyword) => {
      const cleaned = keyword.trim();
      if (!cleaned) return false;
      return new RegExp(`\\b${escapeRegExp(cleaned)}\\b`, "i").test(content);
    });

    if (!senderMatch && !keywordMatch) continue;

    const focusCategory = inferFocusCategory(email);
    const focusReason = senderMatch
      ? `Matches preferred sender: ${senderMatch}`
      : `Matches preferred interest: ${keywordMatch}`;

    const focusEmail = {
      id: email.id,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      date: email.date,
      isRead: Boolean((email as any).isRead ?? email.read),
      focusScore: email.priority === "critical" ? 95 : email.priority === "high" ? 85 : 70,
      focusCategory,
      focusReason,
      suggestedDraft: `Hi,\n\nThanks for your email about \"${email.subject}\". I will review this and get back to you shortly.\n\nBest regards,`,
      smartScore: email.priority === "critical" ? 96 : email.priority === "high" ? 88 : 75,
    };

    allFocused.push(focusEmail);
    if (focusCategory === "urgent") {
      categories.urgent.count += 1;
      categories.urgent.emails.push(focusEmail);
    } else if (focusCategory === "time-sensitive") {
      categories.timeSensitive.count += 1;
      categories.timeSensitive.emails.push(focusEmail);
    } else if (focusCategory === "follow-up") {
      categories.followUp.count += 1;
      categories.followUp.emails.push(focusEmail);
    } else {
      categories.important.count += 1;
      categories.important.emails.push(focusEmail);
    }
  }

  allFocused.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    total: emails.length,
    focused: allFocused.length,
    handled: Math.max(0, emails.length - allFocused.length),
    categories,
    allEmails: allFocused,
  };
}

function getAgentLabels(config: AgentConfig, data: AgentData) {
  const labels = Array.isArray((config as any).customLabels) ? (config as any).customLabels : [];
  const emails = Array.isArray(data.emails) ? data.emails : [];

  return labels.map((label: any) => {
    const count = emails.filter((email: any) => Array.isArray(email.customLabels) && email.customLabels.includes(label.id)).length;
    return {
      ...label,
      count,
    };
  });
}

function calculateProductivityScore(total: number, replied: number, pending: number, forgotten: number) {
  if (total === 0) return 0;
  const replyRatio = replied / total;
  const pendingPenalty = pending / total;
  const forgottenPenalty = forgotten / total;
  const score = Math.round((replyRatio * 8 + 2 - pendingPenalty * 2 - forgottenPenalty * 2) * 10) / 10;
  return Math.min(10, Math.max(1, score));
}

function buildDailyDigestPayload(emails: StoredEmail[]) {
  const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
  const recentEmails = emails.filter((email) => new Date(email.date).getTime() >= oneDayAgoMs);

  if (recentEmails.length === 0) {
    return {
      date: new Date().toISOString().split("T")[0],
      totalEmails: 0,
      repliedTo: 0,
      pendingReply: 0,
      important: 0,
      forgotten: 0,
      productivityScore: 0,
      insights: {
        repliedEmails: [] as string[],
        pendingEmails: [] as Array<{ id: string; urgency: string; reason: string }>,
        importantEmails: [] as Array<{ id: string; reason: string }>,
        forgottenEmails: [] as Array<{ id: string; context: string }>,
      },
      recommendations: ["No emails received in the last 24 hours"],
    };
  }

  const repliedEmails = recentEmails.filter((email) => email.subject.toLowerCase().startsWith("re:")).map((email) => email.id);
  const pendingEmails = recentEmails
    .filter((email: any) => !Boolean((email as any).isRead ?? email.read))
    .map((email) => ({
      id: email.id,
      urgency: email.priority === "critical" || email.priority === "high" ? "high" : "medium",
      reason: email.priority === "critical" || email.priority === "high" ? "High-priority unread email" : "Unread email",
    }));

  const importantEmails = recentEmails
    .filter((email: any) =>
      (email.priority === "critical" || email.priority === "high") && !Boolean((email as any).isRead ?? email.read)
    )
    .map((email) => ({ id: email.id, reason: `Priority ${email.priority}` }));

  const forgottenEmails = emails
    .filter((email: any) => {
      const ageMs = Date.now() - new Date(email.date).getTime();
      return ageMs > 3 * 24 * 60 * 60 * 1000 && !Boolean((email as any).isRead ?? email.read);
    })
    .slice(0, 10)
    .map((email) => ({ id: email.id, context: "Unanswered for more than 3 days" }));

  const score = calculateProductivityScore(recentEmails.length, repliedEmails.length, pendingEmails.length, forgottenEmails.length);

  const recommendations: string[] = [];
  if (importantEmails.length > 0) recommendations.push("Reply to high-priority unread emails first.");
  if (forgottenEmails.length > 0) recommendations.push("Review older unanswered conversations.");
  if (pendingEmails.length === 0) recommendations.push("Inbox looks healthy. Keep the momentum.");
  if (recommendations.length === 0) recommendations.push("No urgent actions detected right now.");

  return {
    date: new Date().toISOString().split("T")[0],
    totalEmails: recentEmails.length,
    repliedTo: repliedEmails.length,
    pendingReply: pendingEmails.length,
    important: importantEmails.length,
    forgotten: forgottenEmails.length,
    productivityScore: score,
    insights: {
      repliedEmails,
      pendingEmails,
      importantEmails,
      forgottenEmails,
    },
    recommendations,
  };
}

async function executeRuleAction(email: StoredEmail, action: AutomationRule["action"], config: AgentConfig) {
  switch (action.type) {
    case "create_jira_task": {
      if (!config.jira?.accessToken || !config.jira.cloudId || !config.jiraProjectKey) {
        return { success: false, message: "Jira integration not configured" };
      }

      await createJiraIssue(config.jira.accessToken, config.jira.cloudId, {
        projectKey: action.config.projectKey || config.jiraProjectKey,
        summary: `[Mail Agent] ${email.subject}`,
        description: `From: ${email.from}\n\n${email.snippet}`,
        priority: email.priority === "critical" || email.priority === "high" ? "High" : "Medium",
      });

      return { success: true, message: "Jira issue created" };
    }

    case "save_to_notion": {
      if (!config.notion?.accessToken) {
        return { success: false, message: "Notion integration not configured" };
      }

      const databaseId = action.config.databaseId || config.notion.selectedDatabaseId;
      if (!databaseId) return { success: false, message: "No Notion database selected" };

      await notionCreatePage(
        config.notion.accessToken,
        databaseId,
        `[Mail Agent] ${email.subject}`,
        `From: ${email.from}\nDate: ${email.date}\n\n${email.body || email.snippet}`
      );

      return { success: true, message: "Notion page created" };
    }

    case "send_slack_message": {
      if (!config.slack?.accessToken) {
        return { success: false, message: "Slack integration not configured" };
      }

      const channel = action.config.slackChannelId || config.slack.defaultChannelId;
      if (!channel) return { success: false, message: "No Slack channel configured" };

      const result = await sendSlackMessage(
        config.slack.accessToken,
        channel,
        `Mail Agent alert\nSubject: ${email.subject}\nFrom: ${email.from}\nPriority: ${email.priority}`
      );

      if (!result.ok) return { success: false, message: result.error || "Slack API failed" };
      return { success: true, message: "Slack message sent" };
    }

    default:
      return { success: false, message: "Unsupported action" };
  }
}

function is(method: string, request: NextRequest, route: string) {
  return request.method === method && route;
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = Number((error as { code?: unknown }).code);
    if (Number.isInteger(code)) return code;
  }

  if (error instanceof Error) {
    const match = error.message.match(/\((\d{3})\)/);
    if (match) return Number(match[1]);
  }

  return undefined;
}

function getRetryAfterSeconds(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "retryAfterMs" in error) {
    const retryAfterMs = Number((error as { retryAfterMs?: unknown }).retryAfterMs);
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      return Math.max(1, Math.ceil(retryAfterMs / 1000));
    }
  }

  return undefined;
}

function isRateLimitedError(error: unknown): boolean {
  if (getErrorStatusCode(error) === 429) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("ratelimit") || message.includes("rate limit") || message.includes("resource_exhausted");
  }
  return false;
}

function mapRouteError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return unauthorized();
    }

    if (error.message === "Gmail not connected") {
      return badRequest("Gmail not connected");
    }
  }

  const statusCode = getErrorStatusCode(error);
  if (statusCode === 429) {
    const retryAfter = getRetryAfterSeconds(error);
    return NextResponse.json(
      {
        error: "Gmail is temporarily rate limiting requests. Please wait a few seconds and try syncing again.",
        retryAfter,
      },
      {
        status: 429,
        headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
      }
    );
  }

  return serverError(error);
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  try {
    const { slug = [] } = await context.params;
    const route = slug.join("/");

    if (route === "health") {
      return ok({ ok: true, service: "mail-agent", timestamp: new Date().toISOString() });
    }

    if (route === "oauth-callback") {
      const code = request.nextUrl.searchParams.get("code") || "";
      const state = request.nextUrl.searchParams.get("state") || "";
      const oauthError = request.nextUrl.searchParams.get("error") || "";

      if (oauthError) {
        return NextResponse.redirect(`${getAppUrl()}/dashboard?error=${encodeURIComponent(oauthError)}`);
      }

      if (!code || !state) {
        return NextResponse.redirect(`${getAppUrl()}/dashboard?error=missing_params`);
      }

      let parsed: Record<string, string>;
      try {
        parsed = stateDecode(state);
      } catch {
        return NextResponse.redirect(`${getAppUrl()}/dashboard?error=invalid_state`);
      }

      const userId = parsed.userId;
      const agentId = parsed.agentId;
      if (!userId || !agentId) {
        return NextResponse.redirect(`${getAppUrl()}/dashboard?error=invalid_state`);
      }

      const agent = await getUserAgentById(userId, agentId);
      if (!agent) {
        return NextResponse.redirect(`${getAppUrl()}/dashboard?error=agent_not_found`);
      }

      const redirectUri = `${getAppUrl()}/api/standalone-agents/gmail-classifier/oauth-callback`;
      let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
      try {
        tokens = await exchangeCodeForTokens(code, redirectUri);
      } catch (error) {
        const message = error instanceof Error ? error.message : "oauth_exchange_failed";
        const isCodeReuse = message.includes("invalid_grant");
        const errorCode = isCodeReuse ? "oauth_code_already_used" : "oauth_exchange_failed";
        return NextResponse.redirect(`${getAppUrl()}/dashboard?error=${encodeURIComponent(errorCode)}`);
      }

      const profile = await getGmailProfile(tokens.access_token);

      let userProfile = { name: "", picture: "" };
      try {
        const googleProfile = await getGoogleUserInfo(tokens.access_token);
        userProfile = { name: googleProfile.name, picture: googleProfile.picture };
      } catch {
        // Non-fatal profile fetch issue.
      }

      const config = getConfig(agent);
      const data = getData(agent);
      const logs = config.activityLogs || [];

      const nextConfig: AgentConfig = {
        ...config,
        gmailEmail: profile.emailAddress,
        gmailProfileName: userProfile.name,
        gmailProfilePicture: userProfile.picture,
        emailProvider: "gmail",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || config.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connectedTools: Array.from(new Set([...(config.connectedTools || []), "gmail"])),
        activityLogs: [
          createActivityLog("connection", "Gmail Connected", `Connected ${profile.emailAddress}`, "success"),
          ...logs,
        ].slice(0, 200),
      };

      const nextData: AgentData = {
        ...data,
        gmailConnected: true,
        connectedAt: new Date().toISOString(),
        gmailEmail: profile.emailAddress,
        emails: data.emails || [],
        stats: data.stats || defaultStats(),
      };

      await persistAgent(agent.id, nextConfig, nextData);
      return NextResponse.redirect(`${getAppUrl()}/dashboard?connected=true`);
    }

    if (route === "jira-callback") {
      const code = request.nextUrl.searchParams.get("code") || "";
      const state = request.nextUrl.searchParams.get("state") || "";
      if (!code || !state) return NextResponse.redirect(`${getAppUrl()}/dashboard?error=missing_params`);

      const parsed = stateDecode(state);
      const userId = parsed.userId;
      const agentId = parsed.agentId;
      const agent = await getUserAgentById(userId, agentId);
      if (!agent) return NextResponse.redirect(`${getAppUrl()}/dashboard?error=agent_not_found`);

      const token = await exchangeJiraCodeForTokens(code);
      const resources = await getJiraAccessibleResources(token.access_token);
      const resource = resources[0];

      const config = getConfig(agent);
      const nextConfig: AgentConfig = {
        ...config,
        jira: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
          cloudId: resource?.id,
          siteUrl: resource?.url,
          siteName: resource?.name,
        },
        connectedTools: Array.from(new Set([...(config.connectedTools || []), "jira"])),
      };
      await persistAgent(agent.id, nextConfig, getData(agent));
      return NextResponse.redirect(`${getAppUrl()}/dashboard?jira_connected=true`);
    }

    if (route === "notion-callback") {
      const code = request.nextUrl.searchParams.get("code") || "";
      const state = request.nextUrl.searchParams.get("state") || "";
      if (!code || !state) return NextResponse.redirect(`${getAppUrl()}/dashboard?error=missing_params`);

      const parsed = stateDecode(state);
      const userId = parsed.userId;
      const agentId = parsed.agentId;
      const agent = await getUserAgentById(userId, agentId);
      if (!agent) return NextResponse.redirect(`${getAppUrl()}/dashboard?error=agent_not_found`);

      const token = await exchangeNotionCodeForTokens(code);
      const config = getConfig(agent);
      const nextConfig: AgentConfig = {
        ...config,
        notion: {
          accessToken: token.access_token,
          workspaceId: token.workspace_id,
          workspaceName: token.workspace_name,
          workspaceIcon: token.workspace_icon,
          selectedDatabaseId: null,
        },
        connectedTools: Array.from(new Set([...(config.connectedTools || []), "notion"])),
      };
      await persistAgent(agent.id, nextConfig, getData(agent));
      return NextResponse.redirect(`${getAppUrl()}/dashboard?notion_connected=true`);
    }

    if (route === "slack-callback") {
      const code = request.nextUrl.searchParams.get("code") || "";
      const state = request.nextUrl.searchParams.get("state") || "";
      if (!code || !state) return NextResponse.redirect(`${getAppUrl()}/dashboard?error=missing_params`);

      const parsed = stateDecode(state);
      const userId = parsed.userId;
      const agentId = parsed.agentId;
      const agent = await getUserAgentById(userId, agentId);
      if (!agent) return NextResponse.redirect(`${getAppUrl()}/dashboard?error=agent_not_found`);

      const token = await exchangeSlackCode(code);
      const config = getConfig(agent);
      const nextConfig: AgentConfig = {
        ...config,
        slack: {
          accessToken: token.access_token,
          teamName: token.team?.name,
          teamId: token.team?.id,
        },
        connectedTools: Array.from(new Set([...(config.connectedTools || []), "slack"])),
      };
      await persistAgent(agent.id, nextConfig, getData(agent));
      return NextResponse.redirect(`${getAppUrl()}/dashboard?slack_connected=true`);
    }

    const user = await requireUser(request);

    if (route === "list") {
      const agents = await prisma.agent.findMany({
        where: {
          userId: user.id,
          type: "GMAIL_CLASSIFIER",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          activatedAt: true,
        },
      });
      return ok(agents);
    }

    if (route === "get-emails") {
      const agentId = readAgentId(request);
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");
      const data = getData(agent);
      const config = getConfig(agent);
      const emails = (data.emails || []).map(normalizeEmail);
      return ok({
        emails,
        stats: data.stats || defaultStats(),
        lastSync: data.lastSync || null,
        isConnected: Boolean(config.accessToken),
        gmailEmail: config.gmailEmail || null,
      });
    }

    if (route === "email-details") {
      const agentId = readAgentId(request);
      const emailId = String(request.nextUrl.searchParams.get("emailId") || "");
      if (!agentId || !emailId) return badRequest("agentId and emailId are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      let config = getConfig(agent);
      const data = getData(agent);
      const email = (data.emails || []).find((item: any) => item.id === emailId);
      if (!email) return notFound("Email not found");

      try {
        const tokenResult = await ensureValidToken(config);
        config = tokenResult.config;

        if (tokenResult.config !== getConfig(agent)) {
          await persistAgent(agent.id, tokenResult.config, data);
        }

        const details = await getGmailMessageDetails(tokenResult.accessToken, emailId);

        return ok({
          id: details.id,
          threadId: details.threadId,
          subject: details.subject,
          from: details.from,
          body: details.body,
          bodyText: details.bodyText,
          bodyHtml: details.bodyHtml,
          snippet: details.snippet,
          date: details.date,
          labels: details.labels,
          attachments: details.attachments || [],
        });
      } catch {
        // Fall back to cached content if live Gmail fetch fails.
      }

      return ok({
        id: email.id,
        threadId: email.threadId,
        subject: email.subject,
        from: email.from,
        body: email.body || email.snippet || "",
        bodyText: email.body || email.snippet || "",
        bodyHtml: "",
        snippet: email.snippet || "",
        date: email.date,
        labels: email.labels || [],
        attachments: email.attachments || [],
      });
    }

    if (route === "config") {
      const agentId = readAgentId(request);
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");
      return ok({ config: getConfig(agent) });
    }

    if (route === "labels") {
      const agentId = readAgentId(request);
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const data = getData(agent);
      return ok({ labels: getAgentLabels(config, data) });
    }

    if (route === "focus-preferences") {
      const agentId = readAgentId(request);
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent) as any;
      return ok({
        preferences: config.focusPreferences?.raw || "",
        updatedAt: config.focusPreferences?.updatedAt || null,
      });
    }

    if (route === "focus-emails") {
      const agentId = readAgentId(request);
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const data = getData(agent);
      return ok(getFocusEmailsPayload((data.emails || []).map(normalizeEmail), config));
    }

    if (route === "brain-settings") {
      const agentId = readAgentId(request);
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent) as any;
      const brain = config.brain || {};
      if (!brain.focus?.raw && config.focusPreferences?.raw) {
        brain.focus = {
          raw: config.focusPreferences.raw,
          updatedAt: config.focusPreferences.updatedAt,
        };
      }
      return ok(brain);
    }

    if (route === "daily-digest") {
      const agentId = readAgentId(request);
      const forceRefresh = request.nextUrl.searchParams.get("forceRefresh") === "true";
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const data = getData(agent) as any;
      const emails = (data.emails || []).map(normalizeEmail);
      const fingerprint = emails.length > 0 ? `${emails[0].id}_${emails.length}` : "empty";
      const cache = data.lastDigest;
      const cacheAgeMs = cache ? Date.now() - new Date(cache.cachedAt).getTime() : Number.POSITIVE_INFINITY;
      const isCacheValid = Boolean(cache && cache.fingerprint === fingerprint && cacheAgeMs < 4 * 60 * 60 * 1000);

      if (!forceRefresh && isCacheValid) {
        return ok({
          ...cache.data,
          isCached: true,
          cachedAt: cache.cachedAt,
        });
      }

      const digest = buildDailyDigestPayload(emails);
      const nextData = {
        ...data,
        lastDigest: {
          fingerprint,
          cachedAt: new Date().toISOString(),
          data: digest,
        },
      };

      await persistAgent(agent.id, config, nextData);
      return ok({
        ...digest,
        isCached: false,
        cachedAt: nextData.lastDigest.cachedAt,
      });
    }

    if (route === "preferences") {
      const agentId = readAgentId(request);
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");
      const config = getConfig(agent);
      return ok({
        syncPreferences: config.syncPreferences || {},
        corrections: config.corrections || [],
      });
    }

    if (route === "activity") {
      const agentId = readAgentId(request);
      const type = request.nextUrl.searchParams.get("type") || undefined;
      const limit = Number(request.nextUrl.searchParams.get("limit") || "50");
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const logs = [...(getConfig(agent).activityLogs || [])]
        .filter((log) => (type ? log.type === type : true))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      return ok({ logs, total: logs.length });
    }

    if (route === "automation-rules") {
      const agentId = readAgentId(request);
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");
      const config = getConfig(agent);
      return ok({ rules: config.automationRules || [] });
    }

    if (route === "fetch-spam") {
      const agentId = readAgentId(request);
      const count = Number(request.nextUrl.searchParams.get("count") || "30");
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const tokenResult = await ensureValidToken(config);
      const result = await fetchGmailEmails(tokenResult.accessToken, {
        maxResults: count,
        labelIds: ["SPAM"],
      });

      if (tokenResult.config !== config) {
        await persistAgent(agent.id, tokenResult.config, getData(agent));
      }

      return ok({ spamEmails: result.emails });
    }

    return notFound(`Unsupported GET route: ${route}`);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  try {
    const { slug = [] } = await context.params;
    const route = slug.join("/");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const user = await requireUser(request);

    if (route === "init") {
      const agentId = readAgentId(request, body);
      let agent = await loadAgentForUser(user.id, agentId || undefined);
      if (!agent) agent = await getOrCreateDefaultAgent(user.id);

      if (body.name && typeof body.name === "string" && body.name !== agent.name) {
        agent = await prisma.agent.update({
          where: { id: agent.id },
          data: { name: body.name },
        });
      }

      return ok({ agent });
    }

    if (route === "connect-gmail") {
      const agentId = readAgentId(request, body);
      if (!agentId) return badRequest("Agent ID required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const redirectUri = `${getAppUrl()}/api/standalone-agents/gmail-classifier/oauth-callback`;
      const state = stateEncode({ userId: user.id, agentId: agent.id, provider: "gmail" });
      return ok({ authUrl: getGmailOAuthUrl(redirectUri, state) });
    }

    if (route === "connect-jira") {
      const agentId = readAgentId(request, body);
      if (!agentId) return badRequest("Agent ID required");
      return ok({ authUrl: getJiraAuthUrl(stateEncode({ userId: user.id, agentId })) });
    }

    if (route === "connect-notion") {
      const agentId = readAgentId(request, body);
      if (!agentId) return badRequest("Agent ID required");
      return ok({ authUrl: getNotionAuthUrl(stateEncode({ userId: user.id, agentId })) });
    }

    if (route === "connect-slack") {
      const agentId = readAgentId(request, body);
      if (!agentId) return badRequest("Agent ID required");
      return ok({ authUrl: getSlackAuthUrl(stateEncode({ userId: user.id, agentId })) });
    }

    if (route === "chat") {
      const context = (body.context || {}) as Record<string, unknown>;
      const agentId = String(body.agentId || context.agentId || "");
      const message = String(body.message || "").trim();

      if (!agentId) return badRequest("Agent ID required");
      if (!message) return badRequest("Message is required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const data = getData(agent);
      const emails = (data.emails || []).map(normalizeEmail);
      const query = message.toLowerCase();

      let matched = emails;
      if (query.includes("unread")) {
        matched = matched.filter((email: any) => !Boolean((email as any).isRead ?? email.read));
      }

      if (query.includes("attention") || query.includes("urgent") || query.includes("priority")) {
        matched = matched.filter((email: any) => {
          const unread = !Boolean((email as any).isRead ?? email.read);
          return unread && ["high", "critical"].includes(String(email.priority));
        });
      }

      const emailsForUi = matched
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8)
        .map((email) => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
          snippet: email.snippet,
          priority: email.priority,
          category: email.category,
          isRead: Boolean((email as any).isRead ?? email.read),
        }));

      const reply =
        emailsForUi.length > 0
          ? `I found ${emailsForUi.length} email${emailsForUi.length === 1 ? "" : "s"} matching your request.`
          : "I could not find matching emails right now. Try syncing first or using another filter like unread.";

      return ok({
        reply,
        emails: emailsForUi,
        suggestions: ["Show unread emails", "What needs my attention?", "Summarize my inbox"],
      });
    }

    if (route === "fetch-emails") {
      const agentId = String(body.agentId || "");
      if (!agentId) return badRequest("Agent ID required");

      const count = Number(body.count || 25);
      const query = typeof body.query === "string" ? body.query : undefined;

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      if (activeEmailSyncs.has(agent.id)) {
        return NextResponse.json(
          {
            error: "A sync is already in progress for this account. Please wait a few seconds and try again.",
          },
          { status: 429 }
        );
      }

      activeEmailSyncs.add(agent.id);

      try {
        let config = getConfig(agent);
        const data = getData(agent);
        const tokenResult = await ensureValidToken(config);
        config = tokenResult.config;

        let gmailResult: Awaited<ReturnType<typeof fetchGmailEmails>>;
        try {
          gmailResult = await fetchGmailEmails(tokenResult.accessToken, {
            maxResults: count,
            labelIds: ["INBOX"],
            query,
          });
        } catch (error) {
          if (isRateLimitedError(error)) {
            const retryAfter = getRetryAfterSeconds(error) ?? 5;
            return NextResponse.json(
              {
                error: "Gmail is temporarily rate limiting requests. Please wait a few seconds and try syncing again.",
                retryAfter,
              },
              {
                status: 429,
                headers: { "Retry-After": String(retryAfter) },
              }
            );
          }
          throw error;
        }

        const incoming = gmailResult.emails.map((email) => {
          const category = classifyWithGmailLabels(email.labels) || classifyByHeuristics(email);
          const priority = calculatePriority(email);

          return normalizeEmail({
            ...email,
            category,
            priority: priority.priority,
            priorityScore: priority.score,
          });
        });

        const mergedEmails = mergeEmails(data.emails || [], incoming);
        const categories = buildCategories(mergedEmails);
        const logs = config.activityLogs || [];

        logs.unshift(
          createActivityLog(
            "sync",
            "Email Sync",
            `Synced ${incoming.length} emails from Gmail`,
            "success",
            { synced: incoming.length }
          )
        );

        const nextData: AgentData = {
          ...data,
          emails: mergedEmails,
          lastSync: new Date().toISOString(),
          stats: {
            total: mergedEmails.length,
            classified: mergedEmails.length,
            gmailLabelsSuppressed: data.stats?.gmailLabelsSuppressed || 0,
            senderRulesSuppressed: data.stats?.senderRulesSuppressed || 0,
            llmCalled: data.stats?.llmCalled || 0,
            categories,
            newInLastSync: incoming.length,
          },
        };

        const nextConfig: AgentConfig = {
          ...config,
          activityLogs: logs.slice(0, 200),
        };

        await persistAgent(agent.id, nextConfig, nextData);
        return ok({
          emails: mergedEmails,
          stats: nextData.stats,
          message: `Synced ${incoming.length} emails`,
          newCount: incoming.length,
        });
      } finally {
        activeEmailSyncs.delete(agent.id);
      }
    }

    if (route === "generate-reply-draft") {
      const agentId = String(body.agentId || "");
      const emailId = String(body.emailId || "");
      const intent = String(body.intent || "friendly");
      if (!agentId || !emailId) return badRequest("agentId and emailId are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const data = getData(agent);
      const email = (data.emails || []).find((item: any) => item.id === emailId);
      if (!email) return notFound("Email not found");

      const draft = `Hi,\n\nThanks for your email about \"${email.subject}\".\n\n(${intent} draft generated by Mail Agent)\n\nBest regards,`;
      return ok({ success: true, draft });
    }

    if (route === "send-email") {
      const agentId = String(body.agentId || "");
      const to = String(body.to || "");
      const subject = String(body.subject || "");
      const bodyText = String(body.body || "");

      if (!agentId || !to || !subject || !bodyText) {
        return badRequest("agentId, to, subject, body are required");
      }

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      let config = getConfig(agent);
      const tokenResult = await ensureValidToken(config);
      config = tokenResult.config;

      const raw = Buffer.from(
        `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\n\r\n${bodyText}`
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });

      if (!response.ok) {
        return serverError(await response.text(), "Failed to send email");
      }

      const logs = config.activityLogs || [];
      logs.unshift(createActivityLog("automation", "Sent Email", `Sent email to ${to}`, "success"));
      await persistAgent(agent.id, { ...config, activityLogs: logs.slice(0, 200) }, getData(agent));

      return ok({ success: true });
    }

    if (route === "preferences") {
      const agentId = String(body.agentId || "");
      if (!agentId) return badRequest("Agent ID required");

      const syncPreferences = (body.syncPreferences || {}) as Record<string, unknown>;
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const nextConfig: AgentConfig = { ...config, syncPreferences };
      await persistAgent(agent.id, nextConfig, getData(agent));
      return ok({ syncPreferences });
    }

    if (route === "activity") {
      const agentId = String(body.agentId || "");
      const type = String(body.type || "");
      const action = String(body.action || "");
      const details = String(body.details || "");
      const status = String(body.status || "success") as "success" | "failed" | "pending";
      const metadata = (body.metadata || {}) as Record<string, unknown>;

      if (!agentId || !type || !action) return badRequest("agentId, type, action are required");
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const logs = config.activityLogs || [];
      logs.unshift(createActivityLog(type as any, action, details, status, metadata));

      await persistAgent(agent.id, { ...config, activityLogs: logs.slice(0, 200) }, getData(agent));
      return ok({ success: true });
    }

    if (route === "automation-rules") {
      const agentId = String(body.agentId || "");
      if (!agentId) return badRequest("Agent ID required");

      const rule = (body.rule || {}) as Partial<AutomationRule>;
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const rules = config.automationRules || [];
      const nextRule: AutomationRule = {
        id: generateRuleId(),
        name: rule.name || "New Rule",
        enabled: rule.enabled ?? true,
        conditionOperator: rule.conditionOperator || "AND",
        conditions: rule.conditions || [],
        action: rule.action || { type: "create_jira_task", config: {} },
        createdAt: new Date().toISOString(),
      };

      await persistAgent(agent.id, { ...config, automationRules: [...rules, nextRule] }, getData(agent));
      return ok({ success: true, rule: nextRule });
    }

    if (route === "automation-rules/apply") {
      const agentId = String(body.agentId || "");
      const dryRun = Boolean(body.dryRun);
      if (!agentId) return badRequest("Agent ID required");

      const filter = (body.filter || {}) as Record<string, unknown>;
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const data = getData(agent);

      let emails = (data.emails || []).map(normalizeEmail);
      if (filter.category) emails = emails.filter((e) => e.category === filter.category);
      if (filter.priority) emails = emails.filter((e) => e.priority === filter.priority);

      const rules = (config.automationRules || []).filter((rule) => rule.enabled);
      const results: Array<Record<string, unknown>> = [];
      const logs = config.activityLogs || [];

      for (const email of emails) {
        const matched = evaluateRules(email, rules);
        for (const rule of matched) {
          if (dryRun) {
            results.push({ emailId: email.id, subject: email.subject, ruleName: rule.name, status: "dry-run" });
            continue;
          }

          const actionResult = await executeRuleAction(email, rule.action, config);
          results.push({
            emailId: email.id,
            subject: email.subject,
            ruleName: rule.name,
            action: rule.action.type,
            status: actionResult.success ? "executed" : "failed",
            result: actionResult.message,
          });

          logs.unshift(
            createActivityLog(
              actionResult.success ? "automation" : "automation",
              `Rule ${rule.name}`,
              `${rule.action.type} on ${email.subject}`,
              actionResult.success ? "success" : "failed"
            )
          );
        }
      }

      await persistAgent(agent.id, { ...config, activityLogs: logs.slice(0, 200) }, data);
      return ok({
        success: true,
        dryRun,
        emailsChecked: emails.length,
        rulesChecked: rules.length,
        matched: results.length,
        executed: results.filter((r) => r.status === "executed").length,
        failed: results.filter((r) => r.status === "failed").length,
        results,
      });
    }

    if (route === "rescue-email") {
      const agentId = String(body.agentId || "");
      const emailId = String(body.emailId || "");
      if (!agentId || !emailId) return badRequest("agentId and emailId are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      let config = getConfig(agent);
      const tokenResult = await ensureValidToken(config);
      config = tokenResult.config;

      await modifyGmailLabels(tokenResult.accessToken, emailId, {
        removeLabelIds: ["SPAM"],
        addLabelIds: ["INBOX"],
      });

      const logs = config.activityLogs || [];
      logs.unshift(createActivityLog("spam_rescue", "Rescued Email", `Email ${emailId} moved to inbox`, "success"));

      await persistAgent(agent.id, { ...config, activityLogs: logs.slice(0, 200) }, getData(agent));
      return ok({ success: true, message: "Email moved from spam to inbox" });
    }

    if (route === "jira-projects") {
      const agentId = String(body.agentId || "");
      if (!agentId) return badRequest("Agent ID required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      if (!config.jira?.accessToken || !config.jira.cloudId) {
        return badRequest("Jira not connected");
      }

      const projects = await getJiraProjects(config.jira.accessToken, config.jira.cloudId);
      return ok({ projects });
    }

    if (route === "create-jira-task") {
      const agentId = String(body.agentId || "");
      const email = body.email as StoredEmail | undefined;
      const projectKey = String(body.projectKey || "");

      if (!agentId || !email || !projectKey) {
        return badRequest("agentId, email, projectKey are required");
      }

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      if (!config.jira?.accessToken || !config.jira.cloudId) {
        return badRequest("Jira not connected");
      }

      const issue = await createJiraIssue(config.jira.accessToken, config.jira.cloudId, {
        projectKey,
        summary: `[Mail Agent] ${email.subject}`,
        description: `From: ${email.from}\n\n${email.snippet}`,
      });

      return ok({ success: true, issue, issueKey: issue?.key || issue?.id || null });
    }

    if (route === "send-slack-message") {
      const agentId = String(body.agentId || "");
      const email = body.email as StoredEmail | undefined;
      const channelId = String(body.channelId || "");

      if (!agentId || !email || !channelId) {
        return badRequest("agentId, email, channelId are required");
      }

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      if (!config.slack?.accessToken) {
        return badRequest("Slack not connected");
      }

      const text = `Mail Agent alert\nSubject: ${email.subject}\nFrom: ${email.from}\nPriority: ${email.priority}`;
      const result = await sendSlackMessage(config.slack.accessToken, channelId, text);
      if (!result.ok) {
        return serverError(result.error || "Slack API failed", "Failed to send Slack message");
      }

      return ok({ success: true });
    }

    if (route === "labels") {
      const agentId = String(body.agentId || "");
      const name = String(body.name || "").trim();
      const color = String(body.color || "#3B82F6");
      const userContext = String(body.userContext || "").trim();
      const customRules = Array.isArray(body.customRules) ? body.customRules : [];
      const autoApply = body.autoApply !== false;
      const confidenceThreshold = Number(body.confidenceThreshold ?? 0.5);
      const useLLMFallback = Boolean(body.useLLMFallback);
      const emailIds = Array.isArray(body.emailIds) ? body.emailIds.map((id) => String(id)) : [];

      if (!agentId || !name) return badRequest("agentId and name are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent) as any;
      const data = getData(agent) as any;
      const labels = Array.isArray(config.customLabels) ? [...config.customLabels] : [];

      if (labels.some((label: any) => String(label.name || "").toLowerCase() === name.toLowerCase())) {
        return badRequest("Label with this name already exists");
      }

      const label = {
        id: `label_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name,
        color,
        userContext,
        customRules,
        autoApply,
        confidenceThreshold,
        useLLMFallback,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        applications: emailIds.map((id) => ({
          emailId: id,
          appliedBy: "user",
          timestamp: new Date().toISOString(),
        })),
      };

      const emails = Array.isArray(data.emails) ? data.emails : [];
      const nextEmails = emails.map((email: any) => {
        if (!emailIds.includes(email.id)) return email;
        const custom = Array.isArray(email.customLabels) ? email.customLabels : [];
        return custom.includes(label.id) ? email : { ...email, customLabels: [...custom, label.id] };
      });

      const nextConfig = { ...config, customLabels: [...labels, label] };
      const nextData = { ...data, emails: nextEmails };
      await persistAgent(agent.id, nextConfig, nextData);
      return ok({ success: true, label });
    }

    if (route === "labels/test") {
      const agentId = String(body.agentId || "");
      const description = String(body.description || "");
      if (!agentId || !description.trim()) return badRequest("agentId and description are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const data = getData(agent);
      const emails = (data.emails || []).map(normalizeEmail);
      const words = description
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4);

      const matches = emails
        .map((email) => {
          const haystack = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();
          const hits = words.filter((word) => haystack.includes(word));
          const confidence = words.length > 0 ? Math.round((hits.length / words.length) * 100) : 0;
          return {
            id: email.id,
            subject: email.subject,
            from: email.from,
            snippet: email.snippet || email.body?.slice(0, 120) || "",
            confidence,
            reasons: hits.map((word) => `\"${word}\"`).join(", "),
          };
        })
        .filter((item) => item.confidence >= 50)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);

      return ok({ matches, total: matches.length });
    }

    if (route === "labels/suggest") {
      const agentId = String(body.agentId || "");
      if (!agentId) return badRequest("agentId is required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const data = getData(agent);
      const emails = (data.emails || []).map(normalizeEmail);
      if (emails.length < 5) return ok({ suggestions: [] });

      const byDomain = new Map<string, StoredEmail[]>();
      for (const email of emails) {
        const domain = (email.from.split("@")[1] || "").toLowerCase().replace(/[>]/g, "");
        if (!domain) continue;
        byDomain.set(domain, [...(byDomain.get(domain) || []), email]);
      }

      const suggestions = Array.from(byDomain.entries())
        .filter(([, list]) => list.length >= 2)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 4)
        .map(([domain, list]) => ({
          name: domain.split(".")[0].slice(0, 1).toUpperCase() + domain.split(".")[0].slice(1),
          description: `Emails from @${domain}`,
          estimatedCount: list.length,
          sampleEmails: list.slice(0, 2).map((email) => ({
            id: email.id,
            subject: email.subject,
            from: email.from,
          })),
        }));

      return ok({ suggestions });
    }

    if (route === "labels/apply") {
      const agentId = String(body.agentId || "");
      const labelId = String(body.labelId || "");
      const emailIds = Array.isArray(body.emailIds) ? body.emailIds.map((id) => String(id)) : [];
      if (!agentId || !labelId || emailIds.length === 0) {
        return badRequest("agentId, labelId, emailIds are required");
      }

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent) as any;
      const data = getData(agent) as any;
      const labels = Array.isArray(config.customLabels) ? config.customLabels : [];
      const label = labels.find((item: any) => item.id === labelId);
      if (!label) return notFound("Label not found");

      const emails = Array.isArray(data.emails) ? data.emails : [];
      const nextEmails = emails.map((email: any) => {
        if (!emailIds.includes(email.id)) return email;
        const custom = Array.isArray(email.customLabels) ? email.customLabels : [];
        return custom.includes(labelId) ? email : { ...email, customLabels: [...custom, labelId] };
      });

      await persistAgent(agent.id, config, { ...data, emails: nextEmails });
      return ok({ success: true });
    }

    if (route === "notion/search") {
      const agentId = String(body.agentId || "");
      if (!agentId) return badRequest("Agent ID required");

      const query = String(body.query || "");
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      if (!config.notion?.accessToken) return badRequest("Notion not connected");

      const result = await notionSearch(config.notion.accessToken, query);
      const databases = (result.results || []).map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || db.properties?.title?.title?.[0]?.plain_text || "Untitled",
        icon: db.icon?.emoji || null,
        url: db.url,
      }));

      const nextConfig: AgentConfig = {
        ...config,
        notion: {
          ...config.notion,
          accessToken: config.notion.accessToken,
          databases,
        },
      };

      await persistAgent(agent.id, nextConfig, getData(agent));
      return ok({ databases });
    }

    if (route === "notion/create-page") {
      const agentId = String(body.agentId || "");
      const title = String(body.title || "");
      const content = String(body.content || "");
      const databaseId = String(body.databaseId || "");
      if (!agentId || !title || !databaseId) return badRequest("agentId, title, databaseId are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");
      const config = getConfig(agent);
      if (!config.notion?.accessToken) return badRequest("Notion not connected");

      const page = await notionCreatePage(config.notion.accessToken, databaseId, title, content);

      const nextConfig: AgentConfig = {
        ...config,
        notion: {
          ...config.notion,
          accessToken: config.notion.accessToken,
          selectedDatabaseId: databaseId,
        },
      };

      await persistAgent(agent.id, nextConfig, getData(agent));
      return ok({ success: true, page });
    }

    return notFound(`Unsupported POST route: ${route}`);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  try {
    const { slug = [] } = await context.params;
    const route = slug.join("/");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const user = await requireUser(request);

    if (route === "config") {
      const agentId = String(body.agentId || "");
      if (!agentId) return badRequest("Agent ID required");

      const configPatch = (body.configPatch || {}) as Record<string, unknown>;
      const autoCreateJiraTasks = body.autoCreateJiraTasks as boolean | undefined;
      const jiraProjectKey = typeof body.jiraProjectKey === "string" ? body.jiraProjectKey : undefined;

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const nextConfig: AgentConfig = {
        ...config,
        ...configPatch,
        ...(autoCreateJiraTasks !== undefined ? { autoCreateJiraTasks } : {}),
        ...(jiraProjectKey !== undefined ? { jiraProjectKey } : {}),
      };

      await persistAgent(agent.id, nextConfig, getData(agent));
      return ok({ success: true, config: nextConfig });
    }

    if (route === "automation-rules") {
      const agentId = String(body.agentId || "");
      const ruleId = String(body.ruleId || "");
      const updates = (body.updates || {}) as Partial<AutomationRule>;
      if (!agentId || !ruleId) return badRequest("agentId and ruleId required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const rules = config.automationRules || [];
      const index = rules.findIndex((rule) => rule.id === ruleId);
      if (index === -1) return notFound("Rule not found");

      rules[index] = {
        ...rules[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await persistAgent(agent.id, { ...config, automationRules: rules }, getData(agent));
      return ok({ success: true, rule: rules[index] });
    }

    if (route === "data") {
      const agentId = String(body.agentId || "");
      if (!agentId) return badRequest("Agent ID required");

      const dataPatch = (body.dataPatch || {}) as Record<string, unknown>;
      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const currentData = getData(agent);
      const nextData = {
        ...currentData,
        ...dataPatch,
      } as AgentData;

      await persistAgent(agent.id, config, nextData);
      return ok({ success: true, agent: { ...agent, data: nextData } });
    }

    if (route === "labels") {
      const agentId = String(body.agentId || "");
      const labelId = String(body.labelId || "");
      const updates = (body.updates || {}) as Record<string, unknown>;
      if (!agentId || !labelId) return badRequest("agentId and labelId are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent) as any;
      const labels = Array.isArray(config.customLabels) ? [...config.customLabels] : [];
      const index = labels.findIndex((label: any) => label.id === labelId);
      if (index === -1) return notFound("Label not found");

      labels[index] = {
        ...labels[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await persistAgent(agent.id, { ...config, customLabels: labels }, getData(agent));
      return ok({ success: true, label: labels[index] });
    }

    if (route === "focus-preferences") {
      const agentId = String(body.agentId || "");
      const preferences = String(body.preferences || "");
      if (!agentId) return badRequest("agentId is required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent) as any;
      const data = getData(agent) as any;
      const rules = extractFocusRulesFromText(preferences);
      const nextConfig = {
        ...config,
        focusPreferences: {
          raw: preferences,
          rules,
          updatedAt: new Date().toISOString(),
        },
      };

      const nextData = {
        ...data,
        focusCache: null,
      };

      await persistAgent(agent.id, nextConfig, nextData);
      return ok({ success: true, rules });
    }

    if (route === "brain-settings") {
      const agentId = String(body.agentId || "");
      const type = String(body.type || "");
      const content = String(body.content || "");
      if (!agentId || !type) return badRequest("agentId and type are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent) as any;
      const brain = config.brain || {};

      if (type === "automation_magic") {
        const lowered = content.toLowerCase();
        const suggestedRules: AutomationRule[] = [];
        if (lowered.includes("jira")) {
          suggestedRules.push({
            id: generateRuleId(),
            name: "Auto Jira From Action Emails",
            enabled: true,
            conditionOperator: "AND",
            conditions: [{ field: "category", operator: "equals", value: "requires_action" }],
            action: { type: "create_jira_task", config: {} },
            createdAt: new Date().toISOString(),
          });
        }
        if (lowered.includes("slack")) {
          suggestedRules.push({
            id: generateRuleId(),
            name: "Notify Slack On Urgent",
            enabled: true,
            conditionOperator: "AND",
            conditions: [{ field: "priority", operator: "equals", value: "high" }],
            action: { type: "send_slack_message", config: {} },
            createdAt: new Date().toISOString(),
          });
        }
        if (suggestedRules.length === 0) {
          suggestedRules.push({
            id: generateRuleId(),
            name: "Save Important To Notion",
            enabled: true,
            conditionOperator: "AND",
            conditions: [{ field: "priority", operator: "equals", value: "high" }],
            action: { type: "save_to_notion", config: {} },
            createdAt: new Date().toISOString(),
          });
        }
        return ok({ success: true, suggestedRules });
      }

      const updatedBrain = {
        ...brain,
        [type]: {
          ...(brain[type] || {}),
          raw: content,
          updatedAt: new Date().toISOString(),
        },
      };

      const nextConfig = {
        ...config,
        brain: updatedBrain,
      };

      if (type === "focus") {
        nextConfig.focusPreferences = {
          raw: content,
          rules: extractFocusRulesFromText(content),
          updatedAt: new Date().toISOString(),
        };
      }

      await persistAgent(agent.id, nextConfig, getData(agent));
      return ok({ success: true, brain: updatedBrain });
    }

    return notFound(`Unsupported PATCH route: ${route}`);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  try {
    const { slug = [] } = await context.params;
    const route = slug.join("/");

    const user = await requireUser(request);

    if (route === "automation-rules") {
      const agentId = String(request.nextUrl.searchParams.get("agentId") || "");
      const ruleId = String(request.nextUrl.searchParams.get("ruleId") || "");
      if (!agentId || !ruleId) return badRequest("agentId and ruleId are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent);
      const rules = (config.automationRules || []).filter((rule) => rule.id !== ruleId);
      await persistAgent(agent.id, { ...config, automationRules: rules }, getData(agent));
      return ok({ success: true });
    }

    if (route === "labels") {
      const agentId = String(request.nextUrl.searchParams.get("agentId") || "");
      const labelId = String(request.nextUrl.searchParams.get("labelId") || "");
      if (!agentId || !labelId) return badRequest("agentId and labelId are required");

      const agent = await loadAgentForUser(user.id, agentId);
      if (!agent) return notFound("Agent not found");

      const config = getConfig(agent) as any;
      const labels = Array.isArray(config.customLabels) ? config.customLabels : [];
      const nextLabels = labels.filter((label: any) => label.id !== labelId);
      if (nextLabels.length === labels.length) return notFound("Label not found");

      const data = getData(agent) as any;
      const emails = Array.isArray(data.emails) ? data.emails : [];
      const nextEmails = emails.map((email: any) => ({
        ...email,
        customLabels: Array.isArray(email.customLabels)
          ? email.customLabels.filter((id: string) => id !== labelId)
          : [],
      }));

      await persistAgent(agent.id, { ...config, customLabels: nextLabels }, { ...data, emails: nextEmails });
      return ok({ success: true });
    }

    return notFound(`Unsupported DELETE route: ${route}`);
  } catch (error) {
    return mapRouteError(error);
  }
}
