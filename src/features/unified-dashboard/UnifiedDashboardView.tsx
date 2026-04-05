"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  ArrowUpRight,
  Bell,
  ClipboardList,
  ExternalLink,
  FileText,
  FolderKanban,
  Hash,
  HelpCircle,
  Image as ImageIcon,
  Instagram,
  LayoutDashboard,
  Lightbulb,
  Linkedin,
  Loader2,
  Mail,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  TrendingUp,
  Twitter,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import EmailClassifierEditor from "@/features/standalone-agents/agents/gmail-classifier/editor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import ZyncoChatbot from "./ZyncoChatbot";

type SocialChannel = "instagram" | "linkedin" | "twitter";

const SOCIAL_CHANNELS: SocialChannel[] = ["instagram", "linkedin", "twitter"];

function isSocialChannel(value: string): value is SocialChannel {
  return SOCIAL_CHANNELS.includes(value as SocialChannel);
}

function channelLabel(channel: SocialChannel) {
  if (channel === "twitter") return "Twitter/X";
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

type SectionId =
  | "workspace"
  | "email"
  | "instagram"
  | "linkedin"
  | "twitter"
  | "network"
  | "updates"
  | "chat"
  | "docs"
  | "projects"
  | "insights";

interface ChannelState {
  accountId: string;
  postText: string;
  messageRecipient: string;
  recipientDraft: string;
  savedRecipients: string[];
  messageText: string;
  mediaUrl: string;
  mediaFiles: File[];
  postMode: "post" | "reel";
}

interface InstagramAssistantState {
  prompt: string;
  voiceNote: File | null;
  transcript: string;
  strategy: string;
  loading: boolean;
  isRecording: boolean;
}

interface ChannelData {
  posts: unknown[];
  inbox: unknown[];
  comments: unknown[];
  loading: boolean;
  error: string | null;
}

interface SocialConnectionsResponse {
  connections: Record<SocialChannel, string>;
  recipients: Record<SocialChannel, string[]>;
  onboardingCompleted: boolean;
}

interface DashboardOverviewUpdate {
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
}

interface DashboardOverviewPayload {
  connections: {
    gmail: boolean;
    instagram: boolean;
    linkedin: boolean;
    twitter: boolean;
    jira: boolean;
  };
  connectionMeta?: Record<SocialChannel, { connectedAt: string | null; status: string }>;
  socialAccounts: Record<SocialChannel, string>;
  recipients: Record<SocialChannel, string[]>;
  metrics?: {
    connectedChannels: number;
    totalChannels: number;
    connections: {
      gmail: boolean;
      instagram: boolean;
      linkedin: boolean;
      twitter: boolean;
      jira: boolean;
    };
    activity: {
      totalUpdates: number;
      failedUpdates: number;
      pendingUpdates: number;
      outboundRate: number;
      outboundCount: number;
      inboundCount: number;
    };
    email: {
      totalEmails: number;
      unreadEmails: number;
      highPriorityEmails: number;
    };
    social: {
      instagramRecipients: number;
      linkedinRecipients: number;
      twitterRecipients: number;
    };
    updatedAt: string;
  };
  gmail: {
    email: string | null;
    totalEmails: number;
    unreadEmails: number;
    highPriorityEmails: number;
    lastSync: string | null;
  };
  jira: {
    connected: boolean;
    siteName: string | null;
    siteUrl: string | null;
    projectKey: string | null;
  };
  updates: DashboardOverviewUpdate[];
  activity: Array<{
    id: string;
    type: string;
    action: string;
    details: string;
    status: "success" | "failed" | "pending";
    timestamp: string;
  }>;
}

type InsightPriority = "high" | "medium" | "low";

interface DashboardInsightItem {
  title: string;
  detail: string;
  priority: InsightPriority;
}

interface DashboardInsightsPayload {
  generatedAt: string;
  aiUsed: boolean;
  metrics: {
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
  };
  insights: {
    headline: string;
    summary: string;
    anomalies: DashboardInsightItem[];
    suggestions: DashboardInsightItem[];
    improvements: DashboardInsightItem[];
  };
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey?: string;
}

const NAV_ITEMS: Array<{ id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "workspace", label: "Workspace", icon: LayoutDashboard },
  { id: "email", label: "Email", icon: Mail },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "twitter", label: "Twitter/X", icon: Twitter },
  { id: "network", label: "Network", icon: Users },
  { id: "updates", label: "Updates", icon: ClipboardList },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "docs", label: "Docs", icon: FileText },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "insights", label: "AI Insights", icon: Lightbulb },
];

const SECTION_COPY: Record<SectionId, { title: string; subtitle: string; search: string }> = {
  workspace: {
    title: "Workspace",
    subtitle: "Real-time intelligence from connected channels",
    search: "Search workspace...",
  },
  email: {
    title: "Gmail",
    subtitle: "Mail Agent and AI classifier",
    search: "Search in unified mail...",
  },
  instagram: {
    title: "Instagram",
    subtitle: "Posts, reels, inbox and comments from one workspace",
    search: "Search Instagram...",
  },
  linkedin: {
    title: "LinkedIn",
    subtitle: "Publish posts, monitor comments and handle professional DMs",
    search: "Search LinkedIn...",
  },
  twitter: {
    title: "Twitter/X",
    subtitle: "External API track paused for now",
    search: "Search Twitter/X...",
  },
  network: {
    title: "Network",
    subtitle: "Connections and organization graph",
    search: "Search people or organizations...",
  },
  updates: {
    title: "Updates",
    subtitle: "Product and channel activity timeline",
    search: "Search updates...",
  },
  chat: {
    title: "Chat",
    subtitle: "Conversations across teams and channels",
    search: "Search in conversation...",
  },
  docs: {
    title: "Docs",
    subtitle: "Knowledge base and workspace docs",
    search: "Search docs...",
  },
  projects: {
    title: "Projects",
    subtitle: "Task orchestration and sprint execution",
    search: "Search tasks, docs, or people...",
  },
  insights: {
    title: "AI Insights",
    subtitle: "Status reports and anomaly detection",
    search: "Search analytics...",
  },
};

function defaultChannelState(): ChannelState {
  return {
    accountId: "",
    postText: "",
    messageRecipient: "",
    recipientDraft: "",
    savedRecipients: [],
    messageText: "",
    mediaUrl: "",
    mediaFiles: [],
    postMode: "post",
  };
}

function defaultChannelData(): ChannelData {
  return {
    posts: [],
    inbox: [],
    comments: [],
    loading: false,
    error: null,
  };
}

function readValue(input: unknown, fallback = "-") {
  if (typeof input === "string" && input.trim()) return input;
  if (typeof input === "number") return String(input);
  if (typeof input === "boolean") return input ? "true" : "false";
  return fallback;
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function uniqueStrings(items: string[], max = 8) {
  const seen = new Set<string>();
  const result: string[] = [];

  items.forEach((item) => {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });

  return result.slice(0, max);
}

function pickDisplay(item: unknown, keys: string[]) {
  if (!item || typeof item !== "object") return "No details";
  const objectItem = item as Record<string, unknown>;
  for (const key of keys) {
    const value = objectItem[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "No details";
}

interface ChatTarget {
  chatId: string;
  label: string;
}

function normalizeLookup(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function inboxProviderAliases(channel: SocialChannel) {
  if (channel === "twitter") return ["twitter", "x", "x_twitter"];
  return [channel];
}

function readInboxStringFields(item: Record<string, unknown>, keys: string[]) {
  const values: string[] = [];
  keys.forEach((key) => {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      values.push(value.trim());
    }
  });
  return values;
}

function readInboxAccountCandidates(item: Record<string, unknown>) {
  const values = readInboxStringFields(item, [
    "account_id",
    "accountId",
    "account",
    "account_uuid",
    "owner_account_id",
    "sender_account_id",
  ]);

  const account = item.account;
  if (account && typeof account === "object") {
    values.push(
      ...readInboxStringFields(account as Record<string, unknown>, [
        "id",
        "account_id",
        "accountId",
        "uuid",
      ]),
    );
  }

  return values;
}

function readInboxProviderCandidates(item: Record<string, unknown>) {
  const values = readInboxStringFields(item, [
    "provider",
    "provider_name",
    "platform",
    "channel",
    "network",
    "source",
    "source_provider",
  ]);

  const account = item.account;
  if (account && typeof account === "object") {
    values.push(
      ...readInboxStringFields(account as Record<string, unknown>, [
        "provider",
        "provider_name",
        "platform",
        "channel",
      ]),
    );
  }

  return values;
}

function filterInboxByChannel(inbox: unknown[], channel: SocialChannel, accountId?: string) {
  const aliases = inboxProviderAliases(channel).map((alias) => alias.toLowerCase());
  let scoped = inbox.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");

  if (accountId?.trim()) {
    const normalizedAccountId = accountId.trim().toLowerCase();
    const withAccountMetadata = scoped.filter((item) => readInboxAccountCandidates(item).length > 0);

    if (withAccountMetadata.length > 0) {
      scoped = withAccountMetadata.filter((item) => {
        return readInboxAccountCandidates(item).some((candidate) => candidate.toLowerCase() === normalizedAccountId);
      });
    }
  }

  const withProviderMetadata = scoped.filter((item) => readInboxProviderCandidates(item).length > 0);
  if (withProviderMetadata.length > 0) {
    scoped = withProviderMetadata.filter((item) => {
      return readInboxProviderCandidates(item)
        .map((candidate) => candidate.toLowerCase())
        .some((token) => aliases.some((alias) => token === alias || token.includes(alias) || alias.includes(token)));
    });
  }

  return scoped;
}

function extractChatTargets(inbox: unknown[]) {
  const seen = new Set<string>();
  const targets: ChatTarget[] = [];

  inbox.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const objectItem = item as Record<string, unknown>;
    const chatId = readValue(objectItem.id || objectItem.chat_id, "").trim();
    if (!chatId || chatId === "-") return;
    if (seen.has(chatId)) return;

    const label = pickDisplay(item, [
      "name",
      "subject",
      "title",
      "from",
      "sender",
      "attendee_provider_id",
      "provider_id",
      "id",
    ]);

    seen.add(chatId);
    targets.push({
      chatId,
      label,
    });
  });

  return targets;
}

function ShellHeader({ activeSection, onCreate }: { activeSection: SectionId; onCreate: () => void }) {
  const copy = SECTION_COPY[activeSection];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={copy.search}
            className="h-10 border-slate-200 bg-slate-100 pl-9 text-sm placeholder:text-slate-400"
          />
        </div>
        <div className="hidden items-center gap-3 text-sm text-slate-500 md:flex">
          <button className="font-medium text-blue-600">Filters</button>
          <button className="font-medium">Quick Actions</button>
          <button className="font-medium">Channel Settings</button>
        </div>
        <Button
          onClick={onCreate}
          size="sm"
          className="hidden h-10 rounded-xl bg-black px-4 text-white hover:bg-slate-900 sm:inline-flex"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Task
        </Button>
        <button className="rounded-full p-2 text-slate-500 hover:bg-slate-200">
          <Bell className="h-4 w-4" />
        </button>
        <button className="rounded-full p-2 text-slate-500 hover:bg-slate-200">
          <Settings className="h-4 w-4" />
        </button>
        <Avatar className="h-8 w-8 border border-slate-300">
          <AvatarFallback className="bg-slate-900 text-xs text-white">AR</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

function WorkspaceView({ overview, onJump }: { overview: DashboardOverviewPayload | null; onJump: (section: SectionId) => void }) {
  const persistedMetrics = overview?.metrics;
  const updates = overview?.updates || [];

  const failedFromUpdates = updates.filter((item) => item.status === "failed").length;
  const pendingFromUpdates = updates.filter((item) => item.status === "pending").length;
  const withDirection = updates.filter((item) => item.direction === "INBOUND" || item.direction === "OUTBOUND");
  const outboundFromUpdates = withDirection.filter((item) => item.direction === "OUTBOUND").length;

  const totalUpdates = persistedMetrics?.activity.totalUpdates ?? updates.length;
  const failed = persistedMetrics?.activity.failedUpdates ?? failedFromUpdates;
  const pending = persistedMetrics?.activity.pendingUpdates ?? pendingFromUpdates;
  const outbound = persistedMetrics?.activity.outboundCount ?? outboundFromUpdates;
  const outboundRate = persistedMetrics?.activity.outboundRate ?? (withDirection.length > 0 ? Math.round((outboundFromUpdates / withDirection.length) * 100) : 0);

  const channelRows = [
    {
      key: "email",
      label: "Gmail",
      icon: Mail,
      section: "email" as SectionId,
      connected: persistedMetrics?.connections.gmail ?? Boolean(overview?.connections.gmail),
      activity: updates.filter((item) => item.source === "email").length,
      detail: `${persistedMetrics?.email.unreadEmails ?? overview?.gmail.unreadEmails ?? 0} unread`,
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: Instagram,
      section: "instagram" as SectionId,
      connected: persistedMetrics?.connections.instagram ?? Boolean(overview?.connections.instagram),
      activity: updates.filter((item) => item.source === "instagram").length,
      detail: `${persistedMetrics?.social.instagramRecipients ?? (overview?.recipients.instagram || []).length} recipients`,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      icon: Linkedin,
      section: "linkedin" as SectionId,
      connected: persistedMetrics?.connections.linkedin ?? Boolean(overview?.connections.linkedin),
      activity: updates.filter((item) => item.source === "linkedin").length,
      detail: `${persistedMetrics?.social.linkedinRecipients ?? (overview?.recipients.linkedin || []).length} recipients`,
    },
    {
      key: "twitter",
      label: "Twitter/X",
      icon: Twitter,
      section: "twitter" as SectionId,
      connected: persistedMetrics?.connections.twitter ?? Boolean(overview?.connections.twitter),
      activity: updates.filter((item) => item.source === "twitter").length,
      detail: "Paused integration",
    },
    {
      key: "projects",
      label: "Jira Projects",
      icon: FolderKanban,
      section: "projects" as SectionId,
      connected: persistedMetrics?.connections.jira ?? Boolean(overview?.connections.jira),
      activity: updates.filter((item) => item.source === "automation").length,
      detail: overview?.jira.projectKey || "No project key",
    },
  ];

  const connectedCount = persistedMetrics?.connectedChannels ?? channelRows.filter((row) => row.connected).length;
  const totalChannels = persistedMetrics?.totalChannels ?? 5;
  const highPriorityEmail = (persistedMetrics?.email.highPriorityEmails ?? overview?.gmail.highPriorityEmails) || 0;
  const priorityQueue = updates
    .filter((item) => item.status === "failed" || item.status === "pending")
    .slice(0, 6);

  const pipeline = [
    {
      title: "Collect",
      value: totalUpdates,
      detail: "events synced",
      tone: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      title: "Classify",
      value: (persistedMetrics?.email.totalEmails ?? overview?.gmail.totalEmails) || 0,
      detail: "emails indexed",
      tone: "bg-violet-50 text-violet-700 border-violet-200",
    },
    {
      title: "Prioritize",
      value: failed + pending + highPriorityEmail,
      detail: "items requiring action",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      title: "Execute",
      value: outbound,
      detail: "outbound actions",
      tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 bg-white">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Connected Channels</p>
            <p className="text-3xl font-semibold text-slate-900">{connectedCount}/{totalChannels}</p>
            <p className="text-xs text-slate-500">Social + email + Jira coverage</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Activity Throughput</p>
            <p className="text-3xl font-semibold text-slate-900">{totalUpdates}</p>
            <p className="text-xs text-slate-500">recent unified updates</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Outbound Ratio</p>
            <p className="text-3xl font-semibold text-slate-900">{outboundRate}%</p>
            <p className="text-xs text-slate-500">share of outbound operations</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Action Queue</p>
            <p className="text-3xl font-semibold text-slate-900">{failed + pending + highPriorityEmail}</p>
            <p className="text-xs text-slate-500">failed + pending + high priority mail</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Social Media Orchestration Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((step) => (
            <div key={step.title} className={cn("rounded-xl border p-3", step.tone)}>
              <p className="text-xs uppercase tracking-[0.14em]">{step.title}</p>
              <p className="mt-1 text-2xl font-semibold">{step.value}</p>
              <p className="text-xs">{step.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Channel Command Center</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {channelRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                      <p className="text-xs text-slate-500">{row.detail}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={cn(row.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                      {row.connected ? "Connected" : "Attention"}
                    </Badge>
                    <span className="text-xs text-slate-500">{row.activity} events</span>
                    <Button size="sm" variant="outline" className="border-slate-300" onClick={() => onJump(row.section)}>
                      Open
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Priority Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {priorityQueue.length === 0 && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                No urgent failed or pending items right now.
              </p>
            )}
            {priorityQueue.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <Badge
                    variant="secondary"
                    className={cn(
                      item.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">{item.description || "No detail provided"}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{formatRelativeTime(item.timestamp)}</p>
              </div>
            ))}
            <Button variant="outline" className="w-full border-slate-300" onClick={() => onJump("updates")}>View Updates</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Live Cross-Channel Activity</CardTitle>
          <Button size="sm" variant="outline" className="border-slate-300" onClick={() => onJump("chat")}>Open Chat Ops</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {updates.slice(0, 12).map((item) => (
            <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{item.description || "No description"}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                  {item.source} · {formatRelativeTime(item.timestamp)}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  item.status === "failed"
                    ? "bg-red-100 text-red-700"
                    : item.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700",
                )}
              >
                {item.status}
              </Badge>
            </div>
          ))}
          {updates.length === 0 && <p className="text-sm text-slate-500">No recent activity. Connect channels to start orchestration.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function SocialChannelView({
  channel,
  state,
  data,
  onChange,
  onAddMediaFiles,
  onRemoveMediaFile,
  onRefresh,
  onOpenConnect,
  onPublish,
  onSendMessage,
  onAddRecipient,
  onSelectRecipient,
  onRemoveRecipient,
  isConnected,
  showOnboardingHint,
  instagramAssistant,
  onInstagramPromptChange,
  onInstagramVoiceNoteChange,
  onStartInstagramRecording,
  onStopInstagramRecording,
  onGenerateInstagramStrategy,
}: {
  channel: SocialChannel;
  state: ChannelState;
  data: ChannelData;
  onChange: (patch: Partial<ChannelState>) => void;
  onAddMediaFiles: (files: File[]) => void;
  onRemoveMediaFile: (index: number) => void;
  onRefresh: () => void;
  onOpenConnect: () => void;
  onPublish: () => void;
  onSendMessage: () => void;
  onAddRecipient: () => void;
  onSelectRecipient: (recipient: string) => void;
  onRemoveRecipient: (recipient: string) => void;
  isConnected: boolean;
  showOnboardingHint: boolean;
  instagramAssistant: InstagramAssistantState | null;
  onInstagramPromptChange: (value: string) => void;
  onInstagramVoiceNoteChange: (file: File | null) => void;
  onStartInstagramRecording: () => void;
  onStopInstagramRecording: () => void;
  onGenerateInstagramStrategy: () => void;
}) {
  const isTwitter = channel === "twitter";
  const isLinkedIn = channel === "linkedin";
  const isInstagram = channel === "instagram";
  const scopedInbox = useMemo(() => filterInboxByChannel(data.inbox, channel, state.accountId), [data.inbox, channel, state.accountId]);
  const chatTargets = extractChatTargets(scopedInbox).slice(0, 8);
  const supportsMediaComposer = isInstagram || isLinkedIn;
  const postLimit = isTwitter ? 280 : 3000;
  const postCount = state.postText.length;
  const mediaInputId = `${channel}-media-input`;

  const handleMediaInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    onAddMediaFiles(files);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/"));
    onAddMediaFiles(files);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardFiles = Array.from(event.clipboardData.files || []).filter((file) => file.type.startsWith("image/"));
    if (clipboardFiles.length > 0) {
      event.preventDefault();
      onAddMediaFiles(clipboardFiles);
    }
  };

  return (
    <div className="space-y-4">
      {showOnboardingHint && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-blue-800">
              Complete social onboarding once by connecting your first channel. This prompt will not be shown again.
            </p>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={onOpenConnect}>
              Connect Now
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="capitalize">{channel} Control Panel</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={cn("text-xs", isConnected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Button onClick={onOpenConnect} variant="outline" size="sm" className="border-slate-300">
                {isConnected ? "Manage" : "Connect"}
              </Button>
              <Button onClick={onRefresh} variant="outline" size="sm" className="border-slate-300" disabled={!isConnected}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            {isConnected ? (
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-700">Connected account ID</span>
                <code className="rounded-md bg-white px-2 py-1 text-xs text-slate-600">{state.accountId}</code>
              </div>
            ) : (
              <p className="text-slate-600">
                Channel is disconnected. Click <span className="font-semibold">Connect</span> to open login and bind account.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">{isInstagram ? "Create Post or Reel" : isLinkedIn ? "Create LinkedIn Post" : "Create Tweet"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isInstagram && (
              <div className="flex gap-2">
                <Button
                  variant={state.postMode === "post" ? "default" : "outline"}
                  onClick={() => onChange({ postMode: "post" })}
                  className={cn(state.postMode === "post" ? "bg-black text-white hover:bg-slate-900" : "border-slate-300")}
                >
                  Post
                </Button>
                <Button
                  variant={state.postMode === "reel" ? "default" : "outline"}
                  onClick={() => onChange({ postMode: "reel" })}
                  className={cn(state.postMode === "reel" ? "bg-black text-white hover:bg-slate-900" : "border-slate-300")}
                >
                  Reel
                </Button>
              </div>
            )}
            <textarea
              value={state.postText}
              onChange={(event) => onChange({ postText: event.target.value })}
              className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder={isLinkedIn ? "Write a professional update..." : isTwitter ? "What is happening?" : "Write your caption..."}
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{isTwitter ? "Tweets are limited to 280 characters" : "Draft supports long-form content"}</span>
              <span className={cn(isTwitter && postCount > postLimit ? "text-red-600" : "")}>{postCount}/{postLimit}</span>
            </div>
            {supportsMediaComposer && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Media URL (Optional)</label>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-slate-400" />
                  <Input
                    value={state.mediaUrl}
                    onChange={(event) => onChange({ mediaUrl: event.target.value })}
                    placeholder={isLinkedIn ? "Paste one or more image URLs (comma/new line separated)" : "Paste image URL (optional if uploading files)"}
                    className="border-slate-200"
                  />
                </div>

                <input
                  id={mediaInputId}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleMediaInput}
                />

                <div
                  className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>Drop images here, paste from clipboard, or choose from device.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-slate-300"
                      onClick={() => document.getElementById(mediaInputId)?.click()}
                    >
                      <Upload className="mr-1 h-4 w-4" />
                      Select Images
                    </Button>
                  </div>
                </div>

                {state.mediaFiles.length > 0 && (
                  <div className="space-y-2">
                    {state.mediaFiles.map((file, index) => (
                      <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                        <span className="truncate text-slate-700">{file.name}</span>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-600"
                          onClick={() => onRemoveMediaFile(index)}
                          aria-label="Remove media file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button onClick={onPublish} className="rounded-xl bg-black text-white hover:bg-slate-900" disabled={!state.postText.trim() || !isConnected}>
              <SendHorizontal className="mr-2 h-4 w-4" />
              {isInstagram ? `Publish ${state.postMode}` : isLinkedIn ? "Publish to LinkedIn" : "Publish Tweet"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Direct Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chatTargets.length > 0 && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Inbox Chat Targets</p>
                <div className="flex flex-wrap gap-2">
                  {chatTargets.map((target) => (
                    <button
                      key={target.chatId}
                      type="button"
                      className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700"
                      onClick={() => onChange({ messageRecipient: target.chatId })}
                      title={`${target.label} (${target.chatId})`}
                    >
                      {target.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">Selecting a chat target fills recipient with chat ID for reliable delivery.</p>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Saved Usernames</p>
              <div className="flex items-center gap-2">
                <Input
                  value={state.recipientDraft}
                  onChange={(event) => onChange({ recipientDraft: event.target.value })}
                  placeholder="Add username or recipient handle"
                  className="border-slate-200"
                />
                <Button type="button" variant="outline" className="border-slate-300" onClick={onAddRecipient}>
                  Save
                </Button>
              </div>

              {state.savedRecipients.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {state.savedRecipients.map((recipient) => (
                    <div key={recipient} className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1">
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-700 hover:text-blue-700"
                        onClick={() => onSelectRecipient(recipient)}
                      >
                        {recipient}
                      </button>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => onRemoveRecipient(recipient)}
                        aria-label="Remove saved username"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No saved usernames yet. Save recipients for one-click messaging.</p>
              )}
            </div>

            <Input
              value={state.messageRecipient}
              onChange={(event) => onChange({ messageRecipient: event.target.value })}
              placeholder="Recipient (chat ID recommended)"
              className="border-slate-200"
            />
            <textarea
              value={state.messageText}
              onChange={(event) => onChange({ messageText: event.target.value })}
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="Type inbox message..."
            />
            <Button
              onClick={onSendMessage}
              variant="outline"
              className="w-full rounded-xl border-slate-300"
              disabled={!state.messageText.trim() || !state.messageRecipient.trim() || !isConnected}
            >
              Send Message
            </Button>
          </CardContent>
        </Card>
      </div>

      {isInstagram && instagramAssistant && (
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4" />
              Instagram AI Strategy Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={instagramAssistant.prompt}
              onChange={(event) => onInstagramPromptChange(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="Tell AI your niche, audience, goals, and constraints..."
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={instagramAssistant.isRecording ? "destructive" : "outline"}
                size="sm"
                className={cn(
                  instagramAssistant.isRecording
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "border-slate-300",
                )}
                onClick={instagramAssistant.isRecording ? onStopInstagramRecording : onStartInstagramRecording}
              >
                <Mic className="mr-2 h-4 w-4" />
                {instagramAssistant.isRecording ? "Stop Recording" : "Record Voice"}
              </Button>

              <Input
                type="file"
                accept="audio/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  onInstagramVoiceNoteChange(file);
                }}
                className="max-w-xs border-slate-200"
              />
              {instagramAssistant.voiceNote && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {instagramAssistant.voiceNote.name}
                </Badge>
              )}
              {instagramAssistant.voiceNote && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                  onClick={() => onInstagramVoiceNoteChange(null)}
                >
                  Remove Voice Note
                </Button>
              )}
            </div>

            <Button
              onClick={onGenerateInstagramStrategy}
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              disabled={instagramAssistant.loading || instagramAssistant.isRecording}
            >
              {instagramAssistant.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Strategy
            </Button>

            {instagramAssistant.transcript && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Voice Transcript</p>
                <p className="whitespace-pre-wrap">{instagramAssistant.transcript}</p>
              </div>
            )}

            {instagramAssistant.strategy && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">AI Strategy Plan</p>
                <div className="space-y-2 text-sm leading-6">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="mt-3 text-base font-semibold text-slate-900 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="mt-3 text-base font-semibold text-slate-900 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="mt-2 text-sm font-semibold text-slate-900">{children}</h3>,
                      p: ({ children }) => <p className="text-slate-700">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-slate-700">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-slate-700">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                      hr: () => <div className="my-2 h-px bg-blue-200" />,
                    }}
                  >
                    {instagramAssistant.strategy}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Inbox Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading inbox...
              </div>
            ) : scopedInbox.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-slate-500">No inbox data returned yet. Check account ID and refresh.</p>
            ) : (
              scopedInbox.slice(0, 6).map((item, index) => (
                <div key={`inbox-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{pickDisplay(item, ["subject", "title", "from", "sender", "id"])}</p>
                  <p className="mt-1 text-xs text-slate-500">{pickDisplay(item, ["text", "snippet", "content", "last_message"])}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading comments...
              </div>
            ) : data.comments.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-slate-500">No comments available yet for this channel.</p>
            ) : (
              data.comments.slice(0, 6).map((item, index) => (
                <div key={`comment-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{pickDisplay(item, ["author", "from", "user", "sender", "id"])}</p>
                  <p className="mt-1 text-xs text-slate-500">{pickDisplay(item, ["text", "content", "body", "message"])}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Published Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading posts...
            </div>
          ) : data.posts.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-3 text-slate-500">No published posts fetched yet.</p>
          ) : (
            data.posts.slice(0, 8).map((item, index) => (
              <div key={`post-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-900">{pickDisplay(item, ["title", "id", "urn", "post_id"])}</p>
                  <p className="mt-1 text-xs text-slate-500">{pickDisplay(item, ["content", "text", "snippet", "caption"])}</p>
                </div>
                <Badge variant="secondary">{readValue((item as Record<string, unknown>)?.status, "PUBLISHED")}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {data.error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">{data.error}</CardContent>
        </Card>
      )}
    </div>
  );
}

function NetworkView({
  overview,
  onJump,
}: {
  overview: DashboardOverviewPayload | null;
  onJump: (section: SectionId) => void;
}) {
  const [activeNode, setActiveNode] = useState<string>("gmail");

  const channels = useMemo(() => {
    const updates = overview?.updates || [];
    const recipients = overview?.recipients || { instagram: [], linkedin: [], twitter: [] };
    const updateCountBySource = updates.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});

    const instagramContacts = uniqueStrings(
      updates
        .filter((item) => item.source === "instagram")
        .map((item) => item.contactName || "")
        .concat(recipients.instagram || []),
      8,
    );

    const linkedinContacts = uniqueStrings(
      updates
        .filter((item) => item.source === "linkedin")
        .map((item) => item.contactName || "")
        .concat(recipients.linkedin || []),
      8,
    );

    const gmailNodes = uniqueStrings(
      [
        overview?.gmail.email || "",
        `Unread ${overview?.gmail.unreadEmails || 0}`,
        `High Priority ${overview?.gmail.highPriorityEmails || 0}`,
      ].filter(Boolean),
      6,
    );

    return [
      {
        id: "gmail",
        label: "Gmail",
        connected: Boolean(overview?.connections.gmail),
        icon: Mail,
        members: gmailNodes,
        section: "email" as SectionId,
        accent: "from-blue-500/25 via-sky-400/15 to-transparent",
        signal: Math.min(96, 25 + gmailNodes.length * 16 + (overview?.gmail.unreadEmails || 0)),
        activity: updateCountBySource.email || 0,
        summary: overview?.gmail.email || "Mail sync ready",
      },
      {
        id: "instagram",
        label: "Instagram",
        connected: Boolean(overview?.connections.instagram),
        icon: Instagram,
        members: instagramContacts,
        section: "instagram" as SectionId,
        accent: "from-pink-500/25 via-rose-400/15 to-transparent",
        signal: Math.min(96, 22 + instagramContacts.length * 18 + (updateCountBySource.instagram || 0)),
        activity: updateCountBySource.instagram || 0,
        summary: instagramContacts[0] || "No recent Instagram threads",
      },
      {
        id: "linkedin",
        label: "LinkedIn",
        connected: Boolean(overview?.connections.linkedin),
        icon: Linkedin,
        members: linkedinContacts,
        section: "linkedin" as SectionId,
        accent: "from-blue-600/25 via-blue-400/15 to-transparent",
        signal: Math.min(96, 22 + linkedinContacts.length * 18 + (updateCountBySource.linkedin || 0)),
        activity: updateCountBySource.linkedin || 0,
        summary: linkedinContacts[0] || "No recent LinkedIn threads",
      },
      {
        id: "jira",
        label: "Jira",
        connected: Boolean(overview?.connections.jira),
        icon: FolderKanban,
        members: uniqueStrings(
          [
            overview?.jira.projectKey || "",
            overview?.jira.siteName || "",
            `${(overview?.activity || []).filter((log) => log.type === "jira_task").length} Jira automations`,
          ].filter(Boolean),
          6,
        ),
        section: "projects" as SectionId,
        accent: "from-slate-700/25 via-slate-500/15 to-transparent",
        signal: Math.min(96, 20 + (overview?.activity || []).filter((log) => log.type === "jira_task").length * 16),
        activity: updateCountBySource.automation || 0,
        summary: overview?.jira.projectKey || "Project key not selected",
      },
    ];
  }, [overview]);

  const selected = channels.find((channel) => channel.id === activeNode) || channels[0];
  const connectedCount = channels.filter((channel) => channel.connected).length;
  const totalMembers = channels.reduce((acc, channel) => acc + channel.members.length, 0);
  const lastSignal = (overview?.updates || [])[0]?.timestamp || null;

  if (!overview) {
    return (
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-6 text-sm text-slate-500">Loading network map...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-slate-200 bg-white">
        <CardHeader className="border-b border-slate-100 bg-linear-to-r from-slate-50 via-blue-50/70 to-slate-50">
          <CardTitle className="text-base">Connection Fabric</CardTitle>
          <p className="text-xs text-slate-500">A live signal board of how your channels are flowing right now.</p>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-b from-slate-50 via-white to-slate-50 p-3">
            <div className="pointer-events-none absolute -left-10 top-8 h-44 w-44 rounded-full bg-blue-100/40 blur-3xl" />
            <div className="pointer-events-none absolute -right-8 bottom-6 h-44 w-44 rounded-full bg-pink-100/40 blur-3xl" />

            <div className="relative space-y-3 p-2">
              {channels.map((channel) => {
                const Icon = channel.icon;
                const selectedRow = selected?.id === channel.id;
                return (
                  <button
                    key={channel.id}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-all",
                      selectedRow
                        ? "border-slate-800 bg-white shadow-sm"
                        : "border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white",
                    )}
                    onClick={() => setActiveNode(channel.id)}
                    onMouseEnter={() => setActiveNode(channel.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br", channel.accent)}>
                          <Icon className="h-4.5 w-4.5 text-slate-900" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{channel.label}</p>
                          <p className="truncate text-xs text-slate-500">{channel.summary}</p>
                        </div>
                      </div>

                      <Badge
                        variant="secondary"
                        className={cn(
                          channel.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {channel.connected ? "Live" : "Setup"}
                      </Badge>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={cn("absolute inset-y-0 left-0 rounded-full bg-linear-to-r", channel.accent)}
                          style={{ width: `${channel.signal}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600">{channel.signal}%</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white/90 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Connected Nodes</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{connectedCount}/{channels.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/90 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Mapped Contacts</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{totalMembers}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/90 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Last Signal</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatRelativeTime(lastSignal)}</p>
              </div>
            </div>
          </div>

          <div className="relative space-y-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className={cn("pointer-events-none absolute -right-10 top-4 h-40 w-40 rounded-full bg-linear-to-br blur-2xl", selected?.accent || "from-slate-200 to-transparent")} />
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Selected Node</p>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{selected?.label || "-"}</h3>
              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600">{selected?.members.length || 0} records</span>
            </div>
            <Badge
              variant="secondary"
              className={cn(selected?.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}
            >
              {selected?.connected ? "Connected" : "Not Connected"}
            </Badge>

            <div className="flex flex-wrap gap-2">
              {(selected?.members || []).slice(0, 8).map((item) => (
                <span key={item} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-xs">
                  {item}
                </span>
              ))}
            </div>

            {!selected?.members?.length && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-2 text-xs text-slate-500">
                No linked records yet for this node. Connect the tool or generate activity to enrich this map.
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="border-slate-300 bg-white"
              onClick={() => selected?.section && onJump(selected.section)}
            >
              Open {selected?.label}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {channels.map((channel) => (
          <button
            key={channel.id}
            className={cn(
              "rounded-xl border bg-white p-4 text-left transition-all duration-200",
              activeNode === channel.id
                ? "border-blue-300 shadow-sm ring-1 ring-blue-100"
                : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm",
            )}
            onClick={() => setActiveNode(channel.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{channel.label}</p>
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  channel.connected ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{channel.members.length} mapped nodes</p>
            <p className={cn("mt-2 text-xs font-medium", channel.connected ? "text-emerald-600" : "text-amber-600")}>{channel.connected ? "Connected" : "Needs setup"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function UpdatesView({ overview }: { overview: DashboardOverviewPayload | null }) {
  const sources: Array<DashboardOverviewUpdate["source"]> = ["email", "instagram", "linkedin", "whatsapp", "automation"];

  const days = useMemo(() => {
    const values: string[] = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      values.push(date.toISOString().slice(0, 10));
    }
    return values;
  }, []);

  const heatmap = useMemo(() => {
    const matrix = new Map<string, number>();
    (overview?.updates || []).forEach((item) => {
      const key = `${item.source}:${item.timestamp.slice(0, 10)}`;
      matrix.set(key, (matrix.get(key) || 0) + 1);
    });
    return matrix;
  }, [overview]);

  const bySource = useMemo(() => {
    const counts = new Map<string, number>();
    (overview?.updates || []).forEach((item) => {
      counts.set(item.source, (counts.get(item.source) || 0) + 1);
    });
    return counts;
  }, [overview]);

  const cellStyle = (count: number) => {
    if (count >= 8) return "bg-blue-700";
    if (count >= 5) return "bg-blue-500";
    if (count >= 2) return "bg-blue-300";
    if (count >= 1) return "bg-blue-100";
    return "bg-slate-100";
  };

  if (!overview) {
    return (
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-6 text-sm text-slate-500">Loading updates dashboard...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Update Heatmap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          <div className="min-w-max space-y-2">
            {sources.map((source) => (
              <div key={source} className="flex items-center gap-2">
                <div className="w-24 text-xs font-medium uppercase tracking-wide text-slate-500">{source}</div>
                <div className="flex gap-1.5">
                  {days.map((day) => {
                    const count = heatmap.get(`${source}:${day}`) || 0;
                    return (
                      <div
                        key={`${source}-${day}`}
                        title={`${source} · ${day} · ${count} updates`}
                        className={cn("h-5 w-5 rounded-sm border border-slate-200", cellStyle(count))}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {sources.map((source) => (
              <div key={source} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{source}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{bySource.get(source) || 0}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Consolidated Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(overview.updates || []).slice(0, 24).map((item) => (
            <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{item.description || "No details provided"}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                  {item.source} · {formatRelativeTime(item.timestamp)}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  item.status === "failed"
                    ? "bg-red-100 text-red-700"
                    : item.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700",
                )}
              >
                {item.status}
              </Badge>
            </div>
          ))}
          {overview.updates.length === 0 && <p className="text-sm text-slate-500">No update data available yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function ChatView({
  overview,
  onJump,
}: {
  overview: DashboardOverviewPayload | null;
  onJump: (section: SectionId) => void;
}) {
  const [selectedSource, setSelectedSource] = useState<DashboardOverviewUpdate["source"]>("instagram");
  const sources: Array<DashboardOverviewUpdate["source"]> = ["instagram", "linkedin", "email", "whatsapp", "automation"];

  const queue = useMemo(() => {
    const entries = (overview?.updates || []).filter((item) => item.source === selectedSource);
    return entries.slice(0, 16);
  }, [overview, selectedSource]);

  const sourceCounts = useMemo(() => {
    const counts = new Map<DashboardOverviewUpdate["source"], number>();
    (overview?.updates || []).forEach((item) => {
      counts.set(item.source, (counts.get(item.source) || 0) + 1);
    });
    return counts;
  }, [overview]);

  const sourceTarget: Record<DashboardOverviewUpdate["source"], SectionId> = {
    instagram: "instagram",
    linkedin: "linkedin",
    email: "email",
    whatsapp: "workspace",
    twitter: "twitter",
    automation: "updates",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr_280px]">
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Conversation Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sources.map((source) => (
            <button
              key={source}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
                selectedSource === source ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
              )}
              onClick={() => setSelectedSource(source)}
            >
              <span className="capitalize">{source}</span>
              <Badge variant="secondary" className={cn(selectedSource === source ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
                {sourceCounts.get(source) || 0}
              </Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base capitalize">{selectedSource} Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.length === 0 && <p className="text-sm text-slate-500">No chat updates in this source yet.</p>}
          {queue.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.contactName || item.title}</p>
                <p className="text-xs text-slate-500">{formatRelativeTime(item.timestamp)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-600">{item.description || "No summary"}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                  onClick={() => onJump(sourceTarget[item.source])}
                >
                  Open Source
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Action Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Smart Triage</p>
            <p className="mt-1">Use source queues to process replies in priority order. Each row jumps to its working section.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Quick Workflow</p>
            <p className="mt-1">1) Open Source 2) Reply/Publish 3) Return to Updates to confirm status.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DocsView() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-xl">Design + Implementation Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-slate-700">
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">1. Section Architecture</h3>
            <p>
              Use this dashboard flow: data from APIs in route handlers, transform in state hooks, render in section components.
              Keep channel-specific logic isolated inside each section view.
            </p>
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
{`src/
  app/api/...      # Data contracts and integration calls
  features/unified-dashboard/UnifiedDashboardView.tsx
  lib/...          # Reusable integration helpers`}
            </pre>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">2. Visual System</h3>
            <p>Use consistent primitives: Card, Badge, Button, Input. Keep spacing at 4/6/8 rhythm and surface backgrounds in slate/blue scale.</p>
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
{`<Card className="border-slate-200 bg-white">
  <CardHeader><CardTitle className="text-base">Section Title</CardTitle></CardHeader>
  <CardContent className="space-y-3">...</CardContent>
</Card>`}
            </pre>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">3. Data Refresh Pattern</h3>
            <p>After write actions (publish, send, connect), refresh both channel data and overview to keep Network/Updates/Projects synchronized.</p>
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
{`await actionCall();
await fetchChannelData(channel);
await fetchDashboardOverview();`}
            </pre>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">4. Feature Toggle Guidance</h3>
            <p>
              If a provider needs external APIs (for example Twitter/X), keep the section visible but clearly marked as paused, and avoid executing unstable API calls.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectsView({
  overview,
  jiraProjects,
  jiraLoading,
  onConnectJira,
  onRefreshJiraProjects,
}: {
  overview: DashboardOverviewPayload | null;
  jiraProjects: JiraProject[];
  jiraLoading: boolean;
  onConnectJira: () => void;
  onRefreshJiraProjects: () => void;
}) {
  const jiraActivity = (overview?.activity || []).filter((log) => log.type === "jira_task").slice(0, 12);

  if (!overview?.jira.connected) {
    return (
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Jira Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Jira is not connected. Connect Jira to load project boards, issue automation status, and task orchestration.
          </p>
          <Button className="rounded-lg bg-black text-white hover:bg-slate-900" onClick={onConnectJira}>
            Connect Jira
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Jira Workspace</span>
            <Button variant="outline" size="sm" className="border-slate-300" onClick={onRefreshJiraProjects}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Site</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{overview.jira.siteName || "Connected Jira Site"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Project Key</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{overview.jira.projectKey || "Not selected"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Task Automations</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{jiraActivity.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jiraLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading Jira projects...
            </div>
          )}

          {!jiraLoading && jiraProjects.length === 0 && (
            <p className="text-sm text-slate-500">No projects returned yet. Click refresh after selecting Jira access.</p>
          )}

          {jiraProjects.map((project) => (
            <div key={project.id || project.key} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{project.name}</p>
              <p className="mt-1 text-xs text-slate-500">{project.key} · {project.projectTypeKey || "software"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Recent Jira Automation Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jiraActivity.length === 0 && <p className="text-sm text-slate-500">No Jira automation activity yet.</p>}
          {jiraActivity.map((log) => (
            <div key={log.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-900">{log.action}</p>
              <p className="mt-1 text-xs text-slate-600">{log.details}</p>
              <p className="mt-1 text-[11px] text-slate-500">{formatRelativeTime(log.timestamp)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TwitterHoldingView() {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-base">Twitter/X Integration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <p>
          Twitter/X is temporarily paused in this build because it depends on external APIs that are not finalized for this environment.
        </p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          Keep using Gmail, Instagram, LinkedIn, Network, Updates, and Projects. Twitter workflows will be enabled once the API layer is stabilized.
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsView({
  insights,
  loading,
  error,
  onRefresh,
}: {
  insights: DashboardInsightsPayload | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const metrics = insights?.metrics;
  const payload = insights?.insights;

  const sourceBars = useMemo(() => {
    const entries = Object.entries(metrics?.channelVolumes24h || {});
    const max = entries.reduce((acc, [, value]) => Math.max(acc, value), 1);
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({
        name,
        value,
        width: Math.max(10, Math.round((value / max) * 100)),
      }));
  }, [metrics]);

  const toLabel = (value: string) => {
    if (!value) return "-";
    return value
      .split(/[_\s-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const priorityClass = (priority: InsightPriority) => {
    if (priority === "high") return "bg-red-100 text-red-700";
    if (priority === "low") return "bg-slate-200 text-slate-700";
    return "bg-amber-100 text-amber-700";
  };

  if (loading && !insights) {
    return (
      <Card className="border-slate-200 bg-white">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Building AI insights from live data...
        </CardContent>
      </Card>
    );
  }

  if (error && !insights) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="space-y-3 p-6 text-sm text-red-700">
          <p>{error}</p>
          <Button variant="outline" className="border-red-300 bg-white" onClick={onRefresh}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-slate-500">Signal Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{metrics?.signalScore ?? 0}</p>
            <p className="mt-1 text-xs text-blue-600">{insights?.aiUsed ? "AI-calibrated" : "Heuristic mode"}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-slate-500">Events (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{metrics?.totalEvents24h ?? 0}</p>
            <p className="mt-1 text-xs text-slate-500">Top channel: {toLabel(metrics?.topChannel || "none")}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-slate-500">Outbound Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{metrics?.outboundRate24h ?? 0}%</p>
            <p className="mt-1 text-xs text-slate-500">Failed events: {metrics?.failedEvents24h ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-slate-500">Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{Math.round((metrics?.connectionCoverage || 0) * 100)}%</p>
            <p className="mt-1 text-xs text-slate-500">Unread emails: {metrics?.unreadEmails ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">AI Executive Insight</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Generated {formatRelativeTime(insights?.generatedAt || null)}</p>
          </div>
          <Button variant="outline" size="sm" className="border-slate-300" onClick={onRefresh}>
            <RefreshCw className={cn("mr-1 h-4 w-4", loading ? "animate-spin" : "")} />
            Refresh Insights
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-lg font-semibold text-slate-900">{payload?.headline || "Live insight unavailable"}</p>
          <p className="text-sm text-slate-600">{payload?.summary || "No summary generated yet."}</p>
          {error && <p className="text-xs text-amber-600">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Anomalies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(payload?.anomalies || []).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <Badge className={priorityClass(item.priority)}>{item.priority}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
              </div>
            ))}
            {(payload?.anomalies || []).length === 0 && <p className="text-sm text-slate-500">No anomalies detected.</p>}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(payload?.suggestions || []).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <Badge className={priorityClass(item.priority)}>{item.priority}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
              </div>
            ))}
            {(payload?.suggestions || []).length === 0 && <p className="text-sm text-slate-500">No suggestions yet.</p>}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Improvements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(payload?.improvements || []).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <Badge className={priorityClass(item.priority)}>{item.priority}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
              </div>
            ))}
            {(payload?.improvements || []).length === 0 && <p className="text-sm text-slate-500">No improvements listed.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Channel Pulse (24h)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sourceBars.map((bar) => (
            <div key={bar.name} className="flex items-center gap-3">
              <div className="w-24 text-xs font-medium uppercase tracking-wide text-slate-500">{toLabel(bar.name)}</div>
              <div className="h-2.5 flex-1 rounded-full bg-slate-200">
                <div className="h-2.5 rounded-full bg-linear-to-r from-blue-600 to-sky-400" style={{ width: `${bar.width}%` }} />
              </div>
              <div className="w-10 text-right text-xs text-slate-600">{bar.value}</div>
            </div>
          ))}
          {sourceBars.length === 0 && <p className="text-sm text-slate-500">No channel activity in this window.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function GenericView({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-slate-600">
        <p>{description}</p>
      </CardContent>
    </Card>
  );
}

export default function UnifiedDashboardView({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<SectionId>("workspace");
  const [agentId, setAgentId] = useState("");
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [connectDialogChannel, setConnectDialogChannel] = useState<SocialChannel | null>(null);
  const [isConnectUrlLoading, setIsConnectUrlLoading] = useState(false);
  const [socialOnboardingCompleted, setSocialOnboardingCompleted] = useState(false);
  const [isConnectionsLoading, setIsConnectionsLoading] = useState(true);
  const [dashboardOverview, setDashboardOverview] = useState<DashboardOverviewPayload | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [dashboardInsights, setDashboardInsights] = useState<DashboardInsightsPayload | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [channelState, setChannelState] = useState<Record<SocialChannel, ChannelState>>({
    instagram: defaultChannelState(),
    linkedin: defaultChannelState(),
    twitter: defaultChannelState(),
  });

  const [channelData, setChannelData] = useState<Record<SocialChannel, ChannelData>>({
    instagram: defaultChannelData(),
    linkedin: defaultChannelData(),
    twitter: defaultChannelData(),
  });

  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [isJiraProjectsLoading, setIsJiraProjectsLoading] = useState(false);

  const [instagramAssistant, setInstagramAssistant] = useState<InstagramAssistantState>({
    prompt: "",
    voiceNote: null,
    transcript: "",
    strategy: "",
    loading: false,
    isRecording: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const fetchDashboardOverview = async () => {
    setIsOverviewLoading(true);
    setOverviewError(null);
    try {
      const response = await fetch("/api/dashboard/overview", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readValue(payload?.error, "Failed to load overview"));
      }
      setDashboardOverview(payload as DashboardOverviewPayload);
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : "Failed to load overview");
    } finally {
      setIsOverviewLoading(false);
    }
  };

  const fetchDashboardInsights = async () => {
    setIsInsightsLoading(true);
    setInsightsError(null);
    try {
      const response = await fetch(`/api/dashboard/insights?ts=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readValue(payload?.error, "Failed to load insights"));
      }
      setDashboardInsights(payload as DashboardInsightsPayload);
    } catch (error) {
      setInsightsError(error instanceof Error ? error.message : "Failed to load insights");
    } finally {
      setIsInsightsLoading(false);
    }
  };

  const fetchJiraProjects = async () => {
    if (!agentId) return;

    setIsJiraProjectsLoading(true);
    try {
      const response = await fetch("/api/standalone-agents/gmail-classifier/jira-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(readValue(payload?.error, "Failed to load Jira projects"));
      }

      setJiraProjects(Array.isArray(payload?.projects) ? (payload.projects as JiraProject[]) : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load Jira projects");
      setJiraProjects([]);
    } finally {
      setIsJiraProjectsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardOverview();
    void fetchDashboardInsights();
  }, []);

  useEffect(() => {
    if (activeSection !== "insights") return;

    void fetchDashboardInsights();

    const intervalId = window.setInterval(() => {
      void fetchDashboardInsights();
    }, 45000);

    return () => window.clearInterval(intervalId);
  }, [activeSection]);

  useEffect(() => {
    async function loadSocialConnections() {
      setIsConnectionsLoading(true);
      try {
        const response = await fetch("/api/social-connections");
        const data = (await response.json()) as SocialConnectionsResponse;
        if (!response.ok) return;

        setChannelState((prev) => ({
          instagram: { ...prev.instagram, accountId: data.connections.instagram || "" },
          linkedin: { ...prev.linkedin, accountId: data.connections.linkedin || "" },
          twitter: { ...prev.twitter, accountId: data.connections.twitter || "" },
        }));
        setChannelState((prev) => ({
          instagram: { ...prev.instagram, savedRecipients: Array.isArray(data.recipients?.instagram) ? data.recipients.instagram : [] },
          linkedin: { ...prev.linkedin, savedRecipients: Array.isArray(data.recipients?.linkedin) ? data.recipients.linkedin : [] },
          twitter: { ...prev.twitter, savedRecipients: Array.isArray(data.recipients?.twitter) ? data.recipients.twitter : [] },
        }));
        setSocialOnboardingCompleted(Boolean(data.onboardingCompleted));
      } catch {
        // Keep UI usable even if this request fails.
      } finally {
        setIsConnectionsLoading(false);
        void fetchDashboardOverview();
        void fetchDashboardInsights();
      }
    }

    void loadSocialConnections();
  }, []);

  useEffect(() => {
    async function initGmailAgent() {
      setIsAgentLoading(true);
      try {
        const res = await fetch("/api/standalone-agents/gmail-classifier/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (res.ok && data?.agent?.id) {
          setAgentId(String(data.agent.id));
          void fetchDashboardOverview();
          void fetchDashboardInsights();
        }
      } catch (error) {
        console.error("Failed to initialize Gmail agent", error);
        toast.error("Unable to initialize Gmail classifier");
      } finally {
        setIsAgentLoading(false);
      }
    }

    void initGmailAgent();
  }, []);

  const activeChannel = useMemo<SocialChannel | null>(() => {
    if (activeSection === "instagram" || activeSection === "linkedin") {
      return activeSection;
    }
    return null;
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "projects" && dashboardOverview?.jira.connected) {
      void fetchJiraProjects();
    }
  }, [activeSection, dashboardOverview?.jira.connected, agentId]);

  const fetchChannelData = async (channel: SocialChannel) => {
    const accountId = channelState[channel].accountId;

    setChannelData((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], loading: true, error: null },
    }));

    try {
      const unipileRes = await fetch(
        `/api/unipile/feed?platform=${encodeURIComponent(channel)}&accountId=${encodeURIComponent(accountId || "")}`,
      );
      const unipileData = await unipileRes.json();

      const historyMap: Record<SocialChannel, string> = {
        instagram: "/api/instagram/history",
        linkedin: "/api/linkedin/history",
        twitter: "/api/twitter/history",
      };

      const historyRes = await fetch(`${historyMap[channel]}?userId=${encodeURIComponent(userId)}`);
      const history = historyRes.ok ? await historyRes.json() : [];

      setChannelData((prev) => ({
        ...prev,
        [channel]: {
          loading: false,
          error: unipileRes.ok ? null : readValue(unipileData?.error, "Unipile feed failed"),
          inbox: Array.isArray(unipileData?.inbox) ? unipileData.inbox : [],
          comments: Array.isArray(unipileData?.comments) ? unipileData.comments : [],
          posts: [...(Array.isArray(history) ? history : []), ...(Array.isArray(unipileData?.posts) ? unipileData.posts : [])],
        },
      }));
    } catch (error) {
      setChannelData((prev) => ({
        ...prev,
        [channel]: {
          ...prev[channel],
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load channel data",
        },
      }));
    }
  };

  useEffect(() => {
    if (activeChannel) {
      void fetchChannelData(activeChannel);
    }
  }, [activeChannel]);

  const updateChannelState = (channel: SocialChannel, patch: Partial<ChannelState>) => {
    setChannelState((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        ...patch,
      },
    }));
  };

  const handleAddMediaFiles = (channel: SocialChannel, files: File[]) => {
    if (files.length === 0) return;
    setChannelState((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        mediaFiles: [...prev[channel].mediaFiles, ...files],
      },
    }));
  };

  const handleRemoveMediaFile = (channel: SocialChannel, index: number) => {
    const next = [...channelState[channel].mediaFiles];
    next.splice(index, 1);
    updateChannelState(channel, { mediaFiles: next });
  };

  const handleGenerateInstagramStrategy = async () => {
    if (instagramAssistant.isRecording) {
      toast.error("Stop recording before generating strategy");
      return;
    }

    if (!instagramAssistant.prompt.trim() && !instagramAssistant.voiceNote) {
      toast.error("Add a brief or voice note first");
      return;
    }

    try {
      setInstagramAssistant((prev) => ({ ...prev, loading: true }));

      const formData = new FormData();
      formData.append("prompt", instagramAssistant.prompt);
      if (instagramAssistant.voiceNote) {
        formData.append("voiceNote", instagramAssistant.voiceNote);
      }

      const response = await fetch("/api/ai/instagram-strategy", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readValue(payload?.error, "Failed to build Instagram strategy"));
      }

      setInstagramAssistant((prev) => ({
        ...prev,
        transcript: readValue(payload?.transcript, ""),
        strategy: readValue(payload?.strategy, ""),
      }));
      toast.success("Instagram strategy generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate strategy");
    } finally {
      setInstagramAssistant((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const persistRecipients = async (channel: SocialChannel, recipients: string[]) => {
    const response = await fetch("/api/social-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        recipients,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(readValue(payload?.error, "Failed to save usernames"));
    }
  };

  const handleAddRecipient = async (channel: SocialChannel) => {
    const current = channelState[channel];
    const nextRecipient = current.recipientDraft.trim();
    if (!nextRecipient) {
      toast.error("Enter a username first");
      return;
    }

    const alreadyExists = current.savedRecipients.some(
      (item) => item.toLowerCase() === nextRecipient.toLowerCase(),
    );
    if (alreadyExists) {
      updateChannelState(channel, { messageRecipient: nextRecipient, recipientDraft: "" });
      toast.info("Username already saved");
      return;
    }

    const nextRecipients = [nextRecipient, ...current.savedRecipients].slice(0, 50);
    try {
      await persistRecipients(channel, nextRecipients);
      updateChannelState(channel, {
        savedRecipients: nextRecipients,
        messageRecipient: nextRecipient,
        recipientDraft: "",
      });
      toast.success("Username saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save username");
    }
  };

  const handleSelectRecipient = (channel: SocialChannel, recipient: string) => {
    updateChannelState(channel, { messageRecipient: recipient });
  };

  const handleRemoveRecipient = async (channel: SocialChannel, recipient: string) => {
    const nextRecipients = channelState[channel].savedRecipients.filter(
      (item) => item.toLowerCase() !== recipient.toLowerCase(),
    );
    try {
      await persistRecipients(channel, nextRecipients);
      updateChannelState(channel, {
        savedRecipients: nextRecipients,
        messageRecipient:
          channelState[channel].messageRecipient.toLowerCase() === recipient.toLowerCase()
            ? ""
            : channelState[channel].messageRecipient,
      });
      toast.success("Username removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove username");
    }
  };

  const handleStartInstagramRecording = async () => {
    if (instagramAssistant.isRecording) return;

    if (typeof window === "undefined" || !window.navigator?.mediaDevices?.getUserMedia) {
      toast.error("Microphone recording is not supported in this browser");
      return;
    }

    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];

      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const supportedMimeType = preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setInstagramAssistant((prev) => ({ ...prev, isRecording: false }));
        mediaRecorderRef.current = null;
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        toast.error("Voice recording failed");
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(mediaChunksRef.current, { type: mimeType });

        if (blob.size > 0) {
          const file = new File([blob], `instagram-voice-${Date.now()}.${extension}`, { type: mimeType });
          setInstagramAssistant((prev) => ({
            ...prev,
            voiceNote: file,
            isRecording: false,
          }));
          toast.success("Voice note captured. Click Generate Strategy to transcribe and apply.");
        } else {
          setInstagramAssistant((prev) => ({ ...prev, isRecording: false }));
          toast.error("No audio captured. Please try again.");
        }

        mediaChunksRef.current = [];
        mediaRecorderRef.current = null;
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setInstagramAssistant((prev) => ({ ...prev, isRecording: true }));
      toast.info("Recording started. Click Stop Recording when done.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to access microphone");
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleStopInstagramRecording = () => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      return;
    }

    setInstagramAssistant((prev) => ({ ...prev, isRecording: false }));
  };

  useEffect(() => {
    const status = searchParams.get("connect");
    const platform = (searchParams.get("platform") || "").toLowerCase();
    if (!status || !isSocialChannel(platform)) return;

    const accountIdFromQuery = (searchParams.get("account_id") || searchParams.get("accountId") || "").trim();

    const clearConnectParams = () => {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("connect");
      currentUrl.searchParams.delete("platform");
      currentUrl.searchParams.delete("account_id");
      currentUrl.searchParams.delete("accountId");
      currentUrl.searchParams.delete("error");
      window.history.replaceState({}, "", currentUrl.toString());
    };

    const channel = platform as SocialChannel;

    if (status === "failure") {
      setActiveSection(channel);
      setConnectDialogChannel(channel);
      toast.error(`${channelLabel(channel)} login failed. Please try connecting again.`);
      clearConnectParams();
      return;
    }

    if (status === "success") {
      setActiveSection(channel);

      if (!accountIdFromQuery) {
        setConnectDialogChannel(channel);
        toast.success(`${channelLabel(channel)} connected. Save your account ID to finish setup.`);
        clearConnectParams();
        return;
      }

      updateChannelState(channel, { accountId: accountIdFromQuery });

      void (async () => {
        try {
          const response = await fetch("/api/social-connections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel,
              accountId: accountIdFromQuery,
              onboardingCompleted: true,
            }),
          });
          const payload = await response.json();

          if (!response.ok) {
            throw new Error(readValue(payload?.error, "Failed to save connected account"));
          }

          setSocialOnboardingCompleted(true);
          toast.success(`${channelLabel(channel)} connected successfully`);
          await fetchChannelData(channel);
          await fetchDashboardOverview();
          await fetchDashboardInsights();
        } catch (error) {
          setConnectDialogChannel(channel);
          toast.error(error instanceof Error ? error.message : "Connected, but failed to save account details");
        } finally {
          clearConnectParams();
        }
      })();
    }
  }, [searchParams]);

  const handleOpenConnectDialog = (channel: SocialChannel) => {
    setConnectDialogChannel(channel);
  };

  const handleCloseConnectDialog = () => {
    setConnectDialogChannel(null);
  };

  const handleOpenProviderLogin = async (channel: SocialChannel) => {
    try {
      setIsConnectUrlLoading(true);
      const response = await fetch(
        `/api/unipile/connect-url?platform=${encodeURIComponent(channel)}&ts=${Date.now()}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok || !data?.connectUrl) {
        throw new Error(readValue(data?.error, "Unable to generate connect URL"));
      }

      window.open(String(data.connectUrl), "_blank", "noopener,noreferrer");
      toast.info("Opened a fresh authentication window. If verification fails, close it and click Open Provider Login again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open login page");
    } finally {
      setIsConnectUrlLoading(false);
    }
  };

  const handleConnectJira = async () => {
    if (!agentId) {
      toast.error("Gmail agent is still initializing. Retry in a moment.");
      return;
    }

    try {
      const response = await fetch("/api/standalone-agents/gmail-classifier/connect-jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.authUrl) {
        throw new Error(readValue(payload?.error, "Failed to start Jira connection"));
      }

      window.open(String(payload.authUrl), "_blank", "noopener,noreferrer");
      toast.info("Opened Jira auth in a new tab. Finish OAuth, then return and refresh Projects.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Jira");
    }
  };

  const handleSaveChannelConnection = async () => {
    if (!connectDialogChannel) return;

    const accountId = channelState[connectDialogChannel].accountId.trim();
    if (!accountId) {
      toast.error("Account ID is required");
      return;
    }

    try {
      const response = await fetch("/api/social-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: connectDialogChannel,
          accountId,
          onboardingCompleted: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(readValue(data?.error, "Failed to save social connection"));
      }

      setSocialOnboardingCompleted(true);
      toast.success(`${connectDialogChannel.toUpperCase()} account connected`);
      handleCloseConnectDialog();
      await fetchChannelData(connectDialogChannel);
      await fetchDashboardOverview();
      await fetchDashboardInsights();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save connection");
    }
  };

  const handleDisconnectChannel = async () => {
    if (!connectDialogChannel) return;
    try {
      const response = await fetch("/api/social-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: connectDialogChannel,
          accountId: "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(readValue(data?.error, "Failed to disconnect"));
      }

      updateChannelState(connectDialogChannel, { accountId: "" });
      setChannelData((prev) => ({
        ...prev,
        [connectDialogChannel]: defaultChannelData(),
      }));
      toast.success("Disconnected successfully");
      handleCloseConnectDialog();
      await fetchDashboardOverview();
      await fetchDashboardInsights();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Disconnect failed");
    }
  };

  const handlePublish = async (channel: SocialChannel) => {
    const current = channelState[channel];

    if (!current.postText.trim()) {
      toast.error("Write content before publishing");
      return;
    }

    if (channel === "twitter" && current.postText.trim().length > 280) {
      toast.error("Tweet exceeds 280 characters");
      return;
    }

    if (channel === "instagram" && !current.mediaUrl.trim() && current.mediaFiles.length === 0) {
      toast.error("Instagram requires at least one image URL or uploaded image");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("platform", channel);
      formData.append("accountId", current.accountId || "");
      formData.append("text", current.postText);
      formData.append("mode", current.postMode);
      if (current.mediaUrl.trim()) {
        formData.append("mediaUrl", current.mediaUrl.trim());
      }
      current.mediaFiles.forEach((file) => {
        formData.append("attachments", file, file.name);
      });

      const unipilePost = await fetch("/api/unipile/post", {
        method: "POST",
        body: formData,
      });

      const unipilePayload = await unipilePost.json();
      if (!unipilePost.ok) {
        throw new Error(readValue(unipilePayload?.error, "Unipile publish failed"));
      }

      toast.success(`${channel.toUpperCase()} post published`);
      updateChannelState(channel, { postText: "", mediaUrl: "", mediaFiles: [] });
      await fetchChannelData(channel);
      await fetchDashboardOverview();
      await fetchDashboardInsights();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed");
    }
  };

  const handleSendMessage = async (channel: SocialChannel) => {
    const current = channelState[channel];

    if (!current.messageRecipient.trim() || !current.messageText.trim()) {
      toast.error("Recipient and message are required");
      return;
    }

    let resolvedRecipient = current.messageRecipient.trim();
    const chatTargets = extractChatTargets(
      filterInboxByChannel(channelData[channel].inbox, channel, current.accountId),
    );

    if (!chatTargets.some((target) => target.chatId === resolvedRecipient)) {
      const normalizedInput = normalizeLookup(resolvedRecipient);
      if (normalizedInput) {
        const exactMatch = chatTargets.find((target) => normalizeLookup(target.label) === normalizedInput);
        const partialMatch = chatTargets.find((target) => {
          const normalizedLabel = normalizeLookup(target.label);
          return normalizedLabel.includes(normalizedInput) || normalizedInput.includes(normalizedLabel);
        });

        if (exactMatch) {
          resolvedRecipient = exactMatch.chatId;
        } else if (partialMatch && normalizedInput.length >= 4) {
          resolvedRecipient = partialMatch.chatId;
        } else if (chatTargets.length === 1 && normalizedInput.length >= 4) {
          // If only one inbox chat exists, use it as fallback for handle-like inputs.
          resolvedRecipient = chatTargets[0].chatId;
        }
      }
    }

    try {
      const response = await fetch("/api/unipile/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: channel,
          accountId: current.accountId || undefined,
          recipient: resolvedRecipient,
          text: current.messageText,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readValue(payload?.error, "Message send failed"));
      }

      toast.success("Message sent");
      updateChannelState(channel, { messageRecipient: resolvedRecipient, messageText: "" });
      await fetchChannelData(channel);
      await fetchDashboardOverview();
      await fetchDashboardInsights();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  const copy = useMemo(() => SECTION_COPY[activeSection], [activeSection]);

  const renderMainContent = () => {
    if (activeSection === "email") {
      if (isAgentLoading) {
        return (
          <Card className="border-slate-200 bg-white">
            <CardContent className="flex h-120 items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Initializing Gmail classifier...
            </CardContent>
          </Card>
        );
      }

      if (!agentId) {
        return (
          <Card className="border-slate-200 bg-white">
            <CardContent className="space-y-3 p-6">
              <p className="text-sm text-slate-600">Gmail classifier is not ready yet. Please try again.</p>
              <Button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-black text-white hover:bg-slate-900"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        );
      }

      return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <EmailClassifierEditor agentId={agentId} />
        </div>
      );
    }

    if (activeChannel) {
      return (
        <SocialChannelView
          channel={activeChannel}
          state={channelState[activeChannel]}
          data={channelData[activeChannel]}
          onChange={(patch) => updateChannelState(activeChannel, patch)}
          onAddMediaFiles={(files) => handleAddMediaFiles(activeChannel, files)}
          onRemoveMediaFile={(index) => handleRemoveMediaFile(activeChannel, index)}
          onRefresh={() => void fetchChannelData(activeChannel)}
          onOpenConnect={() => handleOpenConnectDialog(activeChannel)}
          onPublish={() => void handlePublish(activeChannel)}
          onSendMessage={() => void handleSendMessage(activeChannel)}
          onAddRecipient={() => void handleAddRecipient(activeChannel)}
          onSelectRecipient={(recipient) => handleSelectRecipient(activeChannel, recipient)}
          onRemoveRecipient={(recipient) => void handleRemoveRecipient(activeChannel, recipient)}
          isConnected={Boolean(channelState[activeChannel].accountId.trim())}
          showOnboardingHint={!isConnectionsLoading && !socialOnboardingCompleted}
          instagramAssistant={activeChannel === "instagram" ? instagramAssistant : null}
          onInstagramPromptChange={(value) => setInstagramAssistant((prev) => ({ ...prev, prompt: value }))}
          onInstagramVoiceNoteChange={(file) =>
            setInstagramAssistant((prev) => ({ ...prev, voiceNote: file, transcript: "", strategy: "" }))
          }
          onStartInstagramRecording={() => void handleStartInstagramRecording()}
          onStopInstagramRecording={handleStopInstagramRecording}
          onGenerateInstagramStrategy={() => void handleGenerateInstagramStrategy()}
        />
      );
    }

    if (activeSection === "twitter") return <TwitterHoldingView />;

    if (activeSection === "workspace") return <WorkspaceView overview={dashboardOverview} onJump={setActiveSection} />;
    if (activeSection === "chat") return <ChatView overview={dashboardOverview} onJump={setActiveSection} />;
    if (activeSection === "docs") return <DocsView />;
    if (activeSection === "projects") {
      return (
        <ProjectsView
          overview={dashboardOverview}
          jiraProjects={jiraProjects}
          jiraLoading={isJiraProjectsLoading}
          onConnectJira={() => void handleConnectJira()}
          onRefreshJiraProjects={() => void fetchJiraProjects()}
        />
      );
    }
    if (activeSection === "insights") {
      return (
        <InsightsView
          insights={dashboardInsights}
          loading={isInsightsLoading}
          error={insightsError}
          onRefresh={() => void fetchDashboardInsights()}
        />
      );
    }
    if (activeSection === "network") return <NetworkView overview={dashboardOverview} onJump={setActiveSection} />;
    if (activeSection === "updates") return <UpdatesView overview={dashboardOverview} />;

    return <GenericView title="Section" description="No renderer configured for this section." />;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-slate-200 bg-slate-100 p-3">
          <div className="rounded-xl bg-white px-3 py-3 shadow-sm">
            <p className="text-2xl font-semibold tracking-tight">ZYNCO</p>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Unified Intelligence</p>
          </div>

          <nav className="mt-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeSection;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Active Nodes</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Classifier</span>
                <Badge variant="secondary" className={cn(dashboardOverview?.connections.gmail ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                  {dashboardOverview?.connections.gmail ? "Live" : "Pending"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Social Sync</span>
                <span className="text-slate-500">
                  {(Number(Boolean(dashboardOverview?.connections.instagram)) + Number(Boolean(dashboardOverview?.connections.linkedin))) || 0} connected
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Jira</span>
                <span className={cn(dashboardOverview?.connections.jira ? "text-emerald-600" : "text-amber-600")}>
                  {dashboardOverview?.connections.jira ? "Connected" : "Not connected"}
                </span>
              </div>
            </div>
          </div>

          <Button className="mt-6 w-full rounded-xl bg-black text-white hover:bg-slate-900">
            <Sparkles className="mr-2 h-4 w-4" />
            Zynco AI
          </Button>

          <div className="mt-4 space-y-2">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200">
              <HelpCircle className="h-4 w-4" />
              Help
            </button>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200">
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <ShellHeader activeSection={activeSection} onCreate={() => toast.info("UI mode: workflow wiring in progress")} />

          <main className="space-y-4 p-4 lg:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
                <p className="text-sm text-slate-500">{copy.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <TrendingUp className="h-4 w-4" />
                {isOverviewLoading ? "Refreshing overview..." : overviewError ? "Overview unavailable" : "Live unified overview"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>

            {renderMainContent()}
          </main>
        </div>
      </div>

      <ZyncoChatbot />

      <Dialog open={Boolean(connectDialogChannel)} onOpenChange={(isOpen) => !isOpen && handleCloseConnectDialog()}>
        <DialogContent className="max-w-xl border-slate-200">
          <DialogHeader>
            <DialogTitle>
              {connectDialogChannel ? `Connect ${connectDialogChannel.charAt(0).toUpperCase()}${connectDialogChannel.slice(1)}` : "Connect Channel"}
            </DialogTitle>
            <DialogDescription>
              Authenticate through the provider login, then paste your Unipile account ID to complete connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Step 1: Click provider login. Step 2: Sign in and complete verification. Step 3: Paste the resulting account ID below.
              If verification fails, close that window and click provider login again to regenerate a fresh auth session.
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-300"
              onClick={() => connectDialogChannel && void handleOpenProviderLogin(connectDialogChannel)}
              disabled={!connectDialogChannel || isConnectUrlLoading}
            >
              {isConnectUrlLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Open Provider Login
            </Button>

            <div className="space-y-2">
              <Label htmlFor="social-account-id">Unipile Account ID</Label>
              <Input
                id="social-account-id"
                value={connectDialogChannel ? channelState[connectDialogChannel].accountId : ""}
                onChange={(event) => {
                  if (!connectDialogChannel) return;
                  updateChannelState(connectDialogChannel, { accountId: event.target.value });
                }}
                placeholder="Paste account ID from Unipile"
              />
            </div>
          </div>

          <DialogFooter>
            {connectDialogChannel && channelState[connectDialogChannel].accountId.trim() && (
              <Button type="button" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void handleDisconnectChannel()}>
                Disconnect
              </Button>
            )}
            <Button type="button" variant="outline" className="border-slate-300" onClick={handleCloseConnectDialog}>
              Cancel
            </Button>
            <Button type="button" className="bg-black text-white hover:bg-slate-900" onClick={() => void handleSaveChannelConnection()}>
              Save Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
