"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
    ArrowUpRight,
    Bell,
    ClipboardList,
    Eye,
    ExternalLink,
    FolderKanban,
    Hash,
    HelpCircle,
    Image as ImageIcon,
    Instagram,
    LayoutDashboard,
    Lightbulb,
    Linkedin,
    Loader2,
    LogOut,
    Mail,
    MessageCircle,
    Heart,
    Mic,
    MoreHorizontal,
    Repeat2,
    RefreshCw,
    Search,
    SendHorizontal,
    Settings,
    Sparkles,
    TrendingUp,
    Twitter,
    Trash2,
    Upload,
    Users,
    X,
} from "lucide-react";
import { toast } from "sonner";
import EmailClassifierEditor from "@/features/standalone-agents/agents/gmail-classifier/editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { TwitterLiveSnapshot } from "@/lib/twitter/live-snapshot";
import ChatWorkspace from "./ChatWorkspace";
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
    | "uploads"
    | "projects"
    | "insights";

type ChatAssistantSource = "instagram" | "linkedin" | "email" | "whatsapp" | "automation" | "twitter";

interface ChannelState {
    accountId: string;
    postText: string;
    threadDraft: string[];
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
    meta: Record<string, unknown> | null;
    loading: boolean;
    error: string | null;
}

interface SocialConnectionsResponse {
    connections: Record<SocialChannel, string>;
    recipients: Record<SocialChannel, string[]>;
    connectionMeta?: Record<SocialChannel, {
        accountId: string | null;
        username: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        externalUserId: string | null;
        connectedAt: string | null;
        status: string;
    }>;
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
    connectionMeta?: Record<SocialChannel, {
        accountId: string | null;
        username: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        externalUserId: string | null;
        connectedAt: string | null;
        status: string;
    }>;
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

interface DashboardHeaderPreferences {
    notifications: {
        lastReadAt: string | null;
        showOnlyUnread: boolean;
        muteSound: boolean;
    };
    workspace: {
        compactMode: boolean;
        defaultSection: SectionId;
    };
}

const DEFAULT_DASHBOARD_HEADER_PREFERENCES: DashboardHeaderPreferences = {
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

const DASHBOARD_SECTION_OPTIONS: Array<{ value: SectionId; label: string }> = [
    { value: "workspace", label: "Workspace" },
    { value: "email", label: "Email" },
    { value: "instagram", label: "Instagram" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "twitter", label: "Twitter/X" },
    { value: "network", label: "Network" },
    { value: "updates", label: "Updates" },
    { value: "chat", label: "Chat" },
    { value: "uploads", label: "Uploads" },
    { value: "projects", label: "Projects" },
    { value: "insights", label: "Insights" },
];

function isSectionId(value: string): value is SectionId {
    return DASHBOARD_SECTION_OPTIONS.some((item) => item.value === value);
}

function normalizeDashboardHeaderPreferences(raw: unknown): DashboardHeaderPreferences {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

    const notifications =
        source.notifications && typeof source.notifications === "object"
            ? (source.notifications as Record<string, unknown>)
            : {};

    const workspace =
        source.workspace && typeof source.workspace === "object"
            ? (source.workspace as Record<string, unknown>)
            : {};

    const lastReadAt =
        typeof notifications.lastReadAt === "string" && !Number.isNaN(new Date(notifications.lastReadAt).getTime())
            ? notifications.lastReadAt
            : null;

    const defaultSection =
        typeof workspace.defaultSection === "string" && isSectionId(workspace.defaultSection)
            ? workspace.defaultSection
            : DEFAULT_DASHBOARD_HEADER_PREFERENCES.workspace.defaultSection;

    return {
        notifications: {
            lastReadAt,
            showOnlyUnread:
                typeof notifications.showOnlyUnread === "boolean"
                    ? notifications.showOnlyUnread
                    : DEFAULT_DASHBOARD_HEADER_PREFERENCES.notifications.showOnlyUnread,
            muteSound:
                typeof notifications.muteSound === "boolean"
                    ? notifications.muteSound
                    : DEFAULT_DASHBOARD_HEADER_PREFERENCES.notifications.muteSound,
        },
        workspace: {
            compactMode:
                typeof workspace.compactMode === "boolean"
                    ? workspace.compactMode
                    : DEFAULT_DASHBOARD_HEADER_PREFERENCES.workspace.compactMode,
            defaultSection,
        },
    };
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

interface UploadAsset {
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    createdAt: string;
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
    { id: "uploads", label: "Uploads", icon: Upload },
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
        subtitle: "Connect your X account and manage publishing from one panel",
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
    uploads: {
        title: "Uploads",
        subtitle: "Store image assets and reuse them for social posts and email sharing",
        search: "Search uploads...",
    },
    projects: {
        title: "Projects",
        subtitle: "Task orchestration and sprint execution",
        search: "Search tasks, uploads, or people...",
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
        threadDraft: [],
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
        meta: null,
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

function formatCompactCount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "0";
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

interface TwitterTimelineItem {
    id: string;
    text: string;
    timestamp: string;
    url: string | null;
    status: string;
    authorName: string;
    authorHandle: string;
    authorAvatarUrl?: string | null;
    mediaUrls?: string[];
    replyCount: number;
    retweetCount: number;
    likeCount: number;
    quoteCount: number;
    viewCount: number;
    lang: string;
    isMock?: boolean;
}

function isoHoursAgo(hoursAgo: number) {
    return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function buildTwitterPreviewTimeline(displayName: string, username: string, fallbackAccountId: string): TwitterTimelineItem[] {
    const authorHandle = (username || fallbackAccountId.replace(/^@+/, "") || "zyncohq").trim();
    const authorName = displayName.trim() || "Zynco";
    const baseUrl = `https://x.com/${authorHandle}`;

    const seeds = [
        {
            id: "1938401024439203840",
            text: "Shipping a cleaner social ops dashboard this week: faster monitoring, clearer engagement cues, and less noisy UI.",
            hoursAgo: 2,
            likes: 192,
            retweets: 38,
            replies: 17,
            quotes: 6,
            views: 11300,
        },
        {
            id: "1938389405532109824",
            text: "New automation runbook: detect high-intent replies, assign owners, and trigger follow-up drafts in under 90 seconds.",
            hoursAgo: 5,
            likes: 146,
            retweets: 29,
            replies: 12,
            quotes: 4,
            views: 8600,
        },
        {
            id: "1938367719321942016",
            text: "What teams ask most: 1) Which posts convert? 2) Who needs response now? 3) What should we publish next?",
            hoursAgo: 9,
            likes: 208,
            retweets: 44,
            replies: 21,
            quotes: 8,
            views: 15200,
        },
        {
            id: "1938311021142026240",
            text: "Experiment result: concise posts with one strong visual lifted profile visits by 27% across our test set.",
            hoursAgo: 18,
            likes: 119,
            retweets: 22,
            replies: 9,
            quotes: 3,
            views: 6900,
        },
        {
            id: "1938220014819028992",
            text: "Building in public: we are simplifying every panel to surface only decisions, not noise.",
            hoursAgo: 30,
            likes: 264,
            retweets: 61,
            replies: 33,
            quotes: 12,
            views: 19800,
        },
    ];

    return seeds.map((seed) => ({
        id: seed.id,
        text: seed.text,
        timestamp: isoHoursAgo(seed.hoursAgo),
        url: `${baseUrl}/status/${seed.id}`,
        status: "PUBLISHED",
        authorName,
        authorHandle,
        replyCount: seed.replies,
        retweetCount: seed.retweets,
        likeCount: seed.likes,
        quoteCount: seed.quotes,
        viewCount: seed.views,
        lang: "en",
        isMock: true,
    }));
}

function buildTwitterFollowingMockTimeline(): TwitterTimelineItem[] {
    const seeds = [
        {
            id: "mock-following-001",
            authorName: "Design Ledger",
            authorHandle: "designledger",
            authorAvatarUrl: "https://i.pravatar.cc/80?img=12",
            text: "We tested 12 hook styles on carousel posts this week. Visual hierarchy beat copy-heavy cards by 2.3x saves.",
            hoursAgo: 1,
            likes: 431,
            retweets: 88,
            replies: 39,
            quotes: 14,
            views: 25400,
            mediaUrls: ["https://picsum.photos/id/1015/920/560"],
        },
        {
            id: "mock-following-002",
            authorName: "Ops Atlas",
            authorHandle: "opsatlas",
            authorAvatarUrl: "https://i.pravatar.cc/80?img=22",
            text: "New dashboard benchmark: teams reduced response backlog by 36% after introducing a priority triage lane.",
            hoursAgo: 3,
            likes: 289,
            retweets: 54,
            replies: 18,
            quotes: 7,
            views: 17300,
            mediaUrls: ["https://picsum.photos/id/1033/920/560"],
        },
        {
            id: "mock-following-003",
            authorName: "Growth Weekly",
            authorHandle: "growthweekly",
            authorAvatarUrl: "https://i.pravatar.cc/80?img=32",
            text: "If you only track one thing this quarter, track post-to-conversation ratio, not raw impressions.",
            hoursAgo: 6,
            likes: 512,
            retweets: 101,
            replies: 27,
            quotes: 11,
            views: 31100,
            mediaUrls: ["https://picsum.photos/id/1048/920/560"],
        },
        {
            id: "mock-following-004",
            authorName: "Product Notes",
            authorHandle: "productnotes",
            authorAvatarUrl: "https://i.pravatar.cc/80?img=45",
            text: "Shipping notes: compact action cards + one-click contextual replies are now default in our internal build.",
            hoursAgo: 9,
            likes: 203,
            retweets: 41,
            replies: 13,
            quotes: 4,
            views: 12600,
            mediaUrls: ["https://picsum.photos/id/1057/920/560"],
        },
        {
            id: "mock-following-005",
            authorName: "Campaign Lab",
            authorHandle: "campaignlab",
            authorAvatarUrl: "https://i.pravatar.cc/80?img=56",
            text: "A/B test result: adding outcome-oriented first line improved profile visits by 21% over control.",
            hoursAgo: 14,
            likes: 347,
            retweets: 67,
            replies: 22,
            quotes: 8,
            views: 19800,
            mediaUrls: ["https://picsum.photos/id/1062/920/560"],
        },
        {
            id: "mock-following-006",
            authorName: "CX Signals",
            authorHandle: "cxsignals",
            authorAvatarUrl: "https://i.pravatar.cc/80?img=64",
            text: "Most useful social workflow we saw this month: classify intent, assign owner, and reply with templates in one pass.",
            hoursAgo: 21,
            likes: 278,
            retweets: 49,
            replies: 15,
            quotes: 5,
            views: 14900,
            mediaUrls: ["https://picsum.photos/id/1070/920/560"],
        },
    ];

    return seeds.map((seed) => ({
        id: seed.id,
        text: seed.text,
        timestamp: isoHoursAgo(seed.hoursAgo),
        url: `https://x.com/${seed.authorHandle}/status/${seed.id}`,
        status: "PUBLISHED",
        authorName: seed.authorName,
        authorHandle: seed.authorHandle,
        authorAvatarUrl: seed.authorAvatarUrl,
        mediaUrls: seed.mediaUrls,
        replyCount: seed.replies,
        retweetCount: seed.retweets,
        likeCount: seed.likes,
        quoteCount: seed.quotes,
        viewCount: seed.views,
        lang: "en",
        isMock: true,
    }));
}

function buildTwitterPreviewSnapshot(username: string, displayName: string, recentTweets: TwitterTimelineItem[]): TwitterLiveSnapshot {
    const resolvedUsername = username.replace(/^@+/, "").trim() || "zyncohq";
    const resolvedName = displayName.trim() || "Zynco";

    const autocompleteUsers: TwitterLiveSnapshot["signals"]["autocompleteUsers"] = [
        { name: "Growth Signal", handle: "@growthsignal", bio: "B2B growth playbooks and campaign teardown threads." },
        { name: "CX Operators", handle: "@cxoperators", bio: "Customer experience systems, retention, and lifecycle analytics." },
        { name: "Pipeline Weekly", handle: "@pipelineweekly", bio: "Revenue operations notes for founders and GTM teams." },
        { name: "Product Loops", handle: "@productloops", bio: "Product-led growth experiments and activation tactics." },
    ];

    const trends: TwitterLiveSnapshot["signals"]["trends"] = [
        { name: "#AIWorkflows", volume: 18400, volumeLabel: "18.4K posts" },
        { name: "#CustomerExperience", volume: 12900, volumeLabel: "12.9K posts" },
        { name: "#B2BMarketing", volume: 9100, volumeLabel: "9.1K posts" },
        { name: "#RevenueOps", volume: 8400, volumeLabel: "8.4K posts" },
        { name: "#FounderJourney", volume: 7600, volumeLabel: "7.6K posts" },
        { name: "#ProductAnalytics", volume: 6300, volumeLabel: "6.3K posts" },
    ];

    return {
        fetchedAt: new Date().toISOString(),
        username: resolvedUsername,
        profile: {
            name: resolvedName,
            handle: `@${resolvedUsername}`,
            avatarUrl: "",
            bio: "Unified social intelligence and execution workflows for modern teams.",
            followersCount: 12840,
            followingCount: 612,
            tweetsCount: 487,
            source: "unknown",
        },
        recentTweets: recentTweets.slice(0, 5).map((tweet) => ({
            id: tweet.id,
            text: tweet.text,
            timestamp: tweet.timestamp,
            likeCount: tweet.likeCount,
            retweetCount: tweet.retweetCount,
            replyCount: tweet.replyCount,
        })),
        signals: {
            autocompleteUsers,
            trends,
            about: {
                name: resolvedName,
                handle: `@${resolvedUsername}`,
                bio: "Unified social intelligence and execution workflows for modern teams.",
                location: "Remote",
                followersCount: 12840,
                followingCount: 612,
                tweetsCount: 487,
            },
        },
        checks: [
            { label: "Autocomplete Users", ok: true, status: 200, note: "Preview dataset loaded." },
            { label: "Trends by Location", ok: true, status: 200, note: "Preview dataset loaded." },
            { label: "Recent Tweets", ok: true, status: 200, note: "Preview dataset loaded." },
            { label: "About Account", ok: true, status: 200, note: "Preview dataset loaded." },
        ],
    };
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

function readStringPath(item: Record<string, unknown>, path: string) {
    const segments = path.split(".");
    let cursor: unknown = item;

    for (const segment of segments) {
        if (Array.isArray(cursor)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0 || index >= cursor.length) return "";
            cursor = cursor[index];
            continue;
        }

        if (!cursor || typeof cursor !== "object") return "";
        cursor = (cursor as Record<string, unknown>)[segment];
    }

    return typeof cursor === "string" && cursor.trim() ? cursor.trim() : "";
}

function pickStringPath(item: Record<string, unknown>, paths: string[]) {
    for (const path of paths) {
        const value = readStringPath(item, path);
        if (value) return value;
    }
    return "";
}

function pickStringPathFromSources(sources: Array<Record<string, unknown>>, paths: string[]) {
    for (const source of sources) {
        const value = pickStringPath(source, paths);
        if (value) return value;
    }
    return "";
}

interface ChatTarget {
    chatId: string;
    label: string;
}

interface TwitterChatMessage {
    id: string;
    text: string;
    timestamp: string;
    direction: "inbound" | "outbound";
    senderName: string;
    senderHandle: string;
    isMock?: boolean;
}

interface TwitterChatThread {
    id: string;
    title: string;
    handle: string;
    avatarInitials: string;
    unreadCount: number;
    lastMessageAt: string;
    source: "live" | "mock";
    messages: TwitterChatMessage[];
}

interface TwitterNotificationItem {
    id: string;
    title: string;
    description: string;
    timestamp: string;
    status: "success" | "failed" | "pending";
    direction: "INBOUND" | "OUTBOUND";
    contactName: string | null;
    tweetId: string | null;
    url: string | null;
    unread: boolean;
}

interface TwitterNotificationsResponse {
    success: boolean;
    items: TwitterNotificationItem[];
    summary: {
        totalCount: number;
        unreadCount: number;
        inboundCount: number;
        outboundCount: number;
        lastReadAt: string | null;
    };
}

interface TwitterListItem {
    id: string;
    name: string;
    description: string;
    source: "official" | "smart";
    url: string | null;
    memberCount: number;
    subscriberCount: number;
    tweetCount: number;
    updatedAt: string | null;
    samples: string[];
    previewTweetIds: string[];
}

interface TwitterListsResponse {
    success: boolean;
    lists: TwitterListItem[];
    meta?: {
        mode?: "official" | "rapidapi" | "auto";
        officialAvailable?: boolean;
        warning?: string | null;
    };
}

interface TodayNewsItem {
    id: string;
    title: string;
    url: string;
    source: string;
    author: string;
    publishedAt: string;
    score: number;
    comments: number;
}

interface TodayNewsResponse {
    success: boolean;
    items: TodayNewsItem[];
    meta?: {
        source?: string;
        fetchedAt?: string;
        totalConsidered?: number;
    };
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

function toInitials(value: string) {
    const tokens = value
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((token) => token.charAt(0).toUpperCase())
        .join("");
    return tokens || "U";
}

function parseTimestamp(value: unknown) {
    if (typeof value !== "string" || !value.trim()) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
}

function buildTwitterChatThreadsFromInbox(inbox: unknown[]): TwitterChatThread[] {
    const groups = new Map<string, TwitterChatThread>();

    inbox.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const record = item as Record<string, unknown>;

        const threadId = pickStringPath(record, ["chat_id", "conversation_id", "thread_id", "id"]) || `thread-${index + 1}`;
        const titleCandidate = pickStringPath(record, [
            "name",
            "title",
            "subject",
            "from",
            "sender",
            "username",
            "screen_name",
            "from.name",
            "sender.name",
            "attendee.full_name",
            "attendee.name",
            "participants.0.full_name",
            "participants.0.name",
            "attendee_provider_id",
            "provider_id",
        ]);

        const handleRaw = pickStringPath(record, [
            "screen_name",
            "username",
            "provider_id",
            "attendee_provider_id",
            "from.username",
            "sender.username",
            "attendee.public_identifier",
            "attendee.username",
            "participants.0.public_identifier",
            "participants.0.username",
        ]).replace(/^@+/, "").trim();

        const fallbackHandleSeed = normalizeLookup(titleCandidate);
        const handle = handleRaw
            ? `@${handleRaw}`
            : fallbackHandleSeed
                ? `@${fallbackHandleSeed}`
                : "@contact";

        const threadTitle = titleCandidate || handle.replace(/^@/, "") || `Conversation ${index + 1}`;
        const explicitUnreadValue = Number(record.unread_count ?? record.unread ?? record.unseen_count);
        const explicitUnreadCount = Number.isFinite(explicitUnreadValue) && explicitUnreadValue > 0
            ? Math.trunc(explicitUnreadValue)
            : 0;

        if (!groups.has(threadId)) {
            groups.set(threadId, {
                id: threadId,
                title: threadTitle,
                handle,
                avatarInitials: toInitials(threadTitle),
                unreadCount: explicitUnreadCount,
                lastMessageAt: new Date().toISOString(),
                source: "live",
                messages: [],
            });
        }

        const thread = groups.get(threadId)!;
        const messagesCandidate = Array.isArray(record.messages)
            ? record.messages.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
            : [];
        const sourceRecords = messagesCandidate.length > 0 ? messagesCandidate : [record];

        sourceRecords.forEach((messageRecord, messageIndex) => {
            const sources = [messageRecord, record];
            const text = pickStringPathFromSources(sources, [
                "text",
                "snippet",
                "content",
                "body",
                "message",
                "preview",
                "last_message.text",
                "last_message.body",
                "last_message.content",
                "last_message.message",
            ]) || "New conversation started";

            const timestamp =
                parseTimestamp(pickStringPathFromSources(sources, [
                    "timestamp",
                    "created_at",
                    "updated_at",
                    "date",
                    "last_message.timestamp",
                    "last_message.created_at",
                    "last_message.updated_at",
                    "last_message.date",
                ]))
                || new Date().toISOString();

            const directionRaw = pickStringPathFromSources(sources, [
                "direction",
                "message_direction",
                "type",
                "last_message.direction",
                "last_message.message_direction",
            ]).toLowerCase();
            const isSender = messageRecord.is_sender === true || record.is_sender === true;
            const direction: "inbound" | "outbound" =
                directionRaw.includes("out") || directionRaw.includes("sent") || isSender
                    ? "outbound"
                    : "inbound";

            const senderName =
                direction === "outbound"
                    ? "You"
                    : pickStringPathFromSources(sources, [
                        "from",
                        "sender",
                        "name",
                        "title",
                        "subject",
                        "username",
                        "screen_name",
                        "from.name",
                        "sender.name",
                        "last_message.sender_name",
                    ]) || threadTitle;

            const messageId = pickStringPathFromSources(sources, ["message_id", "last_message.id", "id"])
                || `${threadId}-${index + 1}-${messageIndex + 1}`;
            const messageFingerprint = `${direction}|${timestamp}|${text}`;
            const exists = thread.messages.some((message) => `${message.direction}|${message.timestamp}|${message.text}` === messageFingerprint);
            if (!exists) {
                thread.messages.push({
                    id: messageId,
                    text,
                    timestamp,
                    direction,
                    senderName,
                    senderHandle: direction === "outbound" ? "@you" : handle,
                });
            }

            const inboundRead =
                messageRecord.read === true
                || messageRecord.is_read === true
                || record.read === true
                || record.is_read === true;

            if (direction === "inbound" && !inboundRead && explicitUnreadCount === 0) {
                thread.unreadCount += 1;
            }

            if (new Date(timestamp).getTime() > new Date(thread.lastMessageAt).getTime()) {
                thread.lastMessageAt = timestamp;
            }
        });

        if (explicitUnreadCount > thread.unreadCount) {
            thread.unreadCount = explicitUnreadCount;
        }
    });

    return Array.from(groups.values())
        .map((thread) => ({
            ...thread,
            messages: [...thread.messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
        }))
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

function minutesAgoIso(minutesAgo: number) {
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function buildTwitterMockChatThreads(displayName: string, username: string): TwitterChatThread[] {
    const ownerName = displayName.trim() || "You";
    const ownerHandle = `@${(username || "twitter").replace(/^@+/, "")}`;

    const threads: TwitterChatThread[] = [
        {
            id: "chat-growth-lab",
            title: "GrowthLab Media",
            handle: "@growthlabmedia",
            avatarInitials: "GL",
            unreadCount: 2,
            lastMessageAt: minutesAgoIso(18),
            source: "mock",
            messages: [
                {
                    id: "m1",
                    text: "Loved your thread on reducing response latency. Can we republish one chart with credit?",
                    timestamp: minutesAgoIso(42),
                    direction: "inbound",
                    senderName: "GrowthLab Media",
                    senderHandle: "@growthlabmedia",
                    isMock: true,
                },
                {
                    id: "m2",
                    text: "Yes, go ahead. Please tag the original post and keep the source note in the first reply.",
                    timestamp: minutesAgoIso(31),
                    direction: "outbound",
                    senderName: ownerName,
                    senderHandle: ownerHandle,
                    isMock: true,
                },
                {
                    id: "m3",
                    text: "Perfect. Also open to a short collab thread next week?",
                    timestamp: minutesAgoIso(18),
                    direction: "inbound",
                    senderName: "GrowthLab Media",
                    senderHandle: "@growthlabmedia",
                    isMock: true,
                },
            ],
        },
        {
            id: "chat-product-insider",
            title: "Product Insider",
            handle: "@productinsider",
            avatarInitials: "PI",
            unreadCount: 0,
            lastMessageAt: minutesAgoIso(95),
            source: "mock",
            messages: [
                {
                    id: "m4",
                    text: "Can you share the benchmark sample size from your engagement study?",
                    timestamp: minutesAgoIso(126),
                    direction: "inbound",
                    senderName: "Product Insider",
                    senderHandle: "@productinsider",
                    isMock: true,
                },
                {
                    id: "m5",
                    text: "We used 14 brand accounts across SaaS, fintech, and creator tools. I can send a cleaned breakdown.",
                    timestamp: minutesAgoIso(95),
                    direction: "outbound",
                    senderName: ownerName,
                    senderHandle: ownerHandle,
                    isMock: true,
                },
            ],
        },
        {
            id: "chat-sprint-founder",
            title: "Sprint Founder",
            handle: "@sprintfounder",
            avatarInitials: "SF",
            unreadCount: 1,
            lastMessageAt: minutesAgoIso(240),
            source: "mock",
            messages: [
                {
                    id: "m6",
                    text: "Your pinned post format is working great. Any chance you can share your weekly cadence template?",
                    timestamp: minutesAgoIso(252),
                    direction: "inbound",
                    senderName: "Sprint Founder",
                    senderHandle: "@sprintfounder",
                    isMock: true,
                },
                {
                    id: "m7",
                    text: "Absolutely. I will send a simple 5-day content + engagement cadence in an hour.",
                    timestamp: minutesAgoIso(240),
                    direction: "outbound",
                    senderName: ownerName,
                    senderHandle: ownerHandle,
                    isMock: true,
                },
            ],
        },
        {
            id: "chat-customer-voice",
            title: "Customer Voice Ops",
            handle: "@cxvoiceops",
            avatarInitials: "CV",
            unreadCount: 0,
            lastMessageAt: minutesAgoIso(520),
            source: "mock",
            messages: [
                {
                    id: "m8",
                    text: "We tested your suggested reply framework and reduced average first-response time by 21%.",
                    timestamp: minutesAgoIso(540),
                    direction: "inbound",
                    senderName: "Customer Voice Ops",
                    senderHandle: "@cxvoiceops",
                    isMock: true,
                },
                {
                    id: "m9",
                    text: "Great result. Keep a short qualifier in line one and save detailed context for follow-up.",
                    timestamp: minutesAgoIso(520),
                    direction: "outbound",
                    senderName: ownerName,
                    senderHandle: ownerHandle,
                    isMock: true,
                },
            ],
        },
    ];

    return threads;
}

function ShellHeader({
    unreadNotifications,
    onOpenNotifications,
    onOpenSettings,
    user,
    onLogout,
    onOpenProfile,
    onOpenConnections,
    isLoggingOut,
}: {
    unreadNotifications: number;
    onOpenNotifications: () => void;
    onOpenSettings: () => void;
    user: { id: string; name: string | null; email: string } | null;
    onLogout: () => void;
    onOpenProfile: () => void;
    onOpenConnections: () => void;
    isLoggingOut: boolean;
}) {
    const initials = (user?.name || user?.email || "U")
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "U";

    return (
        <div className="fixed right-4 top-3 z-40 flex items-center gap-2 lg:right-6 lg:top-4">
            <button
                type="button"
                className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                onClick={onOpenNotifications}
                title="Notifications"
                aria-label="Open notifications"
            >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                )}
            </button>
            <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                onClick={onOpenSettings}
                title="Social settings"
                aria-label="Open social settings"
            >
                <Settings className="h-4 w-4" />
            </button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label="Open profile menu"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white hover:bg-slate-100"
                    >
                        <Avatar className="h-8 w-8 border-0">
                            <AvatarFallback className="bg-slate-900 text-xs text-white">{initials}</AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 border-slate-200 bg-white">
                    <DropdownMenuLabel className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{user?.name || "Account"}</p>
                        <p className="text-xs font-normal text-slate-500">{user?.email || "No email"}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onOpenProfile}>
                        <Users className="h-4 w-4" />
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenConnections}>
                        <Settings className="h-4 w-4" />
                        Social Connections
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-red-600 focus:bg-red-50 focus:text-red-700"
                        onClick={onLogout}
                        disabled={isLoggingOut}
                    >
                        <LogOut className="h-4 w-4" />
                        {isLoggingOut ? "Signing out..." : "Logout"}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
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

    const rowToneByChannel: Record<string, string> = {
        email: "border-blue-100 bg-blue-50/45 text-blue-700",
        instagram: "border-rose-100 bg-rose-50/45 text-rose-700",
        linkedin: "border-sky-100 bg-sky-50/45 text-sky-700",
        twitter: "border-slate-200 bg-slate-100/80 text-slate-700",
        projects: "border-indigo-100 bg-indigo-50/45 text-indigo-700",
    };

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
                <Card className="border-blue-100 bg-blue-50/35">
                    <CardContent className="space-y-1 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Connected Channels</p>
                        <p className="text-3xl font-semibold text-slate-900">{connectedCount}/{totalChannels}</p>
                        <p className="text-xs text-slate-500">Social + email + Jira coverage</p>
                    </CardContent>
                </Card>
                <Card className="border-violet-100 bg-violet-50/35">
                    <CardContent className="space-y-1 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Activity Throughput</p>
                        <p className="text-3xl font-semibold text-slate-900">{totalUpdates}</p>
                        <p className="text-xs text-slate-500">recent unified updates</p>
                    </CardContent>
                </Card>
                <Card className="border-emerald-100 bg-emerald-50/35">
                    <CardContent className="space-y-1 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Outbound Ratio</p>
                        <p className="text-3xl font-semibold text-slate-900">{outboundRate}%</p>
                        <p className="text-xs text-slate-500">share of outbound operations</p>
                    </CardContent>
                </Card>
                <Card className="border-amber-100 bg-amber-50/45">
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
                                <div
                                    key={row.key}
                                    className={cn(
                                        "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3",
                                        row.connected ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50/80",
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("rounded-lg border p-2", rowToneByChannel[row.key] || "border-slate-200 bg-slate-100 text-slate-700")}>
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

                <Card className="border-amber-100 bg-amber-50/20">
                    <CardHeader>
                        <CardTitle className="text-base">Priority Queue</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {priorityQueue.length === 0 && (
                            <p className="rounded-lg border border-amber-100 bg-amber-50/30 p-3 text-sm text-slate-600">
                                No urgent failed or pending items right now.
                            </p>
                        )}
                        {priorityQueue.map((item) => (
                            <div key={item.id} className="rounded-lg border border-amber-100 bg-white p-3">
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
    onDisconnect,
    onPublish,
    onSendMessage,
    onAddRecipient,
    onSelectRecipient,
    onRemoveRecipient,
    isConnected,
    connectionMeta,
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
    onDisconnect: () => void;
    onPublish: () => void;
    onSendMessage: () => void;
    onAddRecipient: () => void;
    onSelectRecipient: (recipient: string) => void;
    onRemoveRecipient: (recipient: string) => void;
    isConnected: boolean;
    connectionMeta?: {
        accountId: string | null;
        username: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        externalUserId: string | null;
        connectedAt: string | null;
        status: string;
    };
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
    const twitterAudioInputId = `${channel}-audio-input`;
    const resolvedAccountId = (connectionMeta?.accountId || state.accountId || "").trim();
    const twitterUsername = (connectionMeta?.username || resolvedAccountId || "").replace(/^@+/, "").trim();
    const twitterDisplayName = (connectionMeta?.displayName || "").trim() || "Twitter User";
    const twitterProfileName = twitterDisplayName || twitterUsername || "Twitter User";

    const [twitterOpsTweetId, setTwitterOpsTweetId] = useState("");
    const [twitterReplyText, setTwitterReplyText] = useState("");
    const [twitterSurface, setTwitterSurface] = useState<"home" | "explore" | "messages" | "notifications" | "lists" | "profile">("home");
    const [twitterHomeTab, setTwitterHomeTab] = useState<"for-you" | "following">("for-you");
    const [twitterProfileTab, setTwitterProfileTab] = useState<"posts" | "replies" | "media" | "likes">("posts");
    const [twitterComposeActionLoading, setTwitterComposeActionLoading] = useState<null | "audio" | "polish" | "thread">(null);
    const [twitterAudioIsRecording, setTwitterAudioIsRecording] = useState(false);
    const [twitterAudioFileName, setTwitterAudioFileName] = useState("");
    const [twitterAudioTranscript, setTwitterAudioTranscript] = useState("");
    const [twitterChatQuery, setTwitterChatQuery] = useState("");
    const [twitterActiveChatId, setTwitterActiveChatId] = useState("");
    const [twitterActionLoading, setTwitterActionLoading] = useState<string | null>(null);
    const [twitterActionResult, setTwitterActionResult] = useState("");
    const [twitterProfileLoading, setTwitterProfileLoading] = useState(false);
    const [twitterProfileError, setTwitterProfileError] = useState<string | null>(null);
    const [twitterProfile, setTwitterProfile] = useState<Record<string, unknown> | null>(null);
    const [twitterCapabilities, setTwitterCapabilities] = useState<{
        connected?: boolean;
        tokenHealthy?: boolean;
        refreshAvailable?: boolean;
        rapidApi?: {
            readMode?: "official" | "rapidapi" | "auto";
            enabledEndpoints?: number;
            holdRateLimitEndpoints?: number;
            holdAuthEndpoints?: number;
        };
        auth?: {
            state?: "ready" | "reauth_required" | "disconnected";
            reason?: string;
            hasIdentity?: boolean;
            hasAccessToken?: boolean;
            hasRefreshToken?: boolean;
        };
        scopes?: {
            tweetRead?: boolean;
            tweetWrite?: boolean;
            usersRead?: boolean;
            offlineAccess?: boolean;
            raw?: string[];
        };
        operations?: {
            me?: boolean;
            createTweet?: boolean;
            readOwnTweets?: boolean;
            readTweetById?: boolean;
            deleteTweet?: boolean;
            likeUnlike?: boolean;
            retweetUnretweet?: boolean;
            reply?: boolean;
            silentRefresh?: boolean;
        };
    } | null>(null);
    const [twitterProfileProvider, setTwitterProfileProvider] = useState<{
        mode?: string;
        host?: string;
        route?: string;
    } | null>(null);
    const [rapidSignalsLoading, setRapidSignalsLoading] = useState(false);
    const [rapidSignalsError, setRapidSignalsError] = useState<string | null>(null);
    const [rapidSignalsData, setRapidSignalsData] = useState<TwitterLiveSnapshot | null>(null);
    const [rapidSignalsMeta, setRapidSignalsMeta] = useState<{ cached: boolean; stale: boolean; fallbackUsed: boolean } | null>(null);
    const [twitterNotificationsLoading, setTwitterNotificationsLoading] = useState(false);
    const [twitterNotificationsError, setTwitterNotificationsError] = useState<string | null>(null);
    const [twitterNotificationsData, setTwitterNotificationsData] = useState<TwitterNotificationsResponse | null>(null);
    const [twitterNotificationsMarkingRead, setTwitterNotificationsMarkingRead] = useState(false);
    const [twitterNotificationsPendingId, setTwitterNotificationsPendingId] = useState<string | null>(null);
    const [twitterListsLoading, setTwitterListsLoading] = useState(false);
    const [twitterListsError, setTwitterListsError] = useState<string | null>(null);
    const [twitterListsData, setTwitterListsData] = useState<TwitterListsResponse | null>(null);
    const [twitterFollowingLoading, setTwitterFollowingLoading] = useState(false);
    const [twitterFollowingError, setTwitterFollowingError] = useState<string | null>(null);
    const [twitterFollowingTimeline, setTwitterFollowingTimeline] = useState<TwitterTimelineItem[]>([]);
    const [twitterFollowingSource, setTwitterFollowingSource] = useState<string | null>(null);
    const [twitterFollowingAutoLoaded, setTwitterFollowingAutoLoaded] = useState(false);
    const [todayNewsLoading, setTodayNewsLoading] = useState(false);
    const [todayNewsError, setTodayNewsError] = useState<string | null>(null);
    const [todayNewsData, setTodayNewsData] = useState<TodayNewsResponse | null>(null);
    const rapidSignalsAutoKeyRef = useRef("");
    const rapidSignalsLastRequestAtRef = useRef(0);
    const twitterStatusLastRequestAtRef = useRef(0);
    const twitterFollowingLastRequestAtRef = useRef(0);
    const todayNewsLastRequestAtRef = useRef(0);
    const todayNewsSignatureRef = useRef("");
    const twitterAudioRecorderRef = useRef<MediaRecorder | null>(null);
    const twitterAudioStreamRef = useRef<MediaStream | null>(null);
    const twitterAudioChunksRef = useRef<Blob[]>([]);

    const liveTwitterUsername =
        (typeof twitterProfile?.username === "string" ? twitterProfile.username : "")
            .replace(/^@+/, "")
            .trim()
        || twitterUsername;

    const liveTwitterDisplayName =
        (typeof twitterProfile?.name === "string" ? twitterProfile.name : "")
            .trim()
        || twitterProfileName;

    const liveTwitterAvatarUrl =
        (typeof twitterProfile?.profile_image_url === "string" ? twitterProfile.profile_image_url : "")
            .trim()
        || (connectionMeta?.avatarUrl || "").trim();

    const twitterTimeline = useMemo<TwitterTimelineItem[]>(() => {
        const toCount = (input: unknown) => {
            const parsed = Number(input);
            if (!Number.isFinite(parsed) || parsed < 0) return 0;
            return Math.trunc(parsed);
        };

        const posts = Array.isArray(data.posts) ? data.posts : [];
        return posts.map((item, index) => {
            const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
            const rawId = [record.urn, record.tweetId, record.id].find((value) => typeof value === "string" && String(value).trim());
            const tweetId = rawId ? String(rawId).trim() : `tweet-${index + 1}`;
            const text =
                (typeof record.content === "string" && record.content.trim())
                || (typeof record.text === "string" && record.text.trim())
                || (typeof record.description === "string" && record.description.trim())
                || "No content";
            const timestamp =
                (typeof record.timestamp === "string" && record.timestamp)
                || (typeof record.created_at === "string" && record.created_at)
                || (typeof record.date === "string" && record.date)
                || "";

            const metrics = record.public_metrics && typeof record.public_metrics === "object"
                ? (record.public_metrics as Record<string, unknown>)
                : {};

            const replyCount = toCount(metrics.reply_count ?? record.reply_count);
            const retweetCount = toCount(metrics.retweet_count ?? record.retweet_count);
            const likeCount = toCount(metrics.like_count ?? record.like_count);
            const quoteCount = toCount(metrics.quote_count ?? record.quote_count);
            const viewCount = toCount(metrics.impression_count ?? record.impression_count ?? record.view_count);

            const url = typeof record.url === "string" && record.url.trim()
                ? record.url.trim()
                : resolvedAccountId
                    ? `https://x.com/${resolvedAccountId.replace(/^@+/, "")}/status/${tweetId}`
                    : null;

            return {
                id: tweetId,
                text,
                timestamp,
                url,
                status: typeof record.status === "string" ? record.status : "PUBLISHED",
                authorName: liveTwitterDisplayName,
                authorHandle: liveTwitterUsername || resolvedAccountId.replace(/^@+/, "") || "twitter",
                replyCount,
                retweetCount,
                likeCount,
                quoteCount,
                viewCount,
                lang: typeof record.lang === "string" ? record.lang : "",
                isMock: false,
            };
        });
    }, [data.posts, liveTwitterDisplayName, liveTwitterUsername, resolvedAccountId]);

    const twitterPreviewTimeline = useMemo(
        () => buildTwitterPreviewTimeline(liveTwitterDisplayName, liveTwitterUsername, resolvedAccountId),
        [liveTwitterDisplayName, liveTwitterUsername, resolvedAccountId],
    );
    const twitterFollowingMockTimeline = useMemo(() => buildTwitterFollowingMockTimeline(), []);

    const usingMockTimeline = twitterTimeline.length === 0;
    const effectiveTwitterTimeline = usingMockTimeline ? twitterPreviewTimeline : twitterTimeline;

    const twitterPreviewSignals = useMemo(
        () => buildTwitterPreviewSnapshot(liveTwitterUsername, liveTwitterDisplayName, twitterPreviewTimeline),
        [liveTwitterUsername, liveTwitterDisplayName, twitterPreviewTimeline],
    );

    const twitterLiveChatThreads = useMemo(
        () => buildTwitterChatThreadsFromInbox(scopedInbox),
        [scopedInbox],
    );

    const twitterMockChatThreads = useMemo(
        () => buildTwitterMockChatThreads(liveTwitterDisplayName, liveTwitterUsername || resolvedAccountId),
        [liveTwitterDisplayName, liveTwitterUsername, resolvedAccountId],
    );

    const [twitterMockChatThreadState, setTwitterMockChatThreadState] = useState<TwitterChatThread[]>([]);

    useEffect(() => {
        setTwitterMockChatThreadState(twitterMockChatThreads);
    }, [twitterMockChatThreads]);

    const usingMockChatThreads = twitterLiveChatThreads.length === 0;
    const twitterChatThreads = usingMockChatThreads ? twitterMockChatThreadState : twitterLiveChatThreads;

    const filteredTwitterChatThreads = useMemo(() => {
        const query = twitterChatQuery.trim().toLowerCase();
        if (!query) return twitterChatThreads;

        return twitterChatThreads.filter((thread) => {
            if (thread.title.toLowerCase().includes(query) || thread.handle.toLowerCase().includes(query)) {
                return true;
            }

            return thread.messages.some((message) => message.text.toLowerCase().includes(query));
        });
    }, [twitterChatThreads, twitterChatQuery]);

    const activeTwitterChatThread = useMemo(() => {
        if (filteredTwitterChatThreads.length === 0) return null;
        return filteredTwitterChatThreads.find((thread) => thread.id === twitterActiveChatId) || filteredTwitterChatThreads[0];
    }, [filteredTwitterChatThreads, twitterActiveChatId]);

    const twitterChatUnreadCount = useMemo(
        () => twitterChatThreads.reduce((sum, thread) => sum + thread.unreadCount, 0),
        [twitterChatThreads],
    );

    const twitterChatCount = twitterChatUnreadCount > 0 ? twitterChatUnreadCount : twitterChatThreads.length;

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

    const formatThreadPreviewText = useCallback((tweets: string[]) => {
        return tweets
            .map((tweet, index) => `${index + 1}/${tweets.length} ${tweet}`)
            .join("\n\n");
    }, []);

    const autoThreadifyTweetDraft = useCallback(async (text: string, source: "transcript" | "polish") => {
        const cleaned = text.trim();
        if (!isTwitter) return;

        if (!cleaned) {
            onChange({ postText: "", threadDraft: [] });
            return;
        }

        if (cleaned.length <= 280) {
            onChange({ postText: cleaned, threadDraft: [] });
            return;
        }

        setTwitterComposeActionLoading("thread");
        try {
            const response = await fetch("/api/twitter/threadify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: cleaned }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to build tweet thread"));
            }

            const tweets = Array.isArray(payload?.tweets)
                ? payload.tweets.map((item: unknown) => String(item || "").trim()).filter(Boolean)
                : [];

            if (tweets.length <= 1) {
                onChange({ postText: cleaned, threadDraft: [] });
                return;
            }

            onChange({
                postText: formatThreadPreviewText(tweets),
                threadDraft: tweets,
            });

            toast.success(
                source === "transcript"
                    ? `Transcript auto-converted to ${tweets.length}-tweet thread`
                    : `Polished draft converted to ${tweets.length}-tweet thread`,
            );
        } catch (error) {
            onChange({ postText: cleaned, threadDraft: [] });
            toast.error(error instanceof Error ? error.message : "Failed to build tweet thread");
        } finally {
            setTwitterComposeActionLoading(null);
        }
    }, [formatThreadPreviewText, isTwitter, onChange]);

    const applyTwitterTranscriptToDraft = useCallback(async (transcript: string) => {
        const nextTranscript = transcript.trim();
        if (!nextTranscript) {
            return;
        }

        const current = state.postText.trim();
        const merged = current ? `${current}\n\n${nextTranscript}` : nextTranscript;
        await autoThreadifyTweetDraft(merged, "transcript");
    }, [autoThreadifyTweetDraft, state.postText]);

    const transcribeTwitterAudioFile = useCallback(async (file: File) => {
        if (!isTwitter) return;

        setTwitterComposeActionLoading("audio");
        setTwitterAudioFileName(file.name);

        try {
            const formData = new FormData();
            formData.append("audio", file, file.name);

            const response = await fetch("/api/ai/transcribe", {
                method: "POST",
                body: formData,
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to transcribe audio"));
            }

            const transcript = readValue(payload?.transcript, "");
            if (!transcript) {
                throw new Error("No transcript returned from audio");
            }

            setTwitterAudioTranscript(transcript);
            await applyTwitterTranscriptToDraft(transcript);
            toast.success("Audio transcribed and added to tweet draft");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to process audio");
        } finally {
            setTwitterComposeActionLoading(null);
        }
    }, [applyTwitterTranscriptToDraft, isTwitter]);

    const handleTwitterAudioInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.currentTarget.value = "";
        if (!file || !file.type.startsWith("audio/")) {
            if (file) {
                toast.error("Please choose an audio file");
            }
            return;
        }

        void transcribeTwitterAudioFile(file);
    }, [transcribeTwitterAudioFile]);

    const handleStartTwitterAudioRecording = useCallback(async () => {
        if (!isTwitter || twitterAudioIsRecording) return;

        if (typeof window === "undefined" || !window.navigator?.mediaDevices?.getUserMedia) {
            document.getElementById(twitterAudioInputId)?.click();
            return;
        }

        try {
            const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
            twitterAudioStreamRef.current = stream;
            twitterAudioChunksRef.current = [];

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
                    twitterAudioChunksRef.current.push(event.data);
                }
            };

            recorder.onerror = () => {
                setTwitterAudioIsRecording(false);
                twitterAudioRecorderRef.current = null;
                twitterAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
                twitterAudioStreamRef.current = null;
                toast.error("Voice recording failed");
            };

            recorder.onstop = () => {
                const mimeType = recorder.mimeType || "audio/webm";
                const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
                const blob = new Blob(twitterAudioChunksRef.current, { type: mimeType });

                if (blob.size > 0) {
                    const file = new File([blob], `twitter-voice-${Date.now()}.${extension}`, { type: mimeType });
                    void transcribeTwitterAudioFile(file);
                } else {
                    toast.error("No audio captured. Please try again.");
                }

                twitterAudioChunksRef.current = [];
                twitterAudioRecorderRef.current = null;
                twitterAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
                twitterAudioStreamRef.current = null;
                setTwitterAudioIsRecording(false);
            };

            twitterAudioRecorderRef.current = recorder;
            recorder.start();
            setTwitterAudioIsRecording(true);
            toast.info("Recording started. Click audio icon again to stop.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to access microphone");
            twitterAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
            twitterAudioStreamRef.current = null;
        }
    }, [isTwitter, transcribeTwitterAudioFile, twitterAudioInputId, twitterAudioIsRecording]);

    const handleStopTwitterAudioRecording = useCallback(() => {
        if (!twitterAudioRecorderRef.current) return;

        if (twitterAudioRecorderRef.current.state !== "inactive") {
            twitterAudioRecorderRef.current.stop();
            return;
        }

        setTwitterAudioIsRecording(false);
    }, []);

    const handleTwitterAudioIconClick = useCallback(() => {
        if (!isTwitter || twitterComposeActionLoading === "audio") return;

        if (twitterAudioIsRecording) {
            handleStopTwitterAudioRecording();
            return;
        }

        void handleStartTwitterAudioRecording();
    }, [handleStartTwitterAudioRecording, handleStopTwitterAudioRecording, isTwitter, twitterAudioIsRecording, twitterComposeActionLoading]);

    const handleTwitterPolishDraft = useCallback(async () => {
        if (!isTwitter || twitterComposeActionLoading === "polish") return;

        const text = state.postText.trim();
        if (!text) {
            toast.info("Write a tweet first");
            return;
        }

        setTwitterComposeActionLoading("polish");
        try {
            const response = await fetch("/api/twitter/polish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to polish tweet"));
            }

            const polishedText = readValue(payload?.polishedText, "");
            if (!polishedText) {
                throw new Error("No polished text returned");
            }

            await autoThreadifyTweetDraft(polishedText, "polish");
            toast.success("Tweet polished using Groq");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to polish tweet");
        } finally {
            setTwitterComposeActionLoading((prev) => (prev === "polish" ? null : prev));
        }
    }, [autoThreadifyTweetDraft, isTwitter, state.postText, twitterComposeActionLoading]);

    useEffect(() => {
        return () => {
            if (twitterAudioRecorderRef.current && twitterAudioRecorderRef.current.state !== "inactive") {
                twitterAudioRecorderRef.current.stop();
            }
            twitterAudioRecorderRef.current = null;
            twitterAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
            twitterAudioStreamRef.current = null;
            twitterAudioChunksRef.current = [];
        };
    }, []);

    const mediaUrlPreviewEntries = useMemo(() => {
        const segments = state.mediaUrl
            .split(/\n|,/)
            .map((item) => item.trim())
            .filter(Boolean);
        return segments.slice(0, 6).map((url, index) => ({
            key: `url-preview-${index}`,
            name: `Media URL ${index + 1}`,
            url,
        }));
    }, [state.mediaUrl]);

    const [mediaFilePreviewEntries, setMediaFilePreviewEntries] = useState<Array<{
        key: string;
        name: string;
        url: string;
    }>>([]);
    const [composerPreviewAsset, setComposerPreviewAsset] = useState<{ name: string; url: string } | null>(null);

    useEffect(() => {
        const entries = state.mediaFiles.map((file, index) => ({
            key: `${file.name}-${file.lastModified}-${index}`,
            name: file.name,
            url: URL.createObjectURL(file),
        }));
        setMediaFilePreviewEntries(entries);

        return () => {
            entries.forEach((entry) => URL.revokeObjectURL(entry.url));
        };
    }, [state.mediaFiles]);

    const renderMediaComposer = (options?: { compact?: boolean; hideControls?: boolean }) => {
        const compact = options?.compact ?? false;
        const hideControls = options?.hideControls ?? false;

        return (
            <div className={cn("space-y-2", compact && "rounded-xl border border-slate-200 bg-slate-50 p-3")}>
                <input
                    id={mediaInputId}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleMediaInput}
                />

                {!hideControls && (
                    <>
                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Media URL (Optional)</label>
                        <Input
                            value={state.mediaUrl}
                            onChange={(event) => onChange({ mediaUrl: event.target.value })}
                            placeholder={isLinkedIn ? "Paste one or more image URLs (comma/new line separated)" : "Paste image URL (optional if uploading files)"}
                            className={cn("border-slate-200", compact && "bg-white")}
                        />

                        <div
                            className={cn(
                                "rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600",
                                compact ? "bg-white" : "bg-slate-50",
                            )}
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
                    </>
                )}

                {(mediaUrlPreviewEntries.length > 0 || mediaFilePreviewEntries.length > 0) && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-500">Image Preview</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {mediaUrlPreviewEntries.map((entry) => (
                                <div key={entry.key} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
                                    <img
                                        src={entry.url}
                                        alt={entry.name}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-black/70 text-white transition hover:bg-black"
                                        onClick={() => setComposerPreviewAsset({ name: entry.name, url: entry.url })}
                                        aria-label={`Preview ${entry.name}`}
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}

                            {mediaFilePreviewEntries.map((entry, index) => (
                                <div key={entry.key} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
                                    <img src={entry.url} alt={entry.name} className="h-full w-full object-cover" loading="lazy" />
                                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                                        <button
                                            type="button"
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-black/70 text-white transition hover:bg-black"
                                            onClick={() => setComposerPreviewAsset({ name: entry.name, url: entry.url })}
                                            aria-label={`Preview ${entry.name}`}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-black/70 text-white transition hover:bg-black"
                                            onClick={() => onRemoveMediaFile(index)}
                                            aria-label="Remove media file"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Dialog
                    open={Boolean(composerPreviewAsset)}
                    onOpenChange={(open) => {
                        if (!open) setComposerPreviewAsset(null);
                    }}
                >
                    <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-slate-200 bg-white p-0">
                        {composerPreviewAsset ? (
                            <div className="flex max-h-[92vh] flex-col">
                                <DialogHeader className="border-b border-slate-200 px-4 py-3">
                                    <DialogTitle className="line-clamp-1 pr-6 text-sm text-slate-900">{composerPreviewAsset.name}</DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500">Composer image preview</DialogDescription>
                                </DialogHeader>

                                <div className="flex-1 overflow-auto bg-slate-950 p-4">
                                    <img
                                        src={composerPreviewAsset.url}
                                        alt={composerPreviewAsset.name}
                                        className="mx-auto h-auto max-h-[74vh] w-auto max-w-full object-contain"
                                    />
                                </div>
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>
            </div>
        );
    };

    const refreshTwitterStatus = useCallback(async (force = false) => {
        if (!isTwitter) return;

        const now = Date.now();
        const minGapMs = 45000;
        if (!force && now - twitterStatusLastRequestAtRef.current < minGapMs) {
            return;
        }
        twitterStatusLastRequestAtRef.current = now;

        setTwitterProfileLoading(true);
        setTwitterProfileError(null);
        try {
            const capabilitiesResponse = await fetch("/api/twitter/capabilities", { cache: "no-store" });
            const capabilitiesPayload = await capabilitiesResponse.json().catch(() => null);

            if (!capabilitiesResponse.ok) {
                setTwitterCapabilities(null);
                setTwitterProfile(null);
                setTwitterProfileError(readValue(capabilitiesPayload && typeof capabilitiesPayload === "object" ? (capabilitiesPayload as Record<string, unknown>).error : null, "Failed to load X capabilities"));
                return;
            }

            setTwitterCapabilities(capabilitiesPayload);

            const capabilitiesObject = capabilitiesPayload && typeof capabilitiesPayload === "object"
                ? (capabilitiesPayload as Record<string, unknown>)
                : {};

            const operations = capabilitiesObject.operations && typeof capabilitiesObject.operations === "object"
                ? (capabilitiesObject.operations as Record<string, unknown>)
                : {};

            const rapidApi = capabilitiesObject.rapidApi && typeof capabilitiesObject.rapidApi === "object"
                ? (capabilitiesObject.rapidApi as Record<string, unknown>)
                : {};

            const auth = capabilitiesObject.auth && typeof capabilitiesObject.auth === "object"
                ? (capabilitiesObject.auth as Record<string, unknown>)
                : {};

            const rapidReadMode = readValue(rapidApi.readMode, "official").toLowerCase();
            const allowRapidRead = rapidReadMode === "rapidapi" || rapidReadMode === "auto";

            if (operations.me !== true && !allowRapidRead) {
                const reason = readValue(auth.reason, "Reconnect Twitter to continue.");
                setTwitterProfile(null);
                setTwitterProfileProvider(null);
                setTwitterProfileError(reason);
                return;
            }

            // Avoid repeated upstream profile calls during normal UI refresh cycles.
            // Manual refresh (force=true) still fetches live profile data.
            if (!force) {
                return;
            }

            const profileResponse = await fetch("/api/twitter/me", { cache: "no-store" });
            const profilePayload = await profileResponse.json().catch(() => null);

            if (!profileResponse.ok) {
                setTwitterProfile(null);
                setTwitterProfileError(readValue(profilePayload && typeof profilePayload === "object" ? (profilePayload as Record<string, unknown>).error : null, "Failed to load X profile"));
            } else {
                const profile =
                    profilePayload
                        && typeof profilePayload === "object"
                        && (profilePayload as Record<string, unknown>).profile
                        && typeof (profilePayload as Record<string, unknown>).profile === "object"
                        ? ((profilePayload as Record<string, unknown>).profile as Record<string, unknown>)
                        : null;
                const profileProvider =
                    profilePayload
                        && typeof profilePayload === "object"
                        && (profilePayload as Record<string, unknown>).provider
                        && typeof (profilePayload as Record<string, unknown>).provider === "object"
                        ? ((profilePayload as Record<string, unknown>).provider as { mode?: string; host?: string; route?: string })
                        : null;
                setTwitterProfile(profile);
                setTwitterProfileProvider(profileProvider);
                setTwitterProfileError(null);
            }
        } catch {
            setTwitterCapabilities(null);
            setTwitterProfile(null);
            setTwitterProfileProvider(null);
            setTwitterProfileError("Failed to load X profile");
        } finally {
            setTwitterProfileLoading(false);
        }
    }, [isTwitter]);

    const loadRapidSignals = useCallback(async (force = false) => {
        if (rapidSignalsLoading) return;

        const now = Date.now();
        const minGapMs = 45000;
        if (!force && rapidSignalsData && now - rapidSignalsLastRequestAtRef.current < minGapMs) {
            return;
        }

        rapidSignalsLastRequestAtRef.current = now;
        setRapidSignalsLoading(true);
        setRapidSignalsError(null);

        try {
            const query = force ? "?max_results=8&force=1" : "?max_results=8";
            const snapshotRes = await fetch(`/api/twitter/live-snapshot${query}`, { cache: "no-store" });
            const snapshotPayload = await snapshotRes.json().catch(() => null);

            if (!snapshotRes.ok) {
                const message = readValue(
                    snapshotPayload && typeof snapshotPayload === "object"
                        ? (snapshotPayload as Record<string, unknown>).error
                        : null,
                    "Failed to load RapidAPI signals",
                );
                setRapidSignalsError(message);
                setRapidSignalsData(null);
                setRapidSignalsMeta(null);
                return;
            }

            const snapshot =
                snapshotPayload
                    && typeof snapshotPayload === "object"
                    && (snapshotPayload as Record<string, unknown>).snapshot
                    && typeof (snapshotPayload as Record<string, unknown>).snapshot === "object"
                    ? ((snapshotPayload as Record<string, unknown>).snapshot as TwitterLiveSnapshot)
                    : null;

            if (!snapshot) {
                setRapidSignalsError("Snapshot payload missing from Twitter live endpoint.");
                setRapidSignalsData(null);
                setRapidSignalsMeta(null);
                return;
            }

            const snapshotMeta =
                snapshotPayload
                    && typeof snapshotPayload === "object"
                    && (snapshotPayload as Record<string, unknown>).meta
                    && typeof (snapshotPayload as Record<string, unknown>).meta === "object"
                    ? ((snapshotPayload as Record<string, unknown>).meta as { cached: boolean; stale: boolean; fallbackUsed: boolean })
                    : null;

            const successCount = snapshot.checks.filter((item) => item.ok).length;
            if (successCount === 0) {
                setRapidSignalsError("Endpoint calls completed but all requests failed.");
            } else if (snapshotMeta?.fallbackUsed) {
                setRapidSignalsError("Some live endpoints are rate-limited. Showing cached fallback for available data.");
            } else {
                setRapidSignalsError(null);
            }

            setRapidSignalsData(snapshot);
            setRapidSignalsMeta(snapshotMeta);
        } catch {
            setRapidSignalsError("Failed to load RapidAPI signals");
            setRapidSignalsData(null);
            setRapidSignalsMeta(null);
        } finally {
            setRapidSignalsLoading(false);
        }
    }, [rapidSignalsData, rapidSignalsLoading]);

    const loadTwitterNotifications = useCallback(async (unreadOnly = false) => {
        if (!isTwitter) return;

        setTwitterNotificationsLoading(true);
        setTwitterNotificationsError(null);

        try {
            const query = unreadOnly ? "?limit=60&unread_only=1" : "?limit=60";
            const response = await fetch(`/api/twitter/notifications${query}`, { cache: "no-store" });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to load Twitter notifications"));
            }

            setTwitterNotificationsData(payload as TwitterNotificationsResponse);
        } catch (error) {
            setTwitterNotificationsData(null);
            setTwitterNotificationsError(error instanceof Error ? error.message : "Failed to load Twitter notifications");
        } finally {
            setTwitterNotificationsLoading(false);
        }
    }, [isTwitter]);

    const handleTwitterMarkAllRead = useCallback(async () => {
        if (!isTwitter || twitterNotificationsMarkingRead) return;

        setTwitterNotificationsMarkingRead(true);
        try {
            const response = await fetch("/api/twitter/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mark_all_read" }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to mark notifications as read"));
            }

            toast.success("All Twitter notifications marked as read");
            await loadTwitterNotifications(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to mark notifications as read");
        } finally {
            setTwitterNotificationsMarkingRead(false);
        }
    }, [isTwitter, loadTwitterNotifications, twitterNotificationsMarkingRead]);

    const handleTwitterMarkOneRead = useCallback(async (notificationId: string) => {
        const id = notificationId.trim();
        if (!isTwitter || !id || twitterNotificationsPendingId) return;

        setTwitterNotificationsPendingId(id);
        try {
            const response = await fetch("/api/twitter/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mark_read", notificationId: id }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to mark notification as read"));
            }

            await loadTwitterNotifications(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to mark notification as read");
        } finally {
            setTwitterNotificationsPendingId(null);
        }
    }, [isTwitter, loadTwitterNotifications, twitterNotificationsPendingId]);

    const handleTwitterMarkOneUnread = useCallback(async (notificationId: string) => {
        const id = notificationId.trim();
        if (!isTwitter || !id || twitterNotificationsPendingId) return;

        setTwitterNotificationsPendingId(id);
        try {
            const response = await fetch("/api/twitter/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mark_unread", notificationId: id }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to mark notification as unread"));
            }

            await loadTwitterNotifications(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to mark notification as unread");
        } finally {
            setTwitterNotificationsPendingId(null);
        }
    }, [isTwitter, loadTwitterNotifications, twitterNotificationsPendingId]);

    const loadTwitterLists = useCallback(async () => {
        if (!isTwitter) return;

        setTwitterListsLoading(true);
        setTwitterListsError(null);

        try {
            const response = await fetch("/api/twitter/lists?limit=12", { cache: "no-store" });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to load Twitter lists"));
            }

            setTwitterListsData(payload as TwitterListsResponse);
        } catch (error) {
            setTwitterListsData(null);
            setTwitterListsError(error instanceof Error ? error.message : "Failed to load Twitter lists");
        } finally {
            setTwitterListsLoading(false);
        }
    }, [isTwitter]);

    const loadTodayNews = useCallback(async () => {
        if (!isTwitter) return;

        const now = Date.now();
        const minGapMs = 110000;
        if (now - todayNewsLastRequestAtRef.current < minGapMs && (todayNewsData?.items.length || 0) > 0) {
            return;
        }
        todayNewsLastRequestAtRef.current = now;

        setTodayNewsLoading(true);
        setTodayNewsError(null);

        try {
            const response = await fetch("/api/news/today?limit=6", { cache: "no-store" });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to load today news"));
            }

            const next = payload as TodayNewsResponse;
            const nextItems = Array.isArray(next.items) ? next.items : [];
            const nextSignature = nextItems
                .map((item) => `${item.id}:${item.score}:${item.comments}`)
                .join("|");

            const shouldUpdate = !todayNewsData || nextSignature !== todayNewsSignatureRef.current;
            if (shouldUpdate) {
                todayNewsSignatureRef.current = nextSignature;
                setTodayNewsData(next);
            }
        } catch (error) {
            setTodayNewsError(error instanceof Error ? error.message : "Failed to load today news");
        } finally {
            setTodayNewsLoading(false);
        }
    }, [isTwitter, todayNewsData?.items.length]);

    const loadTwitterFollowingFeed = useCallback(async (force = false) => {
        if (!isTwitter) return;

        const now = Date.now();
        const minGapMs = 45000;
        if (!force && now - twitterFollowingLastRequestAtRef.current < minGapMs) {
            return;
        }
        twitterFollowingLastRequestAtRef.current = now;

        if (!twitterFollowingAutoLoaded) {
            setTwitterFollowingAutoLoaded(true);
        }

        if (!isConnected) {
            setTwitterFollowingTimeline(twitterFollowingMockTimeline);
            setTwitterFollowingSource("mock-following");
            setTwitterFollowingError("Twitter account is not connected. Showing fallback following mock feed.");
            return;
        }

        setTwitterFollowingLoading(true);
        setTwitterFollowingError(null);

        try {
            const readMode = readValue(twitterCapabilities?.rapidApi?.readMode, "official").toLowerCase();
            const usersReadAllowed = twitterCapabilities?.scopes?.usersRead !== false;

            if (readMode === "rapidapi" || !usersReadAllowed) {
                setTwitterFollowingTimeline(twitterFollowingMockTimeline);
                setTwitterFollowingSource("mock-following");
                setTwitterFollowingError(
                    readMode === "rapidapi"
                        ? "Following endpoint is unavailable in RapidAPI mode. Showing fallback following mock feed."
                        : "Twitter users.read permission is missing. Showing fallback following mock feed.",
                );
                return;
            }

            const response = await fetch("/api/twitter/tweets/following?max_accounts=10&max_results_per_account=3&max_items=40", { cache: "no-store" });
            const payload = await response.json().catch(() => null);

            const toCount = (value: unknown) => {
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed < 0) return 0;
                return Math.trunc(parsed);
            };

            const mapTimeline = (sourceItems: unknown[]) => {
                return sourceItems.map((entry, index) => {
                    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
                    const metrics = record.public_metrics && typeof record.public_metrics === "object"
                        ? (record.public_metrics as Record<string, unknown>)
                        : {};
                    const author = record.author && typeof record.author === "object"
                        ? (record.author as Record<string, unknown>)
                        : null;

                    const id = readValue(record.id, `following-${index + 1}`);
                    const text = readValue(record.text ?? record.content ?? record.description, "No content");
                    const timestamp = readValue(record.created_at ?? record.timestamp, new Date().toISOString());
                    const authorHandle = readValue(author?.username, liveTwitterUsername || resolvedAccountId.replace(/^@+/, "") || "twitter").replace(/^@+/, "");
                    const authorName = readValue(author?.name, liveTwitterDisplayName);

                    return {
                        id,
                        text,
                        timestamp,
                        url: `https://x.com/${authorHandle}/status/${id}`,
                        status: "PUBLISHED",
                        authorName,
                        authorHandle,
                        replyCount: toCount(metrics.reply_count),
                        retweetCount: toCount(metrics.retweet_count),
                        likeCount: toCount(metrics.like_count),
                        quoteCount: toCount(metrics.quote_count),
                        viewCount: toCount(metrics.impression_count),
                        lang: readValue(record.lang, ""),
                        isMock: false,
                    } as TwitterTimelineItem;
                });
            };

            if (!response.ok) {
                setTwitterFollowingTimeline(twitterFollowingMockTimeline);
                setTwitterFollowingSource("mock-following");
                setTwitterFollowingError(readValue(payload?.error, "Following feed unavailable right now. Showing fallback following mock feed."));
                return;
            }

            const items = Array.isArray(payload?.items) ? payload.items : [];
            const mapped = mapTimeline(items);

            let nextTimeline = mapped;
            let nextProvider = typeof payload?.meta?.provider === "string" ? payload.meta.provider : "official-following";

            if (nextTimeline.length === 0) {
                const warningList = Array.isArray(payload?.meta?.warnings)
                    ? payload.meta.warnings.map((item: unknown) => String(item)).filter(Boolean)
                    : [];
                const noDataMessage = warningList.length > 0
                    ? `No tweets from followed accounts right now. Showing fallback following mock feed. ${warningList.slice(0, 2).join(" | ")}`
                    : "No tweets from followed accounts right now. Showing fallback following mock feed.";
                setTwitterFollowingError(noDataMessage);
                nextTimeline = twitterFollowingMockTimeline;
                nextProvider = "mock-following";
            }

            setTwitterFollowingTimeline(nextTimeline);
            setTwitterFollowingSource(nextProvider);

        } catch (error) {
            setTwitterFollowingTimeline(twitterFollowingMockTimeline);
            setTwitterFollowingSource("mock-following");
            setTwitterFollowingError(error instanceof Error ? `${error.message} Showing fallback following mock feed.` : "Failed to load Following feed. Showing fallback following mock feed.");
        } finally {
            setTwitterFollowingLoading(false);
        }
    }, [
        isConnected,
        isTwitter,
        liveTwitterDisplayName,
        liveTwitterUsername,
        resolvedAccountId,
        twitterFollowingAutoLoaded,
        twitterFollowingMockTimeline,
        twitterCapabilities?.rapidApi?.readMode,
        twitterCapabilities?.scopes?.usersRead,
    ]);

    useEffect(() => {
        void refreshTwitterStatus();
    }, [refreshTwitterStatus, isConnected, resolvedAccountId, data.posts.length]);

    useEffect(() => {
        if (!isTwitter || !isConnected) return;

        const identityKey = (liveTwitterUsername || resolvedAccountId || "twitter").toLowerCase();
        const mode = readValue(twitterCapabilities?.rapidApi?.readMode, "official").toLowerCase();
        const nextAutoKey = `${mode}:${identityKey}`;
        if (rapidSignalsAutoKeyRef.current === nextAutoKey) return;

        rapidSignalsAutoKeyRef.current = nextAutoKey;
        void loadRapidSignals(false);
    }, [
        isTwitter,
        isConnected,
        twitterCapabilities?.rapidApi?.readMode,
        liveTwitterUsername,
        resolvedAccountId,
        loadRapidSignals,
    ]);

    useEffect(() => {
        if (!isTwitter) return;
        void loadTwitterNotifications(false);
        void loadTwitterLists();
        void loadTodayNews();
    }, [isTwitter, loadTwitterNotifications, loadTwitterLists, loadTodayNews]);

    useEffect(() => {
        if (!isTwitter) return;

        const intervalId = window.setInterval(() => {
            void loadTodayNews();
        }, 120000);

        return () => window.clearInterval(intervalId);
    }, [isTwitter, loadTodayNews]);

    useEffect(() => {
        if (!isTwitter) return;
        if (twitterSurface === "notifications") {
            void loadTwitterNotifications(false);
        }
        if (twitterSurface === "lists") {
            void loadTwitterLists();
        }
    }, [isTwitter, loadTwitterLists, loadTwitterNotifications, twitterSurface]);

    useEffect(() => {
        if (!isTwitter) return;
        if (twitterSurface !== "home" || twitterHomeTab !== "following") return;
        if (twitterFollowingLoading || twitterFollowingAutoLoaded) return;
        void loadTwitterFollowingFeed(false);
    }, [
        isTwitter,
        loadTwitterFollowingFeed,
        twitterFollowingAutoLoaded,
        twitterFollowingLoading,
        twitterHomeTab,
        twitterSurface,
    ]);

    const callTwitterAction = async ({
        key,
        label,
        path,
        method = "GET",
        body,
        refreshAfter,
    }: {
        key: string;
        label: string;
        path: string;
        method?: "GET" | "POST" | "DELETE";
        body?: Record<string, unknown>;
        refreshAfter?: boolean;
    }) => {
        setTwitterActionLoading(key);
        try {
            const response = await fetch(path, {
                method,
                headers: body ? { "Content-Type": "application/json" } : undefined,
                body: body ? JSON.stringify(body) : undefined,
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readValue(payload && typeof payload === "object" ? (payload as Record<string, unknown>).error : null, `${label} failed`));
            }

            if (key === "read") {
                const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>).data : null;
                const text =
                    data && typeof data === "object" && typeof (data as Record<string, unknown>).text === "string"
                        ? String((data as Record<string, unknown>).text)
                        : "";
                setTwitterActionResult(text ? `Tweet loaded: ${text.slice(0, 160)}` : "Tweet loaded successfully");
            } else {
                setTwitterActionResult(`${label} successful`);
            }

            toast.success(`${label} successful`);
            if (refreshAfter) {
                onRefresh();
                void refreshTwitterStatus();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : `${label} failed`;
            setTwitterActionResult(message);
            toast.error(message);
        } finally {
            setTwitterActionLoading(null);
        }
    };

    const handleTwitterReadById = async (tweetId?: string) => {
        const id = (tweetId || twitterOpsTweetId).trim();
        if (!id) {
            toast.error("Tweet ID is required");
            return;
        }
        setTwitterOpsTweetId(id);
        await callTwitterAction({
            key: "read",
            label: "Read tweet",
            path: `/api/twitter/tweets/${encodeURIComponent(id)}`,
            method: "GET",
        });
    };

    const handleTwitterLike = async (mode: "like" | "unlike", tweetId?: string) => {
        const id = (tweetId || twitterOpsTweetId).trim();
        if (!id) {
            toast.error("Tweet ID is required");
            return;
        }
        setTwitterOpsTweetId(id);
        await callTwitterAction({
            key: mode,
            label: mode === "like" ? "Like" : "Unlike",
            path: `/api/twitter/tweets/${encodeURIComponent(id)}/like`,
            method: mode === "like" ? "POST" : "DELETE",
        });
    };

    const handleTwitterRetweet = async (mode: "retweet" | "unretweet", tweetId?: string) => {
        const id = (tweetId || twitterOpsTweetId).trim();
        if (!id) {
            toast.error("Tweet ID is required");
            return;
        }
        setTwitterOpsTweetId(id);
        await callTwitterAction({
            key: mode,
            label: mode === "retweet" ? "Retweet" : "Unretweet",
            path: `/api/twitter/tweets/${encodeURIComponent(id)}/retweet`,
            method: mode === "retweet" ? "POST" : "DELETE",
        });
    };

    const handleTwitterReply = async (tweetId?: string) => {
        const id = (tweetId || twitterOpsTweetId).trim();
        const text = twitterReplyText.trim();
        if (!id) {
            toast.error("Tweet ID is required");
            return;
        }
        if (!text) {
            toast.error("Reply text is required");
            return;
        }
        setTwitterOpsTweetId(id);
        await callTwitterAction({
            key: "reply",
            label: "Reply",
            path: `/api/twitter/tweets/${encodeURIComponent(id)}/reply`,
            method: "POST",
            body: { text },
            refreshAfter: true,
        });
        setTwitterReplyText("");
    };

    const handleTwitterDelete = async (tweetId?: string) => {
        const id = (tweetId || twitterOpsTweetId).trim();
        if (!id) {
            toast.error("Tweet ID is required");
            return;
        }
        if (typeof window !== "undefined" && !window.confirm("Delete this tweet on X? This action cannot be undone.")) {
            return;
        }
        setTwitterOpsTweetId(id);
        await callTwitterAction({
            key: "delete",
            label: "Delete",
            path: `/api/twitter/tweets/${encodeURIComponent(id)}`,
            method: "DELETE",
            refreshAfter: true,
        });
    };

    const handleTwitterChatSend = async () => {
        const text = state.messageText.trim();
        if (!activeTwitterChatThread) {
            toast.error("Select a conversation first");
            return;
        }
        if (!text) {
            toast.error("Message is required");
            return;
        }

        if (activeTwitterChatThread.source === "live") {
            try {
                const response = await fetch("/api/unipile/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        account_id: resolvedAccountId,
                        chat_id: activeTwitterChatThread.id,
                        text,
                    }),
                });

                const payload = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(readValue(payload?.error, "Failed to send message"));
                }

                toast.success("Message sent");
                onChange({ messageText: "", messageRecipient: activeTwitterChatThread.id });
                onRefresh();
                return;
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to send message");
                return;
            }
        }

        const now = new Date().toISOString();
        setTwitterMockChatThreadState((previous) => {
            return previous.map((thread) => {
                if (thread.id !== activeTwitterChatThread.id) return thread;
                return {
                    ...thread,
                    unreadCount: 0,
                    lastMessageAt: now,
                    messages: [
                        ...thread.messages,
                        {
                            id: `${thread.id}-local-${Date.now()}`,
                            text,
                            timestamp: now,
                            direction: "outbound",
                            senderName: liveTwitterDisplayName,
                            senderHandle: `@${liveTwitterUsername || "you"}`,
                            isMock: true,
                        },
                    ],
                };
            });
        });

        onChange({ messageText: "", messageRecipient: activeTwitterChatThread.id });
        toast.success("Preview message added");
    };

    const twitterDigest = useMemo(() => {
        return effectiveTwitterTimeline.reduce(
            (acc, tweet) => {
                acc.posts += 1;
                acc.likes += tweet.likeCount;
                acc.retweets += tweet.retweetCount;
                acc.replies += tweet.replyCount;
                acc.views += tweet.viewCount;
                return acc;
            },
            {
                posts: 0,
                likes: 0,
                retweets: 0,
                replies: 0,
                views: 0,
                inbox: scopedInbox.length,
                comments: data.comments.length,
            },
        );
    }, [effectiveTwitterTimeline, scopedInbox.length, data.comments.length]);

    const twitterActionQueue = useMemo(() => {
        return effectiveTwitterTimeline
            .map((tweet) => {
                const score = tweet.replyCount * 2 + tweet.likeCount + tweet.retweetCount * 2 + Math.min(10, Math.round(tweet.viewCount / 100));
                return { ...tweet, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 4);
    }, [effectiveTwitterTimeline]);

    if (isTwitter) {
        const canCreate = isConnected && twitterCapabilities?.operations?.createTweet !== false;
        const canRead = isConnected && twitterCapabilities?.operations?.readTweetById !== false;
        const canDelete = isConnected && twitterCapabilities?.operations?.deleteTweet !== false;
        const canLike = isConnected && twitterCapabilities?.operations?.likeUnlike !== false;
        const canRetweet = isConnected && twitterCapabilities?.operations?.retweetUnretweet !== false;
        const canReply = isConnected && twitterCapabilities?.operations?.reply !== false;

        const utilityNav = [
            {
                key: "notifications",
                label: "Notifications",
                icon: Bell,
                count: twitterNotificationsData?.summary.unreadCount || 0,
            },
            {
                key: "lists",
                label: "Lists",
                icon: ClipboardList,
                count: twitterListsData?.lists.length || 0,
            },
        ] as const;

        const toCount = (input: unknown) => {
            const parsed = Number(input);
            return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
        };

        const profileMetrics =
            twitterProfile
                && typeof twitterProfile.public_metrics === "object"
                && twitterProfile.public_metrics !== null
                ? (twitterProfile.public_metrics as Record<string, unknown>)
                : null;

        const followersCount = toCount(profileMetrics?.followers_count);
        const followingCount = toCount(profileMetrics?.following_count);
        const tweetCount = toCount(profileMetrics?.tweet_count);

        const topEngagedTweets = [...effectiveTwitterTimeline]
            .sort((a, b) => (b.likeCount + b.retweetCount + b.replyCount) - (a.likeCount + a.retweetCount + a.replyCount))
            .slice(0, 6);

        const profilePosts = effectiveTwitterTimeline.slice(0, 12);
        const profileTabOptions = [
            { key: "posts", label: "Posts" },
            { key: "replies", label: "Replies" },
            { key: "media", label: "Media" },
            { key: "likes", label: "Likes" },
        ] as const;

        const profileTimelineItems = twitterProfileTab === "media"
            ? profilePosts.filter((tweet) => Array.isArray(tweet.mediaUrls) && tweet.mediaUrls.length > 0)
            : twitterProfileTab === "replies"
                ? profilePosts.filter((tweet) => tweet.text.trim().startsWith("@"))
                : twitterProfileTab === "likes"
                    ? topEngagedTweets
                    : profilePosts;

        const effectiveSignals = rapidSignalsData || twitterPreviewSignals;
        const usingMockSignals = !rapidSignalsData;

        const trendsCheck = effectiveSignals.checks.find((item) => item.label === "Trends by Location") || null;

        const trendCards = (effectiveSignals.signals.trends || []).map((trend) => ({
            name: trend.name,
            volume: trend.volumeLabel,
        }));

        const trendsLive = trendCards.length > 0;
        const recentApiTweets = (effectiveSignals.recentTweets.length ? effectiveSignals.recentTweets : effectiveTwitterTimeline).slice(0, 5);
        const hasTimelineSignals = recentApiTweets.length > 0 || topEngagedTweets.length > 0;

        const trendsBadgeLabel = usingMockSignals ? "Preview" : trendsLive ? "Live" : "Limited";
        const trendsBadgeClass = usingMockSignals
            ? "bg-blue-100 text-blue-700"
            : trendsLive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700";

        const recentBadgeLabel = usingMockSignals ? "Preview" : recentApiTweets.length > 0 ? "Live" : "No posts";
        const recentBadgeClass = usingMockSignals
            ? "bg-blue-100 text-blue-700"
            : recentApiTweets.length > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-600";

        const workflowFolders = [
            {
                id: "action",
                label: "Action Required",
                detail: "Engagement-heavy tweets",
                count: twitterActionQueue.length,
                onClick: () => setTwitterSurface("home"),
            },
            {
                id: "timeline",
                label: "Timeline",
                detail: "Published post stream",
                count: twitterDigest.posts,
                onClick: () => setTwitterSurface("home"),
            },
            {
                id: "discover",
                label: "Explore Desk",
                detail: "Top engaged tweets",
                count: topEngagedTweets.length,
                onClick: () => setTwitterSurface("explore"),
            },
            {
                id: "inbox",
                label: "Inbox Ops",
                detail: "DM integration status",
                count: twitterChatCount,
                onClick: () => setTwitterSurface("messages"),
            },
            {
                id: "profile",
                label: "Profile Lab",
                detail: "Identity and public view",
                count: profilePosts.length,
                onClick: () => setTwitterSurface("profile"),
            },
        ] as const;

        const profileJoinedDate = connectionMeta?.connectedAt ? new Date(connectionMeta.connectedAt) : null;
        const profileJoinedLabel = profileJoinedDate && !Number.isNaN(profileJoinedDate.getTime())
            ? profileJoinedDate.toLocaleDateString(undefined, { month: "short", year: "numeric" })
            : "Recently";

        const pageNav = [
            { key: "home", label: "Home", icon: LayoutDashboard, count: twitterDigest.posts },
            { key: "explore", label: "Explore", icon: Hash, count: topEngagedTweets.length },
            { key: "messages", label: "Chat", icon: MessageCircle, count: twitterChatCount },
            { key: "profile", label: "Profile", icon: Users, count: profilePosts.length },
        ] as const;

        const twitterNotificationItems = twitterNotificationsData?.items || [];
        const twitterNotificationUnreadCount = twitterNotificationsData?.summary.unreadCount || 0;
        const twitterListItems = twitterListsData?.lists || [];
        const twitterListsWarning = twitterListsData?.meta?.warning || null;
        const todayNewsItems = todayNewsData?.items || [];

        const renderTimelineCard = (tweet: TwitterTimelineItem, index: number, compact = false) => (
            <article key={`${tweet.id}-${index}`} className={cn("border-b border-slate-200 px-4 py-3", compact && "px-3 py-2.5")}>
                <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 border border-slate-200 bg-white">
                        <AvatarImage src={tweet.authorAvatarUrl || liveTwitterAvatarUrl || undefined} alt={tweet.authorName} />
                        <AvatarFallback className="bg-slate-900 text-[11px] text-white">{tweet.authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                                {tweet.authorName}
                                <span className="ml-1.5 font-normal text-slate-500">
                                    @{tweet.authorHandle} · {formatRelativeTime(tweet.timestamp).replace(" ago", "")}
                                </span>
                            </p>
                            <button
                                type="button"
                                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                onClick={() => {
                                    if (tweet.isMock) return;
                                    setTwitterOpsTweetId(tweet.id);
                                }}
                                title={tweet.isMock ? "Preview tweet" : "Select tweet"}
                                disabled={tweet.isMock}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </button>
                        </div>

                        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-slate-900">{tweet.text}</p>

                        {Array.isArray(tweet.mediaUrls) && tweet.mediaUrls.length > 0 && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {tweet.mediaUrls.slice(0, 2).map((mediaUrl) => (
                                    <img
                                        key={`${tweet.id}-${mediaUrl}`}
                                        src={mediaUrl}
                                        alt="Tweet attachment"
                                        className="h-auto w-full rounded-xl border border-slate-200 object-cover"
                                        loading="lazy"
                                    />
                                ))}
                            </div>
                        )}

                        <div className="mt-3 flex items-center justify-between text-slate-500">
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-full px-2 text-xs hover:bg-blue-50 hover:text-blue-600"
                                onClick={() => {
                                    if (tweet.isMock) return;
                                    setTwitterOpsTweetId(tweet.id);
                                    setTwitterActionResult("Reply target selected. Type your reply in the right panel.");
                                }}
                                disabled={twitterActionLoading !== null || !canReply || Boolean(tweet.isMock)}
                            >
                                <MessageCircle className="mr-1 h-4 w-4" />
                                {formatCompactCount(tweet.replyCount)}
                            </Button>

                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-full px-2 text-xs hover:bg-emerald-50 hover:text-emerald-600"
                                onClick={() => void handleTwitterRetweet("retweet", tweet.id)}
                                disabled={twitterActionLoading !== null || !canRetweet || Boolean(tweet.isMock)}
                            >
                                <Repeat2 className="mr-1 h-4 w-4" />
                                {formatCompactCount(tweet.retweetCount)}
                            </Button>

                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-full px-2 text-xs hover:bg-pink-50 hover:text-pink-600"
                                onClick={() => void handleTwitterLike("like", tweet.id)}
                                disabled={twitterActionLoading !== null || !canLike || Boolean(tweet.isMock)}
                            >
                                <Heart className="mr-1 h-4 w-4" />
                                {formatCompactCount(tweet.likeCount)}
                            </Button>

                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-full px-2 text-xs hover:bg-slate-100 hover:text-slate-700"
                                onClick={() => void handleTwitterReadById(tweet.id)}
                                disabled={twitterActionLoading !== null || !canRead || Boolean(tweet.isMock)}
                            >
                                <ExternalLink className="mr-1 h-4 w-4" />
                                {formatCompactCount(tweet.viewCount)}
                            </Button>

                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-full px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => void handleTwitterDelete(tweet.id)}
                                disabled={twitterActionLoading !== null || !canDelete || Boolean(tweet.isMock)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>

                        {tweet.isMock && <p className="mt-1.5 text-[11px] text-slate-500">Preview content shown while live timeline data syncs.</p>}

                        {tweet.url && (
                            <a href={tweet.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex text-xs text-blue-600 hover:underline">
                                Open on X
                            </a>
                        )}
                    </div>
                </div>
            </article>
        );

        return (
            <div className="space-y-3">
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

                <div className="grid h-[calc(100vh-140px)] w-full gap-0 overflow-hidden rounded-2xl border border-slate-300 bg-slate-100/70 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.7)] xl:grid-cols-[260px_minmax(0,1fr)_340px]">
                    <aside className="h-full border-r border-slate-300 bg-slate-50 shadow-[inset_-1px_0_0_rgba(148,163,184,0.35)]">
                        <div className="space-y-4 p-4">
                            <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                                <Twitter className="h-5 w-5" />
                                <span>X</span>
                            </div>

                            <div className="space-y-1">
                                {pageNav.map((item) => {
                                    const Icon = item.icon;
                                    const active = twitterSurface === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setTwitterSurface(item.key)}
                                            className={cn(
                                                "flex h-11 w-full items-center gap-3 rounded-full px-3 text-sm transition",
                                                active
                                                    ? "bg-slate-900 text-white"
                                                    : "text-slate-700 hover:bg-slate-100",
                                            )}
                                        >
                                            <Icon className="h-4.5 w-4.5" />
                                            <span className="flex-1 text-left">{item.label}</span>
                                            <span
                                                className={cn(
                                                    "rounded-full px-1.5 py-0.5 text-[10px]",
                                                    active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600",
                                                )}
                                            >
                                                {item.count}
                                            </span>
                                        </button>
                                    );
                                })}

                                {utilityNav.map((item) => {
                                    const Icon = item.icon;
                                    const active = twitterSurface === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setTwitterSurface(item.key)}
                                            className={cn(
                                                "flex h-11 w-full items-center gap-3 rounded-full px-3 text-sm transition",
                                                active
                                                    ? "bg-slate-900 text-white"
                                                    : "text-slate-700 hover:bg-slate-100",
                                            )}
                                        >
                                            <Icon className="h-4.5 w-4.5" />
                                            <span className="flex-1 text-left">{item.label}</span>
                                            <span
                                                className={cn(
                                                    "rounded-full px-1.5 py-0.5 text-[10px]",
                                                    active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600",
                                                )}
                                            >
                                                {item.count}
                                            </span>
                                        </button>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => {
                                        setTwitterSurface("notifications");
                                        toast.info("Opened Notifications from More");
                                    }}
                                    className="flex h-11 w-full items-center gap-3 rounded-full px-3 text-sm text-slate-700 transition hover:bg-slate-100"
                                >
                                    <MoreHorizontal className="h-4.5 w-4.5" />
                                    <span>More</span>
                                </button>
                            </div>

                            <Button
                                type="button"
                                className="w-full rounded-full bg-black text-white hover:bg-slate-900"
                                onClick={() => setTwitterSurface("home")}
                            >
                                Post
                            </Button>

                            <div className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-9 w-9 border border-slate-200 bg-white">
                                        <AvatarImage src={liveTwitterAvatarUrl || undefined} alt={liveTwitterDisplayName} />
                                        <AvatarFallback className="bg-slate-900 text-xs text-white">{liveTwitterDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">{liveTwitterDisplayName}</p>
                                        <p className="truncate text-xs text-slate-500">@{liveTwitterUsername || "twitter"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-300 bg-white/95 p-3 shadow-sm">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workflow Folders</p>
                                <div className="mt-2 space-y-1.5">
                                    {workflowFolders.map((folder) => (
                                        <button
                                            key={folder.id}
                                            type="button"
                                            onClick={folder.onClick}
                                            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-slate-300"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-xs font-semibold text-slate-900">{folder.label}</span>
                                                <span className="block truncate text-[11px] text-slate-500">{folder.detail}</span>
                                            </span>
                                            <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">{folder.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>

                    <section className="scrollbar-hide h-full overflow-y-auto border-r border-slate-300 bg-white shadow-[inset_-1px_0_0_rgba(148,163,184,0.28)]">
                        {twitterSurface === "home" && (
                            <>
                                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
                                    <div className="grid grid-cols-2 text-sm">
                                        <button
                                            type="button"
                                            className={cn(
                                                "flex h-12 items-center justify-center border-0 bg-transparent transition",
                                                twitterHomeTab === "for-you"
                                                    ? "border-b-2 border-sky-500 font-semibold text-slate-900"
                                                    : "text-slate-500 hover:text-slate-700",
                                            )}
                                            onClick={() => setTwitterHomeTab("for-you")}
                                        >
                                            For you
                                        </button>
                                        <button
                                            type="button"
                                            className={cn(
                                                "flex h-12 items-center justify-center border-0 bg-transparent transition",
                                                twitterHomeTab === "following"
                                                    ? "border-b-2 border-sky-500 font-semibold text-slate-900"
                                                    : "text-slate-500 hover:text-slate-700",
                                            )}
                                            onClick={() => {
                                                setTwitterHomeTab("following");
                                                if (twitterFollowingTimeline.length === 0) {
                                                    void loadTwitterFollowingFeed(false);
                                                }
                                            }}
                                        >
                                            Following
                                        </button>
                                    </div>

                                    {twitterHomeTab === "following" && (
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary" className={cn("text-[11px]", twitterFollowingSource ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700")}>
                                                    {twitterFollowingSource ? `${twitterFollowingSource} feed` : "Live feed"}
                                                </Badge>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[11px]">
                                                    {twitterFollowingTimeline.length} tweets
                                                </Badge>
                                            </div>

                                            <button
                                                type="button"
                                                className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                                                onClick={() => void loadTwitterFollowingFeed(true)}
                                                disabled={twitterFollowingLoading}
                                            >
                                                Refresh Following
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="border-b border-slate-200 p-4">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-10 w-10 border border-slate-200 bg-white">
                                            <AvatarImage src={liveTwitterAvatarUrl || undefined} alt={liveTwitterDisplayName} />
                                            <AvatarFallback className="bg-slate-900 text-xs text-white">{liveTwitterDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 space-y-3">
                                            <textarea
                                                value={state.postText}
                                                onChange={(event) => onChange({ postText: event.target.value, threadDraft: [] })}
                                                className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] outline-none ring-blue-500 focus:ring-2"
                                                placeholder="What is happening?"
                                            />

                                            <input
                                                id={twitterAudioInputId}
                                                type="file"
                                                accept="audio/*"
                                                className="hidden"
                                                onChange={handleTwitterAudioInputChange}
                                            />

                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-1 text-slate-500">
                                                    <button
                                                        type="button"
                                                        className="rounded-full p-1.5 hover:bg-blue-50 hover:text-blue-600"
                                                        title="Add media"
                                                        onClick={() => document.getElementById(mediaInputId)?.click()}
                                                    >
                                                        <ImageIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "rounded-full p-1.5 hover:bg-blue-50 hover:text-blue-600",
                                                            twitterAudioIsRecording && "bg-red-100 text-red-600",
                                                        )}
                                                        title={twitterAudioIsRecording ? "Stop voice recording" : "Record or upload voice note"}
                                                        onClick={handleTwitterAudioIconClick}
                                                        disabled={twitterComposeActionLoading === "audio"}
                                                    >
                                                        {twitterComposeActionLoading === "audio"
                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                            : <Mic className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-full p-1.5 hover:bg-blue-50 hover:text-blue-600"
                                                        title="Insert hashtag"
                                                        onClick={() => {
                                                            const next = `${state.postText.trimEnd()} #`;
                                                            onChange({ postText: next.trimStart(), threadDraft: [] });
                                                        }}
                                                    >
                                                        <Hash className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-full p-1.5 hover:bg-blue-50 hover:text-blue-600"
                                                        title="Polish text"
                                                        onClick={() => void handleTwitterPolishDraft()}
                                                        disabled={twitterComposeActionLoading === "polish"}
                                                    >
                                                        {twitterComposeActionLoading === "polish"
                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                            : <Sparkles className="h-4 w-4" />}
                                                    </button>
                                                </div>

                                                <span className={cn("text-xs", postCount > postLimit ? "text-red-600" : "text-slate-500")}>
                                                    {postCount}/{postLimit}
                                                </span>
                                            </div>

                                            {(twitterAudioIsRecording || twitterAudioFileName || twitterAudioTranscript) && (
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                                    {twitterAudioIsRecording
                                                        ? "Recording voice note... click the mic icon again to stop."
                                                        : twitterAudioTranscript
                                                            ? "Voice note transcribed and merged into tweet draft."
                                                            : "Voice note ready for transcription."}
                                                    {twitterAudioFileName && (
                                                        <span className="ml-2 font-medium text-slate-700">{twitterAudioFileName}</span>
                                                    )}
                                                </div>
                                            )}

                                            {(twitterComposeActionLoading === "thread" || state.threadDraft.length > 1) && (
                                                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                                                    {twitterComposeActionLoading === "thread"
                                                        ? "Building automatic tweet thread from long text..."
                                                        : `Thread mode enabled: ${state.threadDraft.length} tweets will be posted in sequence.`}
                                                </div>
                                            )}

                                            {renderMediaComposer({ compact: true, hideControls: true })}

                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-500">Media actions use X composer icons.</span>
                                                <Button
                                                    onClick={onPublish}
                                                    className="rounded-full bg-black px-5 text-white hover:bg-slate-900"
                                                    disabled={!state.postText.trim() || !canCreate}
                                                >
                                                    Post
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="divide-y divide-slate-200">
                                    {twitterHomeTab === "for-you" && data.loading && !usingMockTimeline && (
                                        <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading tweets...
                                        </div>
                                    )}

                                    {twitterHomeTab === "for-you" && usingMockTimeline && (
                                        <div className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
                                            Showing preview feed while live timeline data is unavailable.
                                        </div>
                                    )}

                                    {twitterHomeTab === "following" && twitterFollowingLoading && (
                                        <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading following feed...
                                        </div>
                                    )}

                                    {twitterHomeTab === "following" && twitterFollowingError && (
                                        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                                            {twitterFollowingError}
                                        </div>
                                    )}

                                    {twitterHomeTab === "for-you" && !data.loading && !usingMockTimeline && effectiveTwitterTimeline.length === 0 && (
                                        <div className="p-8 text-center text-sm text-slate-500">No tweets yet. Publish one to start your feed.</div>
                                    )}

                                    {twitterHomeTab === "following" && !twitterFollowingLoading && !twitterFollowingError && twitterFollowingTimeline.length === 0 && (
                                        <div className="p-8 text-center text-sm text-slate-500">No tweets available from Following feed yet.</div>
                                    )}

                                    {(twitterHomeTab === "for-you" ? effectiveTwitterTimeline : twitterFollowingTimeline).map((tweet, index) => renderTimelineCard(tweet, index))}
                                </div>
                            </>
                        )}

                        {twitterSurface === "explore" && (
                            <>
                                <div className="border-b border-slate-200 bg-white px-3 py-2.5">
                                    <div className="relative max-w-xl">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <Input placeholder="Search timeline, hashtags, and profiles" className="rounded-full border-slate-300 bg-white pl-9" />
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="secondary" className="border border-slate-200 bg-slate-100 text-slate-700">Explore Desk</Badge>
                                            <Badge variant="secondary" className={cn("text-[11px]", usingMockSignals ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-600")}>
                                                {usingMockSignals ? "Preview Mode" : "Live Mode"}
                                            </Badge>
                                        </div>
                                        <button type="button" className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void handleTwitterReadById()} disabled={usingMockTimeline}>Inspect Tweet</button>
                                    </div>
                                </div>

                                <div className="space-y-2.5 p-3">
                                    <div className="space-y-2.5">
                                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-900">Signal Board</p>
                                                <p className="text-[11px] text-slate-500">
                                                    {usingMockSignals
                                                        ? "Preview"
                                                        : `Updated ${formatRelativeTime(effectiveSignals.fetchedAt)}`}
                                                </p>
                                            </div>

                                            <div className="mt-2 grid grid-cols-3 gap-2">
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                                    <p className="text-[10px] text-slate-500">Followers</p>
                                                    <p className="text-sm font-semibold text-slate-900">{formatCompactCount(followersCount)}</p>
                                                </div>
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                                    <p className="text-[10px] text-slate-500">Following</p>
                                                    <p className="text-sm font-semibold text-slate-900">{formatCompactCount(followingCount)}</p>
                                                </div>
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                                    <p className="text-[10px] text-slate-500">Posts</p>
                                                    <p className="text-sm font-semibold text-slate-900">{formatCompactCount(tweetCount || twitterDigest.posts)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-900">Trending Topics</p>
                                                <Badge variant="secondary" className={cn("text-[10px]", trendsBadgeClass)}>{trendsBadgeLabel}</Badge>
                                            </div>

                                            {trendCards.length === 0 ? (
                                                <p className="mt-2 text-xs text-slate-500">{trendsCheck?.note || "No trend entries available."}</p>
                                            ) : (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {trendCards.slice(0, 12).map((trend) => (
                                                        <span key={trend.name} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-900">
                                                            {trend.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {rapidSignalsLoading && (
                                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">Refreshing endpoint data...</p>
                                    )}

                                    {rapidSignalsError && !usingMockSignals && (
                                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">{rapidSignalsError}</p>
                                    )}

                                    {usingMockSignals && (
                                        <p className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">Live endpoints are limited right now. Preview data keeps the experience complete.</p>
                                    )}

                                    {!usingMockSignals && rapidSignalsMeta?.cached && (
                                        <p className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">Using cached snapshot to reduce Basic-plan pressure.</p>
                                    )}

                                    {!usingMockSignals && rapidSignalsMeta?.fallbackUsed && (
                                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">Some endpoints were rate-limited and replaced with cached values.</p>
                                    )}

                                    {recentApiTweets.length > 0 && (
                                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-900">Recent Tweets</p>
                                                <Badge variant="secondary" className={cn("text-[10px]", recentBadgeClass)}>{recentBadgeLabel}</Badge>
                                            </div>

                                            <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                                                {recentApiTweets.map((tweet) => (
                                                    <div key={`live-${tweet.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                                                        <p className="line-clamp-2 text-sm text-slate-800">{tweet.text}</p>
                                                        <p className="mt-1.5 text-xs text-slate-500">{formatRelativeTime(tweet.timestamp)} · {formatCompactCount(tweet.likeCount)} likes · {formatCompactCount(tweet.retweetCount)} reposts</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {topEngagedTweets.length > 0 && (
                                        <div className="rounded-xl border border-slate-200 bg-white">
                                            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                                                <p className="text-sm font-semibold text-slate-900">Top Engaged Tweets</p>
                                                <p className="text-xs text-slate-500">Click to target actions</p>
                                            </div>
                                            <div className="divide-y divide-slate-200">
                                                {topEngagedTweets.map((tweet) => (
                                                    <button
                                                        key={`explore-${tweet.id}`}
                                                        type="button"
                                                        onClick={() => {
                                                            if (tweet.isMock) return;
                                                            setTwitterOpsTweetId(tweet.id);
                                                        }}
                                                        className={cn("w-full px-3 py-2.5 text-left hover:bg-slate-50", tweet.isMock && "cursor-default")}
                                                        disabled={Boolean(tweet.isMock)}
                                                    >
                                                        <p className="line-clamp-2 text-sm text-slate-800">{tweet.text}</p>
                                                        <p className="mt-1.5 text-xs text-slate-500">
                                                            {formatCompactCount(tweet.likeCount + tweet.retweetCount + tweet.replyCount)} engagements · {formatRelativeTime(tweet.timestamp)}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!hasTimelineSignals && (
                                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                                            No live timeline available yet. Connect or publish to replace preview content.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        {twitterSurface === "messages" && (
                            <>
                                <div className="border-b border-slate-200 px-4 py-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-xl font-semibold text-slate-900">Chat</h3>
                                        <Badge variant="secondary" className={cn("text-[11px]", usingMockChatThreads ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>
                                            {usingMockChatThreads ? "Preview Inbox" : "Live Inbox"}
                                        </Badge>
                                    </div>
                                    <div className="mt-3 relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            value={twitterChatQuery}
                                            onChange={(event) => setTwitterChatQuery(event.target.value)}
                                            placeholder="Search conversation"
                                            className="rounded-full border-slate-200 bg-slate-50 pl-9"
                                        />
                                    </div>
                                </div>

                                <div className="grid min-h-140 md:grid-cols-[320px_1fr]">
                                    <div className="scrollbar-hide border-b border-r border-slate-200 p-2.5 md:border-b-0 md:overflow-y-auto">
                                        {filteredTwitterChatThreads.length === 0 ? (
                                            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                                                <MessageCircle className="mb-3 h-10 w-10 text-slate-400" />
                                                <p className="text-lg font-semibold text-slate-900">No chats found</p>
                                                <p className="mt-1.5 text-sm text-slate-500">Try another search term.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {filteredTwitterChatThreads.map((thread) => {
                                                    const active = activeTwitterChatThread?.id === thread.id;
                                                    const lastMessage = thread.messages[thread.messages.length - 1];

                                                    return (
                                                        <button
                                                            key={thread.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTwitterActiveChatId(thread.id);
                                                                onChange({ messageRecipient: thread.id });
                                                                if (usingMockChatThreads) {
                                                                    setTwitterMockChatThreadState((previous) => previous.map((item) => {
                                                                        if (item.id !== thread.id) return item;
                                                                        return { ...item, unreadCount: 0 };
                                                                    }));
                                                                }
                                                            }}
                                                            className={cn(
                                                                "w-full rounded-lg border px-2.5 py-2 text-left transition",
                                                                active
                                                                    ? "border-slate-900 bg-slate-900 text-white"
                                                                    : "border-slate-200 bg-white hover:bg-slate-50",
                                                            )}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className={cn("truncate text-sm font-semibold", active ? "text-white" : "text-slate-900")}>{thread.title}</p>
                                                                    <p className={cn("truncate text-xs", active ? "text-white/70" : "text-slate-500")}>{thread.handle}</p>
                                                                </div>
                                                                {thread.unreadCount > 0 && (
                                                                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
                                                                        {thread.unreadCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {lastMessage && (
                                                                <p className={cn("mt-1 line-clamp-1 text-xs", active ? "text-white/80" : "text-slate-600")}>{lastMessage.text}</p>
                                                            )}
                                                            <p className={cn("mt-1 text-[11px]", active ? "text-white/70" : "text-slate-500")}>{formatRelativeTime(thread.lastMessageAt)}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex min-h-105 flex-col">
                                        {activeTwitterChatThread ? (
                                            <>
                                                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="h-9 w-9 border border-slate-200 bg-white">
                                                            <AvatarFallback className="bg-slate-900 text-xs text-white">{activeTwitterChatThread.avatarInitials}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900">{activeTwitterChatThread.title}</p>
                                                            <p className="text-xs text-slate-500">{activeTwitterChatThread.handle}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className={cn("text-[10px]", activeTwitterChatThread.source === "mock" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>
                                                        {activeTwitterChatThread.source === "mock" ? "Preview" : "Live"}
                                                    </Badge>
                                                </div>

                                                <div className="scrollbar-hide flex-1 space-y-2 overflow-y-auto px-4 py-3">
                                                    {activeTwitterChatThread.messages.map((message) => (
                                                        <div key={message.id} className={cn("flex", message.direction === "outbound" ? "justify-end" : "justify-start")}>
                                                            <div
                                                                className={cn(
                                                                    "max-w-[82%] rounded-xl px-3 py-2",
                                                                    message.direction === "outbound"
                                                                        ? "bg-slate-900 text-white"
                                                                        : "border border-slate-200 bg-slate-50 text-slate-900",
                                                                )}
                                                            >
                                                                <p className="text-sm leading-5">{message.text}</p>
                                                                <p className={cn("mt-1 text-[11px]", message.direction === "outbound" ? "text-white/70" : "text-slate-500")}>
                                                                    {message.senderName} · {formatRelativeTime(message.timestamp)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="border-t border-slate-200 px-4 py-3">
                                                    <textarea
                                                        value={state.messageText}
                                                        onChange={(event) => onChange({ messageText: event.target.value })}
                                                        placeholder="Type a direct message..."
                                                        className="min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                                                    />
                                                    <div className="mt-2 flex items-center justify-between gap-2">
                                                        <p className="text-xs text-slate-500">{activeTwitterChatThread.source === "mock" ? "Preview chat loaded. Messages update locally and will switch to API threads automatically later." : "Live thread loaded from inbox data."}</p>
                                                        <Button
                                                            type="button"
                                                            className="rounded-full bg-black px-4 text-white hover:bg-slate-900"
                                                            onClick={() => void handleTwitterChatSend()}
                                                            disabled={!state.messageText.trim()}
                                                        >
                                                            {activeTwitterChatThread.source === "mock" ? "Send Preview" : "Send"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                                                <MessageCircle className="mb-3 h-12 w-12 text-slate-400" />
                                                <p className="text-xl font-semibold text-slate-900">Select a Conversation</p>
                                                <p className="mt-1.5 text-sm text-slate-500">Choose a thread from the left to preview messages.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {twitterSurface === "notifications" && (
                            <>
                                <div className="border-b border-slate-200 px-4 py-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-xl font-semibold text-slate-900">Notifications</h3>
                                        <Badge variant="secondary" className={cn("text-[11px]", twitterNotificationUnreadCount > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600")}>
                                            {twitterNotificationUnreadCount} unread
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">Recent Twitter message and publish activity from your connected workspace.</p>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-slate-300"
                                            onClick={() => void loadTwitterNotifications(false)}
                                            disabled={twitterNotificationsLoading}
                                        >
                                            <RefreshCw className="mr-1 h-4 w-4" />
                                            Refresh
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-slate-300"
                                            onClick={() => void handleTwitterMarkAllRead()}
                                            disabled={twitterNotificationsMarkingRead || twitterNotificationUnreadCount === 0}
                                        >
                                            Mark all read
                                        </Button>

                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                            {twitterNotificationsData?.summary.totalCount || 0} total
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-2.5 p-3">
                                    {twitterNotificationsLoading && (
                                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Loading Twitter notifications...</p>
                                    )}

                                    {twitterNotificationsError && (
                                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{twitterNotificationsError}</p>
                                    )}

                                    {!twitterNotificationsLoading && !twitterNotificationsError && twitterNotificationItems.length === 0 && (
                                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                                            No notifications available yet.
                                        </p>
                                    )}

                                    {twitterNotificationItems.map((item) => (
                                        <article
                                            key={item.id}
                                            className={cn(
                                                "rounded-xl border border-slate-200 bg-white p-3",
                                                item.unread && "border-blue-200 bg-blue-50/30",
                                            )}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Badge variant="secondary" className={cn("text-[10px]", item.unread ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700")}>
                                                        {item.unread ? "Unread" : "Read"}
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            "text-[10px]",
                                                            item.status === "failed"
                                                                ? "bg-red-100 text-red-700"
                                                                : item.status === "pending"
                                                                    ? "bg-amber-100 text-amber-700"
                                                                    : "bg-emerald-100 text-emerald-700",
                                                        )}
                                                    >
                                                        {item.status}
                                                    </Badge>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px]">
                                                        {item.direction === "OUTBOUND" ? "Publish" : "Inbox"}
                                                    </Badge>
                                                </div>
                                                <p className="text-[11px] text-slate-500">{formatRelativeTime(item.timestamp)}</p>
                                            </div>

                                            <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                                            <p className="mt-1 text-sm text-slate-600">{item.description || "No description"}</p>

                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 rounded-full border-slate-300 text-xs"
                                                    onClick={() => {
                                                        if (item.unread) {
                                                            void handleTwitterMarkOneRead(item.id);
                                                            return;
                                                        }
                                                        void handleTwitterMarkOneUnread(item.id);
                                                    }}
                                                    disabled={twitterNotificationsPendingId !== null}
                                                >
                                                    {twitterNotificationsPendingId === item.id
                                                        ? "Marking..."
                                                        : item.unread
                                                            ? "Mark read"
                                                            : "Mark unread"}
                                                </Button>

                                                {item.contactName && (
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{item.contactName}</span>
                                                )}

                                                {item.tweetId && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 rounded-full border-slate-300 text-xs"
                                                        onClick={() => {
                                                            setTwitterOpsTweetId(item.tweetId || "");
                                                            setTwitterSurface("home");
                                                        }}
                                                    >
                                                        Use Tweet ID
                                                    </Button>
                                                )}

                                                {item.url && (
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center text-xs font-medium text-blue-600 hover:underline"
                                                    >
                                                        Open on X
                                                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </>
                        )}

                        {twitterSurface === "lists" && (
                            <>
                                <div className="border-b border-slate-200 px-4 py-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-xl font-semibold text-slate-900">Lists</h3>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[11px]">
                                            {twitterListItems.length} available
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">Official lists are shown when available, with smart fallback lists from your activity.</p>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                "text-[11px]",
                                                twitterListsData?.meta?.officialAvailable
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-blue-100 text-blue-700",
                                            )}
                                        >
                                            {twitterListsData?.meta?.officialAvailable ? "Official + Smart" : "Smart Lists"}
                                        </Badge>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-slate-300"
                                            onClick={() => void loadTwitterLists()}
                                            disabled={twitterListsLoading}
                                        >
                                            <RefreshCw className="mr-1 h-4 w-4" />
                                            Refresh
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2.5 p-3">
                                    {twitterListsLoading && (
                                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Loading Twitter lists...</p>
                                    )}

                                    {twitterListsError && (
                                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{twitterListsError}</p>
                                    )}

                                    {twitterListsWarning && !twitterListsError && (
                                        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">{twitterListsWarning}</p>
                                    )}

                                    {!twitterListsLoading && !twitterListsError && twitterListItems.length === 0 && (
                                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                                            No lists available yet.
                                        </p>
                                    )}

                                    {twitterListItems.map((list) => (
                                        <article key={list.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-900">{list.name}</p>
                                                <div className="flex items-center gap-1.5">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            "text-[10px]",
                                                            list.source === "official" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700",
                                                        )}
                                                    >
                                                        {list.source}
                                                    </Badge>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px]">
                                                        {list.tweetCount} tweets
                                                    </Badge>
                                                </div>
                                            </div>

                                            <p className="mt-1 text-sm text-slate-600">{list.description || "No description"}</p>

                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                <span>{formatCompactCount(list.memberCount)} members</span>
                                                <span>•</span>
                                                <span>{formatCompactCount(list.subscriberCount)} subscribers</span>
                                                <span>•</span>
                                                <span>{list.updatedAt ? `Updated ${formatRelativeTime(list.updatedAt)}` : "Recently updated"}</span>
                                            </div>

                                            {list.samples.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {list.samples.slice(0, 4).map((sample, index) => (
                                                        <span key={`${list.id}-sample-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                                            {sample}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 rounded-full border-slate-300 text-xs"
                                                    onClick={() => {
                                                        const nextTweetId = list.previewTweetIds[0];
                                                        if (!nextTweetId) {
                                                            toast.info("This list has no tweet IDs yet.");
                                                            return;
                                                        }
                                                        setTwitterOpsTweetId(nextTweetId);
                                                        setTwitterSurface("home");
                                                        setTwitterActionResult(`Loaded ${list.name} into tweet actions.`);
                                                    }}
                                                >
                                                    Use in Actions
                                                </Button>

                                                {list.url && (
                                                    <a
                                                        href={list.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center text-xs font-medium text-blue-600 hover:underline"
                                                    >
                                                        Open List
                                                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </>
                        )}

                        {twitterSurface === "profile" && (
                            <>
                                <div className="h-44 bg-slate-300/80" />

                                <div className="border-b border-slate-200 px-4 pb-4">
                                    <div className="-mt-14 flex items-start justify-between gap-3">
                                        <Avatar className="h-28 w-28 border-4 border-white bg-white">
                                            <AvatarImage src={liveTwitterAvatarUrl || undefined} alt={liveTwitterDisplayName} />
                                            <AvatarFallback className="bg-slate-900 text-2xl text-white">{liveTwitterDisplayName.slice(0, 1).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <Button type="button" variant="outline" className="mt-16 rounded-full border-slate-300" onClick={onOpenConnect}>
                                            {isConnected ? "Edit profile" : "Connect profile"}
                                        </Button>
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-2xl font-bold text-slate-900">{liveTwitterDisplayName}</p>
                                        <p className="text-sm text-slate-500">@{liveTwitterUsername || "twitter"}</p>
                                    </div>

                                    <p className="mt-2 text-sm text-slate-600">Joined {profileJoinedLabel}</p>

                                    <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                                        <p><span className="font-semibold text-slate-900">{followingCount || state.savedRecipients.length || 0}</span> Following</p>
                                        <p><span className="font-semibold text-slate-900">{followersCount}</span> Followers</p>
                                        <p><span className="font-semibold text-slate-900">{tweetCount || effectiveTwitterTimeline.length}</span> Posts</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 border-b border-slate-200 text-sm">
                                    {profileTabOptions.map((tab) => {
                                        const active = twitterProfileTab === tab.key;
                                        return (
                                            <button
                                                key={tab.key}
                                                type="button"
                                                onClick={() => setTwitterProfileTab(tab.key)}
                                                className={cn(
                                                    "py-3 transition",
                                                    active
                                                        ? "border-b-2 border-sky-500 font-semibold text-slate-900"
                                                        : "text-slate-500 hover:text-slate-700",
                                                )}
                                            >
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="divide-y divide-slate-200">
                                    {profileTimelineItems.length === 0 && (
                                        <div className="p-8 text-center text-sm text-slate-500">No items available for {twitterProfileTab} yet.</div>
                                    )}
                                    {profileTimelineItems.map((tweet, index) => renderTimelineCard(tweet, index, true))}
                                </div>
                            </>
                        )}
                    </section>

                    <aside className="h-full space-y-3 border-l border-slate-300/80 bg-slate-100/85 p-3">
                        <Card className="gap-2 border-slate-300 bg-white py-2 shadow-sm">
                            <CardHeader className="px-4 py-1">
                                <CardTitle className="text-base">X Account Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 px-4 pb-1 pt-0">
                                <div className="flex flex-wrap gap-1.5">
                                    <Badge
                                        variant="secondary"
                                        className={cn("text-[11px]", twitterCapabilities?.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}
                                    >
                                        {twitterCapabilities?.connected ? "Connected" : twitterCapabilities?.auth?.hasIdentity ? "Reconnect Needed" : "Disconnected"}
                                    </Badge>
                                    <Badge variant="secondary" className={cn("text-[11px]", twitterCapabilities?.tokenHealthy ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                        {twitterCapabilities?.tokenHealthy ? "Token Healthy" : "Token Missing"}
                                    </Badge>
                                    <Badge variant="secondary" className={cn("text-[11px]", twitterCapabilities?.refreshAvailable ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600")}>
                                        {twitterCapabilities?.refreshAvailable ? "Refresh Ready" : "No Refresh"}
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-full border-slate-300"
                                        onClick={onOpenConnect}
                                    >
                                        {twitterCapabilities?.auth?.hasIdentity ? "Reconnect" : "Connect"}
                                    </Button>
                                    {(twitterCapabilities?.auth?.hasIdentity || Boolean(resolvedAccountId)) && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={onDisconnect}
                                        >
                                            Disconnect
                                        </Button>
                                    )}
                                </div>

                                {twitterProfileLoading && (
                                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Loading X profile from /api/twitter/me...</p>
                                )}
                                {twitterProfileError && (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{twitterProfileError}</p>
                                )}

                                {!twitterProfileLoading && !twitterProfileError && (
                                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Display name</span>
                                            <span className="font-semibold text-slate-900">{liveTwitterDisplayName}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Handle</span>
                                            <span className="font-semibold text-slate-900">@{liveTwitterUsername || "twitter"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Tweets loaded</span>
                                            <span className="font-semibold text-slate-900">{twitterDigest.posts}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Total engagements</span>
                                            <span className="font-semibold text-slate-900">{formatCompactCount(twitterDigest.likes + twitterDigest.retweets + twitterDigest.replies)}</span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-slate-300 bg-white shadow-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                    <CardTitle className="text-base">Today's News</CardTitle>
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[11px] uppercase">
                                        Live
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2.5 pt-0">
                                {todayNewsError && (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{todayNewsError}</p>
                                )}

                                {todayNewsLoading && todayNewsItems.length === 0 && (
                                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Fetching today news headlines...</p>
                                )}

                                {!todayNewsLoading && todayNewsItems.length === 0 && !todayNewsError && (
                                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No headlines available right now.</p>
                                )}

                                <div className="scrollbar-hide max-h-96 space-y-2 overflow-y-auto pr-1">
                                    {todayNewsItems.map((item) => (
                                        <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group inline-flex items-start gap-1.5 text-sm font-semibold leading-5 text-slate-900 hover:text-blue-700"
                                            >
                                                <span className="line-clamp-2">{item.title}</span>
                                                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-blue-700" />
                                            </a>

                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{item.source}</span>
                                                <span>by @{item.author}</span>
                                                <span>•</span>
                                                <span>{formatRelativeTime(item.publishedAt)}</span>
                                            </div>

                                            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{formatCompactCount(item.score)} points</Badge>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">{formatCompactCount(item.comments)} comments</Badge>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                    </aside>
                </div>

            </div>
        );
    }

    return (
        <div className={cn("space-y-4", isTwitter && "space-y-3")}>
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

            {!isTwitter && (
                <Card className="gap-3 border-slate-200 bg-white py-4">
                    <CardHeader className="px-4 pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                            <span className="capitalize">{channel} Control Panel</span>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className={cn("text-xs", isConnected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                    {isConnected ? "Connected" : "Disconnected"}
                                </Badge>
                                <Button
                                    onClick={onOpenConnect}
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 border-slate-300"
                                    aria-label={`${channelLabel(channel)} settings`}
                                    title={`${channelLabel(channel)} settings`}
                                >
                                    <Settings className="h-4 w-4" />
                                </Button>
                                <Button onClick={onRefresh} variant="outline" size="sm" className="border-slate-300" disabled={!isConnected}>
                                    <RefreshCw className="mr-1 h-4 w-4" />
                                    Refresh
                                </Button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                            {isConnected ? (
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium text-slate-700">Connected account ID</span>
                                    <code className="rounded-md bg-white px-2 py-1 text-xs text-slate-600">{resolvedAccountId || "-"}</code>
                                </div>
                            ) : (
                                <p className="text-slate-600">
                                    Channel is disconnected. Click settings to connect and bind account.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className={cn("grid gap-4 lg:grid-cols-[1.5fr_1fr]", isTwitter && "gap-3 lg:grid-cols-[1.35fr_1fr]")}>
                <Card className={cn("border-slate-200 bg-white", isTwitter && "shadow-xs")}>
                    <CardHeader className={cn(isTwitter && "pb-2")}>
                        <CardTitle className="text-base">{isInstagram ? "Create Post or Reel" : isLinkedIn ? "Create LinkedIn Post" : "Create Tweet"}</CardTitle>
                    </CardHeader>
                    <CardContent className={cn("space-y-3", isTwitter && "space-y-2.5 pt-0")}>
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
                            className={cn(
                                "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2",
                                isTwitter ? "min-h-24" : "min-h-32",
                            )}
                            placeholder={isLinkedIn ? "Write a professional update..." : isTwitter ? "What is happening?" : "Write your caption..."}
                        />
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{isTwitter ? "Tweets are limited to 280 characters" : "Draft supports long-form content"}</span>
                            <span className={cn(isTwitter && postCount > postLimit ? "text-red-600" : "")}>{postCount}/{postLimit}</span>
                        </div>
                        {supportsMediaComposer && (
                            renderMediaComposer()
                        )}
                        <Button onClick={onPublish} className="rounded-xl bg-black text-white hover:bg-slate-900" disabled={!state.postText.trim() || !isConnected}>
                            <SendHorizontal className="mr-2 h-4 w-4" />
                            {isInstagram ? `Publish ${state.postMode}` : isLinkedIn ? "Publish to LinkedIn" : "Publish Tweet"}
                        </Button>
                    </CardContent>
                </Card>

                <div className={cn("space-y-4", isTwitter && "space-y-3")}>
                    {isTwitter && (
                        <Card className="border-slate-200 bg-white shadow-xs">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Twitter Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2.5 pt-0">
                                <div className="flex flex-wrap gap-1.5">
                                    <Badge variant="secondary" className={cn("text-[11px]", twitterCapabilities?.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                        {twitterCapabilities?.connected ? "Connected" : "Disconnected"}
                                    </Badge>
                                    <Badge variant="secondary" className={cn("text-[11px]", twitterCapabilities?.tokenHealthy ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                        {twitterCapabilities?.tokenHealthy ? "Token Healthy" : "Token Check Needed"}
                                    </Badge>
                                    <Badge variant="secondary" className={cn("text-[11px]", twitterCapabilities?.refreshAvailable ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600")}>
                                        {twitterCapabilities?.refreshAvailable ? "Refresh Ready" : "No Refresh"}
                                    </Badge>
                                </div>

                                <Input
                                    value={twitterOpsTweetId}
                                    onChange={(event) => setTwitterOpsTweetId(event.target.value)}
                                    placeholder="Tweet ID"
                                    className="border-slate-200"
                                />

                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-300"
                                        onClick={() => void handleTwitterReadById()}
                                        disabled={twitterActionLoading !== null || !isConnected || twitterCapabilities?.operations?.readTweetById === false}
                                    >
                                        Read by ID
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-300"
                                        onClick={() => void handleTwitterDelete()}
                                        disabled={twitterActionLoading !== null || !isConnected || twitterCapabilities?.operations?.deleteTweet === false}
                                    >
                                        Delete Tweet
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-300"
                                        onClick={() => void handleTwitterLike("like")}
                                        disabled={twitterActionLoading !== null || !isConnected || twitterCapabilities?.operations?.likeUnlike === false}
                                    >
                                        Like
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-300"
                                        onClick={() => void handleTwitterLike("unlike")}
                                        disabled={twitterActionLoading !== null || !isConnected || twitterCapabilities?.operations?.likeUnlike === false}
                                    >
                                        Unlike
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-300"
                                        onClick={() => void handleTwitterRetweet("retweet")}
                                        disabled={twitterActionLoading !== null || !isConnected || twitterCapabilities?.operations?.retweetUnretweet === false}
                                    >
                                        Retweet
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-300"
                                        onClick={() => void handleTwitterRetweet("unretweet")}
                                        disabled={twitterActionLoading !== null || !isConnected || twitterCapabilities?.operations?.retweetUnretweet === false}
                                    >
                                        Unretweet
                                    </Button>
                                </div>

                                <textarea
                                    value={twitterReplyText}
                                    onChange={(event) => setTwitterReplyText(event.target.value)}
                                    className="min-h-18 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                                    placeholder="Reply text..."
                                />
                                <Button
                                    type="button"
                                    className="w-full rounded-xl bg-black text-white hover:bg-slate-900"
                                    onClick={() => void handleTwitterReply()}
                                    disabled={twitterActionLoading !== null || !isConnected || twitterCapabilities?.operations?.reply === false}
                                >
                                    Reply to Tweet
                                </Button>

                                {twitterActionResult && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                        {twitterActionResult}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card className={cn("border-slate-200 bg-white", isTwitter && "shadow-xs")}>
                        <CardHeader className={cn(isTwitter && "pb-2")}>
                            <CardTitle className="text-base">{isTwitter ? "Direct Message (Unavailable)" : "Direct Message"}</CardTitle>
                        </CardHeader>
                        <CardContent className={cn("space-y-3", isTwitter && "space-y-2.5 pt-0")}>
                            {isTwitter ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                    Twitter direct messaging is currently disabled in this integration. Posting and profile sync are supported via OAuth token.
                                </div>
                            ) : (
                                <>
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
                                        className={cn(
                                            "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2",
                                            isTwitter ? "min-h-20" : "min-h-24",
                                        )}
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
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
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

            <div className={cn("grid gap-4 lg:grid-cols-2", isTwitter && "gap-3")}>
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
    const updates = overview?.updates || [];
    const hasSourceActivity = (source: "email" | "instagram" | "linkedin" | "twitter") =>
        updates.some((item) => item.source === source);

    const sourceConnectionStatus = {
        email:
            Boolean(overview?.connections.gmail)
            || Boolean(overview?.gmail.email)
            || (overview?.gmail.totalEmails || 0) > 0
            || hasSourceActivity("email"),
        instagram:
            Boolean(overview?.connections.instagram)
            || Boolean(overview?.socialAccounts?.instagram)
            || (overview?.recipients?.instagram?.length || 0) > 0
            || overview?.connectionMeta?.instagram?.status === "connected"
            || hasSourceActivity("instagram"),
        linkedin:
            Boolean(overview?.connections.linkedin)
            || Boolean(overview?.socialAccounts?.linkedin)
            || (overview?.recipients?.linkedin?.length || 0) > 0
            || overview?.connectionMeta?.linkedin?.status === "connected"
            || hasSourceActivity("linkedin"),
        twitter:
            Boolean(overview?.connections.twitter)
            || Boolean(overview?.socialAccounts?.twitter)
            || (overview?.recipients?.twitter?.length || 0) > 0
            || overview?.connectionMeta?.twitter?.status === "connected"
            || hasSourceActivity("twitter"),
    };

    return (
        <ChatWorkspace
            updates={updates}
            onJump={onJump}
            connectionStatus={sourceConnectionStatus}
        />
    );
}

function formatUploadSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadsView({
    assets,
    loading,
    uploading,
    error,
    onUpload,
    onRefresh,
    onDelete,
    onUseForChannel,
    onUseForEmail,
}: {
    assets: UploadAsset[];
    loading: boolean;
    uploading: boolean;
    error: string | null;
    onUpload: (files: File[]) => void;
    onRefresh: () => void;
    onDelete: (asset: UploadAsset) => void;
    onUseForChannel: (asset: UploadAsset, channel: SocialChannel) => void;
    onUseForEmail: (asset: UploadAsset) => void;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [previewAsset, setPreviewAsset] = useState<UploadAsset | null>(null);

    return (
        <div className="mx-auto max-w-6xl space-y-4">
            <Card className="border-slate-200 bg-white">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                        <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Media Uploads</span>
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                    const files = Array.from(event.target.files || []);
                                    if (files.length > 0) {
                                        onUpload(files);
                                    }
                                    event.currentTarget.value = "";
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="border-slate-300"
                                disabled={uploading}
                                onClick={() => inputRef.current?.click()}
                            >
                                {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                                Upload Images
                            </Button>
                            <Button type="button" variant="outline" className="border-slate-300" onClick={onRefresh} disabled={loading}>
                                <RefreshCw className={cn("mr-1 h-4 w-4", loading && "animate-spin")} />
                                Refresh
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                    <p>
                        Upload and keep your image assets here. Reuse them instantly for Instagram/LinkedIn posts or copy links for email sharing.
                    </p>
                    {error && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</p>}
                </CardContent>
            </Card>

            {loading && assets.length === 0 ? (
                <Card className="border-slate-200 bg-white">
                    <CardContent className="flex items-center gap-2 py-10 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading uploaded assets...
                    </CardContent>
                </Card>
            ) : assets.length === 0 ? (
                <Card className="border-slate-200 bg-white">
                    <CardContent className="py-10 text-center text-sm text-slate-500">
                        No images uploaded yet. Click <span className="font-semibold text-slate-700">Upload Images</span> to build your media library.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {assets.map((asset) => (
                        <Card key={asset.id} className="overflow-hidden border-slate-200 bg-white">
                            <div className="relative h-44 w-full overflow-hidden bg-slate-100 sm:h-48">
                                <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />
                                <div className="absolute right-2 top-2 flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        aria-label={`View full resolution ${asset.name}`}
                                        title="View full resolution"
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-black/65 text-white transition hover:bg-black"
                                        onClick={() => setPreviewAsset(asset)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </button>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label={`Share ${asset.name}`}
                                                title="Share"
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-black/65 text-white transition hover:bg-black"
                                            >
                                                <ArrowUpRight className="h-4 w-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44 border-slate-200 bg-white">
                                            <DropdownMenuItem onClick={() => onUseForChannel(asset, "instagram")}>Share to Instagram</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onUseForChannel(asset, "linkedin")}>Share to LinkedIn</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onUseForChannel(asset, "twitter")}>Share to Twitter/X</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => onUseForEmail(asset)}>Use in Mail</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <button
                                        type="button"
                                        aria-label={`Delete ${asset.name}`}
                                        title="Delete"
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-rose-600/90 text-white transition hover:bg-rose-700"
                                        onClick={() => onDelete(asset)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <CardContent className="min-h-18 p-3">
                                <div>
                                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">{asset.name}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">{formatUploadSize(asset.size)}</Badge>
                                        <span>{formatRelativeTime(asset.createdAt)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog
                open={Boolean(previewAsset)}
                onOpenChange={(open) => {
                    if (!open) setPreviewAsset(null);
                }}
            >
                <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-slate-200 bg-white p-0">
                    {previewAsset ? (
                        <div className="flex max-h-[92vh] flex-col">
                            <DialogHeader className="border-b border-slate-200 px-4 py-3">
                                <DialogTitle className="line-clamp-1 pr-6 text-sm text-slate-900">{previewAsset.name}</DialogTitle>
                                <DialogDescription className="text-xs text-slate-500">
                                    {formatUploadSize(previewAsset.size)} · {formatRelativeTime(previewAsset.createdAt)}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-auto bg-slate-950 p-4">
                                <img
                                    src={previewAsset.url}
                                    alt={previewAsset.name}
                                    className="mx-auto h-auto max-h-[74vh] w-auto max-w-full object-contain"
                                />
                            </div>

                            <DialogFooter className="border-t border-slate-200 px-4 py-3">
                                <a
                                    href={previewAsset.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                    Open Original
                                </a>
                            </DialogFooter>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
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
        const max = entries.reduce((acc, [, raw]) => Math.max(acc, Number(raw) || 0), 1);
        return entries
            .map(([name, raw]) => ({ name, value: Number(raw) || 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
            .map(({ name, value }) => ({
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
    const [chatbotOpenSignal, setChatbotOpenSignal] = useState(0);
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
    const [headerUser, setHeaderUser] = useState<{ id: string; name: string | null; email: string } | null>(null);
    const [headerPreferences, setHeaderPreferences] = useState<DashboardHeaderPreferences>(DEFAULT_DASHBOARD_HEADER_PREFERENCES);
    const [settingsDraft, setSettingsDraft] = useState<DashboardHeaderPreferences>(DEFAULT_DASHBOARD_HEADER_PREFERENCES);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);
    const [isHeaderPreferencesLoaded, setIsHeaderPreferencesLoaded] = useState(false);
    const [didApplyDefaultSection, setDidApplyDefaultSection] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    const [uploadedAssets, setUploadedAssets] = useState<UploadAsset[]>([]);
    const [isUploadsLoading, setIsUploadsLoading] = useState(false);
    const [isUploadingAssets, setIsUploadingAssets] = useState(false);
    const [uploadsError, setUploadsError] = useState<string | null>(null);

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
    const jiraProjectsInFlightRef = useRef(false);
    const jiraProjectsLastAttemptAtRef = useRef(0);

    const fetchHeaderContext = useCallback(async () => {
        try {
            const response = await fetch("/api/dashboard/preferences", { cache: "no-store" });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to load dashboard preferences"));
            }

            const normalized = normalizeDashboardHeaderPreferences(payload?.preferences);
            setHeaderPreferences(normalized);
            setSettingsDraft(normalized);

            const userPayload = payload?.user && typeof payload.user === "object"
                ? (payload.user as Record<string, unknown>)
                : null;

            if (userPayload) {
                const id = readValue(userPayload.id, "");
                const email = readValue(userPayload.email, "");
                const nameValue = userPayload.name;
                const name = typeof nameValue === "string" ? nameValue : null;
                if (id && email) {
                    setHeaderUser({ id, email, name });
                }
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load dashboard preferences");
        } finally {
            setIsHeaderPreferencesLoaded(true);
        }
    }, []);

    const saveHeaderPreferences = useCallback(async (next: DashboardHeaderPreferences, successMessage?: string) => {
        setIsPreferencesSaving(true);
        try {
            const response = await fetch("/api/dashboard/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(next),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to save dashboard preferences"));
            }

            const normalized = normalizeDashboardHeaderPreferences(payload?.preferences);
            setHeaderPreferences(normalized);
            setSettingsDraft(normalized);
            if (successMessage) {
                toast.success(successMessage);
            }
            return normalized;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save dashboard preferences");
            return null;
        } finally {
            setIsPreferencesSaving(false);
        }
    }, []);

    const handleLogout = useCallback(async () => {
        setIsLoggingOut(true);
        try {
            const response = await fetch("/api/auth/logout", { method: "POST" });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to logout"));
            }
            window.location.href = "/login";
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to logout");
        } finally {
            setIsLoggingOut(false);
        }
    }, []);

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

    const fetchJiraProjects = async (force = false, silent = false) => {
        if (!agentId) return;

        const now = Date.now();
        const minGapMs = 45000;
        if (!force && now - jiraProjectsLastAttemptAtRef.current < minGapMs) {
            return;
        }
        if (jiraProjectsInFlightRef.current) {
            return;
        }

        jiraProjectsInFlightRef.current = true;
        jiraProjectsLastAttemptAtRef.current = now;

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
            if (!silent) {
                toast.error(error instanceof Error ? error.message : "Unable to load Jira projects");
            }
            setJiraProjects([]);
        } finally {
            jiraProjectsInFlightRef.current = false;
            setIsJiraProjectsLoading(false);
        }
    };

    useEffect(() => {
        void fetchHeaderContext();
    }, [fetchHeaderContext]);

    useEffect(() => {
        void fetchDashboardOverview();
        void fetchDashboardInsights();
    }, []);

    useEffect(() => {
        if (!isHeaderPreferencesLoaded || didApplyDefaultSection) return;

        const hasConnectionRedirect = Boolean(searchParams.get("connect") || searchParams.get("platform"));
        if (hasConnectionRedirect) {
            setDidApplyDefaultSection(true);
            return;
        }

        if (activeSection === "workspace" && headerPreferences.workspace.defaultSection !== "workspace") {
            setActiveSection(headerPreferences.workspace.defaultSection);
        }

        setDidApplyDefaultSection(true);
    }, [
        activeSection,
        didApplyDefaultSection,
        headerPreferences.workspace.defaultSection,
        isHeaderPreferencesLoaded,
        searchParams,
    ]);

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
        if (activeSection === "instagram" || activeSection === "linkedin" || activeSection === "twitter") {
            return activeSection;
        }
        return null;
    }, [activeSection]);

    const fetchChannelData = async (channel: SocialChannel) => {
        const accountId = channelState[channel].accountId;

        setChannelData((prev) => ({
            ...prev,
            [channel]: { ...prev[channel], loading: true, error: null },
        }));

        try {
            if (channel === "twitter") {
                const shouldLoadSnapshot = Boolean((accountId || "").trim());
                const [historyRes, snapshotRes, unipileRes] = await Promise.all([
                    fetch("/api/twitter/history", { cache: "no-store" }),
                    shouldLoadSnapshot
                        ? fetch("/api/twitter/live-snapshot?max_results=16", { cache: "no-store" })
                        : Promise.resolve(null),
                    fetch(`/api/unipile/feed?platform=twitter&accountId=${encodeURIComponent(accountId || "")}`, { cache: "no-store" }),
                ]);

                const history = historyRes.ok ? await historyRes.json() : [];
                const snapshotPayload = snapshotRes && snapshotRes.ok ? await snapshotRes.json() : null;
                const unipileData = await unipileRes.json().catch(() => null);
                const unipilePosts = Array.isArray(unipileData?.posts) ? unipileData.posts : [];
                const unipileInbox = Array.isArray(unipileData?.inbox) ? unipileData.inbox : [];
                const unipileComments = Array.isArray(unipileData?.comments) ? unipileData.comments : [];

                const snapshotRecentTweets = Array.isArray(snapshotPayload?.snapshot?.recentTweets)
                    ? snapshotPayload.snapshot.recentTweets
                    : [];

                const snapshotPosts = snapshotRecentTweets.map((item: Record<string, unknown>, index: number) => {
                    const id = readValue(item.id, `snapshot-${index + 1}`);
                    return {
                        id,
                        text: readValue(item.text, "No content"),
                        created_at: readValue(item.timestamp, new Date().toISOString()),
                        public_metrics: {
                            reply_count: Number(item.replyCount) || 0,
                            retweet_count: Number(item.retweetCount) || 0,
                            like_count: Number(item.likeCount) || 0,
                            quote_count: 0,
                            impression_count: 0,
                        },
                        lang: "en",
                    };
                });

                const mergedPosts = Array.isArray(history) && history.length > 0
                    ? history
                    : snapshotPosts.length > 0
                        ? snapshotPosts
                        : Array.isArray(history)
                            ? history
                            : Array.isArray(unipilePosts)
                                ? unipilePosts
                                : [];

                let twitterError: string | null = null;
                if (!historyRes.ok && (!snapshotRes || !snapshotRes.ok) && !unipileRes.ok) {
                    twitterError = "Failed to load Twitter timeline and inbox";
                } else if (shouldLoadSnapshot && !historyRes.ok && snapshotRes && !snapshotRes.ok) {
                    twitterError = "Failed to load Twitter timeline from history/snapshot";
                }

                setChannelData((prev) => ({
                    ...prev,
                    twitter: {
                        loading: false,
                        error: twitterError,
                        inbox: unipileInbox,
                        comments: unipileComments,
                        posts: mergedPosts,
                        meta: snapshotPayload && typeof snapshotPayload === "object" && (snapshotPayload as Record<string, unknown>).meta && typeof (snapshotPayload as Record<string, unknown>).meta === "object"
                            ? ((snapshotPayload as Record<string, unknown>).meta as Record<string, unknown>)
                            : null,
                    },
                }));
                return;
            }

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
                    meta: null,
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

    const fetchUploads = useCallback(async () => {
        setIsUploadsLoading(true);
        setUploadsError(null);
        try {
            const response = await fetch("/api/uploads", { cache: "no-store" });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to load uploads"));
            }

            const items = Array.isArray(payload?.items) ? payload.items : [];
            setUploadedAssets(items as UploadAsset[]);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load uploads";
            setUploadsError(message);
        } finally {
            setIsUploadsLoading(false);
        }
    }, []);

    const handleUploadAssets = useCallback(async (files: File[]) => {
        if (files.length === 0) return;

        setIsUploadingAssets(true);
        setUploadsError(null);

        try {
            const formData = new FormData();
            files.forEach((file) => formData.append("files", file, file.name));

            const response = await fetch("/api/uploads", {
                method: "POST",
                body: formData,
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Upload failed"));
            }

            toast.success(files.length === 1 ? "Image uploaded" : `${files.length} images uploaded`);
            await fetchUploads();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to upload images";
            setUploadsError(message);
            toast.error(message);
        } finally {
            setIsUploadingAssets(false);
        }
    }, [fetchUploads]);

    const handleDeleteUpload = useCallback(async (asset: UploadAsset) => {
        try {
            const response = await fetch(`/api/uploads?id=${encodeURIComponent(asset.id)}`, {
                method: "DELETE",
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readValue(payload?.error, "Failed to delete image"));
            }

            setUploadedAssets((prev) => prev.filter((item) => item.id !== asset.id));
            toast.success("Image removed");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete image");
        }
    }, []);

    const handleUseUploadForChannel = useCallback(async (asset: UploadAsset, channel: SocialChannel) => {
        try {
            const response = await fetch(asset.url, { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Could not fetch asset file");
            }

            const blob = await response.blob();
            const mimeType = blob.type || asset.mimeType || "image/jpeg";
            const file = new File([blob], asset.name, { type: mimeType });

            setChannelState((prev) => ({
                ...prev,
                [channel]: {
                    ...prev[channel],
                    mediaUrl: "",
                    mediaFiles: [...prev[channel].mediaFiles, file],
                },
            }));

            setActiveSection(channel);
            toast.success(`${asset.name} added to ${channelLabel(channel)} composer`);
        } catch {
            const absoluteUrl = typeof window !== "undefined"
                ? new URL(asset.url, window.location.origin).toString()
                : asset.url;

            setChannelState((prev) => ({
                ...prev,
                [channel]: {
                    ...prev[channel],
                    mediaUrl: absoluteUrl,
                },
            }));

            setActiveSection(channel);
            toast.info(`Added image URL to ${channelLabel(channel)} composer`);
        }
    }, []);

    const handleUseUploadForEmail = useCallback(async (asset: UploadAsset) => {
        const absoluteUrl = typeof window !== "undefined"
            ? new URL(asset.url, window.location.origin).toString()
            : asset.url;

        const text = `Image link: ${absoluteUrl}`;

        try {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            }
        } catch {
            // Clipboard might be unavailable; still route user to email section.
        }

        setActiveSection("email");
        toast.success("Image link ready for email compose");
    }, []);

    useEffect(() => {
        if (activeSection === "uploads") {
            void fetchUploads();
        }
    }, [activeSection, fetchUploads]);

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
        const connectError = (searchParams.get("error") || "").trim();

        const clearConnectParams = () => {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete("connect");
            currentUrl.searchParams.delete("platform");
            currentUrl.searchParams.delete("account_id");
            currentUrl.searchParams.delete("accountId");
            currentUrl.searchParams.delete("username");
            currentUrl.searchParams.delete("displayName");
            currentUrl.searchParams.delete("error");
            window.history.replaceState({}, "", currentUrl.toString());
        };

        const channel = platform as SocialChannel;

        if (status === "failure") {
            setActiveSection(channel);
            setConnectDialogChannel(channel);
            toast.error(
                connectError
                    ? `${channelLabel(channel)} login failed: ${connectError}`
                    : `${channelLabel(channel)} login failed. Please try connecting again.`,
            );
            clearConnectParams();
            return;
        }

        if (status === "success") {
            setActiveSection(channel);

            if (!accountIdFromQuery) {
                setConnectDialogChannel(channel);
                toast.error(
                    connectError
                        ? `${channelLabel(channel)} OAuth completed, but identity was not returned: ${connectError}`
                        : `${channelLabel(channel)} OAuth completed, but profile identity was not returned. Please reconnect.`,
                );
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
        if (channel === "twitter") {
            window.location.assign("/api/twitter/auth");
            return;
        }

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

        if (connectDialogChannel === "twitter") {
            toast.error("Twitter connection is OAuth-managed. Use Open Provider Login to connect or reconnect.");
            return;
        }

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

    const handleDisconnectDirect = async (channel: SocialChannel) => {
        const label = channelLabel(channel);
        if (typeof window !== "undefined" && !window.confirm(`Disconnect ${label}?`)) {
            return;
        }

        try {
            const response = await fetch("/api/social-connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel,
                    accountId: "",
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(readValue(data?.error, "Failed to disconnect"));
            }

            updateChannelState(channel, { accountId: "" });
            setChannelData((prev) => ({
                ...prev,
                [channel]: defaultChannelData(),
            }));
            toast.success("Disconnected successfully");
            await fetchDashboardOverview();
            await fetchDashboardInsights();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Disconnect failed");
        }
    };

    const notificationItems = useMemo(() => dashboardOverview?.updates || [], [dashboardOverview?.updates]);

    const unreadNotificationIds = useMemo(() => {
        const ids = new Set<string>();
        const cutoff = headerPreferences.notifications.lastReadAt
            ? new Date(headerPreferences.notifications.lastReadAt).getTime()
            : null;

        notificationItems.forEach((item) => {
            const itemTime = new Date(item.timestamp).getTime();
            const isUnread = cutoff === null || Number.isNaN(itemTime) || itemTime > cutoff;
            if (isUnread) {
                ids.add(item.id);
            }
        });

        return ids;
    }, [headerPreferences.notifications.lastReadAt, notificationItems]);

    const visibleNotifications = useMemo(() => {
        const base = headerPreferences.notifications.showOnlyUnread
            ? notificationItems.filter((item) => unreadNotificationIds.has(item.id))
            : notificationItems;

        return base.slice(0, 80);
    }, [headerPreferences.notifications.showOnlyUnread, notificationItems, unreadNotificationIds]);

    const unreadNotificationsCount = unreadNotificationIds.size;

    const handleMarkAllNotificationsRead = async () => {
        const next: DashboardHeaderPreferences = {
            ...headerPreferences,
            notifications: {
                ...headerPreferences.notifications,
                lastReadAt: new Date().toISOString(),
            },
        };

        await saveHeaderPreferences(next, "All notifications marked as read");
    };

    const handleSaveSettings = async () => {
        const saved = await saveHeaderPreferences(settingsDraft, "Dashboard settings saved");
        if (saved) {
            setIsSettingsOpen(false);
        }
    };

    const handleOpenChannelConnectionSettings = (channel: SocialChannel) => {
        setIsSettingsOpen(false);
        handleOpenConnectDialog(channel);
    };

    const handleCopyUserId = useCallback(async () => {
        const userIdValue = headerUser?.id || "";
        if (!userIdValue) {
            toast.error("User ID is unavailable");
            return;
        }

        try {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(userIdValue);
                toast.success("User ID copied");
                return;
            }

            toast.info(`User ID: ${userIdValue}`);
        } catch {
            toast.info(`User ID: ${userIdValue}`);
        }
    }, [headerUser?.id]);

    const handlePublish = async (channel: SocialChannel) => {
        const current = channelState[channel];

        if (!current.postText.trim()) {
            toast.error("Write content before publishing");
            return;
        }

        if (channel === "instagram" && !current.mediaUrl.trim() && current.mediaFiles.length === 0) {
            toast.error("Instagram requires at least one image URL or uploaded image");
            return;
        }

        try {
            if (channel === "twitter") {
                let threadTweets = Array.isArray(current.threadDraft)
                    ? current.threadDraft.map((item) => String(item || "").trim()).filter(Boolean)
                    : [];

                if (current.postText.trim().length > 280 && threadTweets.length <= 1) {
                    const threadifyRes = await fetch("/api/twitter/threadify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: current.postText.trim() }),
                    });
                    const threadifyPayload = await threadifyRes.json().catch(() => null);
                    if (!threadifyRes.ok) {
                        throw new Error(readValue(threadifyPayload?.error, "Tweet exceeds 280 characters and could not be converted to a thread"));
                    }

                    threadTweets = Array.isArray(threadifyPayload?.tweets)
                        ? threadifyPayload.tweets.map((item: unknown) => String(item || "").trim()).filter(Boolean)
                        : [];

                    if (threadTweets.length > 1) {
                        const preview = threadTweets.map((tweet, index) => `${index + 1}/${threadTweets.length} ${tweet}`).join("\n\n");
                        updateChannelState(channel, {
                            postText: preview,
                            threadDraft: threadTweets,
                        });
                    }
                }

                if (threadTweets.length > 1) {
                    const firstRes = await fetch("/api/twitter/post", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            text: threadTweets[0],
                            title: `Twitter Thread 1/${threadTweets.length}`,
                        }),
                    });

                    const firstPayload = await firstRes.json().catch(() => null);
                    if (!firstRes.ok) {
                        throw new Error(readValue(firstPayload?.error, "Failed to publish first tweet in thread"));
                    }

                    let parentTweetId = readValue(firstPayload?.post?.tweet_id || firstPayload?.post?.id, "").trim();
                    if (!parentTweetId) {
                        throw new Error("Thread publish failed: missing first tweet id");
                    }

                    for (let index = 1; index < threadTweets.length; index += 1) {
                        const replyRes = await fetch(`/api/twitter/tweets/${encodeURIComponent(parentTweetId)}/reply`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: threadTweets[index] }),
                        });

                        const replyPayload = await replyRes.json().catch(() => null);
                        if (!replyRes.ok) {
                            throw new Error(readValue(replyPayload?.error, `Failed to publish thread tweet ${index + 1}`));
                        }

                        const nextTweetId = readValue(replyPayload?.data?.id, "").trim();
                        if (nextTweetId) {
                            parentTweetId = nextTweetId;
                        }
                    }

                    toast.success(`Twitter thread published (${threadTweets.length} tweets)`);
                    updateChannelState(channel, { postText: "", threadDraft: [], mediaUrl: "", mediaFiles: [] });
                    await fetchChannelData(channel);
                    await fetchDashboardOverview();
                    await fetchDashboardInsights();
                    return;
                }

                if (current.postText.trim().length > 280) {
                    toast.error("Tweet exceeds 280 characters");
                    return;
                }

                const twitterRes = await fetch("/api/twitter/post", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: current.postText,
                        title: "Twitter Update",
                    }),
                });

                const twitterPayload = await twitterRes.json();
                if (!twitterRes.ok) {
                    throw new Error(readValue(twitterPayload?.error, "Twitter publish failed"));
                }

                toast.success("TWITTER post published");
                updateChannelState(channel, { postText: "", threadDraft: [], mediaUrl: "", mediaFiles: [] });
                await fetchChannelData(channel);
                await fetchDashboardOverview();
                await fetchDashboardInsights();
                return;
            }

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
            updateChannelState(channel, { postText: "", threadDraft: [], mediaUrl: "", mediaFiles: [] });
            await fetchChannelData(channel);
            await fetchDashboardOverview();
            await fetchDashboardInsights();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Publish failed");
        }
    };

    const handleSendMessage = async (channel: SocialChannel) => {
        if (channel === "twitter") {
            toast.info("Twitter direct messages are not available in the current integration.");
            return;
        }

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
    const chatbotSource = useMemo<ChatAssistantSource>(() => {
        if (activeSection === "instagram" || activeSection === "linkedin" || activeSection === "twitter") {
            return activeSection;
        }

        if (activeSection === "email") {
            return "email";
        }

        return "automation";
    }, [activeSection]);

    const selectedDialogMeta = connectDialogChannel ? dashboardOverview?.connectionMeta?.[connectDialogChannel] : undefined;
    const dialogConnected = Boolean(
        selectedDialogMeta && (
            selectedDialogMeta.status === "connected"
            || Boolean((selectedDialogMeta.accountId || "").trim())
            || Boolean((selectedDialogMeta.username || "").trim())
        ),
    ) || Boolean(connectDialogChannel && channelState[connectDialogChannel].accountId.trim());

    const twitterMeta = dashboardOverview?.connectionMeta?.twitter;
    const twitterAccountId = (twitterMeta?.accountId || channelState.twitter.accountId || "").trim();
    const twitterUsername = (twitterMeta?.username || "").replace(/^@+/, "").trim();
    const twitterDisplayName = (twitterMeta?.displayName || "").trim();
    const twitterProfileName = twitterDisplayName || twitterAccountId || "Twitter Account";
    const twitterAvatarUrl = (twitterMeta?.avatarUrl || "").trim();
    const twitterConnected =
        twitterMeta?.status === "connected"
        || Boolean(twitterAccountId)
        || Boolean(twitterUsername);

    const gmailAccount = (dashboardOverview?.gmail.email || "").trim();
    const gmailConnected = Boolean(dashboardOverview?.connections.gmail) || Boolean(gmailAccount);

    const chatbotVisibleUpdateLines = useMemo(() => {
        return visibleNotifications
            .slice(0, 5)
            .map((item, index) => {
                const normalizedTitle = item.title.replace(/\s+/g, " ").trim();
                const sender = (item.contactName || "").trim();
                return `${index + 1}. [${item.source}] ${normalizedTitle}${sender ? ` | from ${sender}` : ""} | status=${item.status}`;
            });
    }, [visibleNotifications]);

    const chatbotEmailItemLines = useMemo(() => {
        if (activeSection !== "email") return [] as string[];

        return visibleNotifications
            .filter((item) => item.source === "email" || item.platform === "gmail")
            .slice(0, 8)
            .map((item, index) => {
                const normalizedTitle = item.title.replace(/\s+/g, " ").trim();
                const sender = (item.contactName || "Unknown sender").trim();
                return `${index + 1}. Subject: ${normalizedTitle} | From: ${sender} | Status: ${item.status} | Time: ${item.timestamp}`;
            });
    }, [activeSection, visibleNotifications]);

    const chatbotContext = useMemo(() => {
        const activeSectionLabel = NAV_ITEMS.find((item) => item.id === activeSection)?.label || copy.title;
        const connectedChannels = dashboardOverview?.metrics?.connectedChannels;
        const totalChannels = dashboardOverview?.metrics?.totalChannels;

        return [
            `Current page: ${activeSectionLabel} (${activeSection}).`,
            `Page purpose: ${copy.subtitle}.`,
            headerUser?.name || headerUser?.email
                ? `Current user: ${headerUser.name || headerUser.email}.`
                : "",
            activeChannel ? `Active social workspace: ${channelLabel(activeChannel)}.` : "",
            typeof connectedChannels === "number" && typeof totalChannels === "number"
                ? `Channel connectivity: ${connectedChannels}/${totalChannels} connected.`
                : "",
            `Unread notifications: ${unreadNotificationsCount}.`,
            chatbotVisibleUpdateLines.length > 0
                ? `Visible page updates:\n${chatbotVisibleUpdateLines.join("\n")}`
                : "Visible page updates: none.",
            activeSection === "email"
                ? `Email summary: unread=${dashboardOverview?.gmail.unreadEmails || 0}, high_priority=${dashboardOverview?.gmail.highPriorityEmails || 0}.`
                : "",
            activeSection === "email"
                ? (
                    chatbotEmailItemLines.length > 0
                        ? `Email items visible on page:\n${chatbotEmailItemLines.join("\n")}`
                        : "Email items visible on page: none (subject lines not available in current page context)."
                )
                : "",
            twitterConnected && twitterUsername ? `Twitter profile in view: @${twitterUsername}.` : "",
            gmailConnected && gmailAccount ? `Signed-in Gmail account: ${gmailAccount}.` : "",
        ]
            .filter(Boolean)
            .join("\n");
    }, [
        activeChannel,
        activeSection,
        copy.subtitle,
        copy.title,
        dashboardOverview?.metrics?.connectedChannels,
        dashboardOverview?.metrics?.totalChannels,
        dashboardOverview?.gmail.highPriorityEmails,
        dashboardOverview?.gmail.unreadEmails,
        headerUser?.email,
        headerUser?.name,
        chatbotEmailItemLines,
        chatbotVisibleUpdateLines,
        gmailAccount,
        gmailConnected,
        twitterConnected,
        twitterUsername,
        unreadNotificationsCount,
    ]);

    const socialConnectionRows = useMemo(() => {
        const instagramMeta = dashboardOverview?.connectionMeta?.instagram;
        const linkedinMeta = dashboardOverview?.connectionMeta?.linkedin;
        const twitterConnectionMeta = dashboardOverview?.connectionMeta?.twitter;

        const instagramAccount = (instagramMeta?.accountId || channelState.instagram.accountId || "").trim();
        const linkedinAccount = (linkedinMeta?.accountId || channelState.linkedin.accountId || "").trim();
        const twitterAccount = (
            twitterConnectionMeta?.username
            || twitterConnectionMeta?.accountId
            || channelState.twitter.accountId
            || ""
        ).replace(/^@+/, "").trim();

        return [
            {
                channel: "instagram" as SocialChannel,
                label: "Instagram",
                connected: Boolean(dashboardOverview?.connections.instagram) || instagramMeta?.status === "connected" || Boolean(instagramAccount),
                account: instagramAccount,
            },
            {
                channel: "linkedin" as SocialChannel,
                label: "LinkedIn",
                connected: Boolean(dashboardOverview?.connections.linkedin) || linkedinMeta?.status === "connected" || Boolean(linkedinAccount),
                account: linkedinAccount,
            },
            {
                channel: "twitter" as SocialChannel,
                label: "Twitter/X",
                connected: Boolean(dashboardOverview?.connections.twitter) || twitterConnectionMeta?.status === "connected" || Boolean(twitterAccount),
                account: twitterAccount,
            },
        ];
    }, [
        channelState.instagram.accountId,
        channelState.linkedin.accountId,
        channelState.twitter.accountId,
        dashboardOverview?.connectionMeta?.instagram,
        dashboardOverview?.connectionMeta?.linkedin,
        dashboardOverview?.connectionMeta?.twitter,
        dashboardOverview?.connections.instagram,
        dashboardOverview?.connections.linkedin,
        dashboardOverview?.connections.twitter,
    ]);

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
            const activeConnectionMeta = dashboardOverview?.connectionMeta?.[activeChannel];
            const localAccountId = channelState[activeChannel].accountId.trim();
            const connectedFromOverview = activeChannel === "twitter"
                ? Boolean(dashboardOverview?.connections.twitter)
                : activeChannel === "linkedin"
                    ? Boolean(dashboardOverview?.connections.linkedin)
                    : Boolean(dashboardOverview?.connections.instagram);
            const connectedFromMeta = activeConnectionMeta?.status === "connected";
            const isChannelConnected = activeChannel === "twitter"
                ? connectedFromOverview || connectedFromMeta
                : Boolean(localAccountId) || connectedFromOverview || connectedFromMeta;

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
                    onDisconnect={() => void handleDisconnectDirect(activeChannel)}
                    onPublish={() => void handlePublish(activeChannel)}
                    onSendMessage={() => void handleSendMessage(activeChannel)}
                    onAddRecipient={() => void handleAddRecipient(activeChannel)}
                    onSelectRecipient={(recipient) => handleSelectRecipient(activeChannel, recipient)}
                    onRemoveRecipient={(recipient) => void handleRemoveRecipient(activeChannel, recipient)}
                    isConnected={isChannelConnected}
                    connectionMeta={activeConnectionMeta}
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

        if (activeSection === "workspace") return <WorkspaceView overview={dashboardOverview} onJump={setActiveSection} />;
        if (activeSection === "chat") return <ChatView overview={dashboardOverview} onJump={setActiveSection} />;
        if (activeSection === "uploads") {
            return (
                <UploadsView
                    assets={uploadedAssets}
                    loading={isUploadsLoading}
                    uploading={isUploadingAssets}
                    error={uploadsError}
                    onUpload={(files) => void handleUploadAssets(files)}
                    onRefresh={() => void fetchUploads()}
                    onDelete={(asset) => void handleDeleteUpload(asset)}
                    onUseForChannel={(asset, channel) => void handleUseUploadForChannel(asset, channel)}
                    onUseForEmail={(asset) => void handleUseUploadForEmail(asset)}
                />
            );
        }
        if (activeSection === "projects") {
            return (
                <ProjectsView
                    overview={dashboardOverview}
                    jiraProjects={jiraProjects}
                    jiraLoading={isJiraProjectsLoading}
                    onConnectJira={() => void handleConnectJira()}
                    onRefreshJiraProjects={() => void fetchJiraProjects(true, false)}
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
        <div className={cn("min-h-screen bg-slate-100 text-slate-900 lg:h-screen lg:overflow-hidden", headerPreferences.workspace.compactMode && "text-[13px]")}>
            <div className="grid min-h-screen lg:h-screen lg:grid-cols-[240px_1fr]">
                <aside className="border-r border-slate-200 bg-slate-100 p-3 lg:h-screen lg:overflow-hidden">
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

                    <Button
                        className="mt-6 w-full rounded-xl bg-black text-white hover:bg-slate-900"
                        onClick={() => setChatbotOpenSignal((prev) => prev + 1)}
                    >
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

                <div className="min-w-0 lg:h-screen lg:overflow-y-auto lg:scrollbar-hide">
                    <ShellHeader
                        unreadNotifications={unreadNotificationsCount}
                        onOpenNotifications={() => setIsNotificationsOpen(true)}
                        onOpenSettings={() => {
                            setSettingsDraft(headerPreferences);
                            setIsSettingsOpen(true);
                        }}
                        user={headerUser}
                        onOpenProfile={() => setIsProfileOpen(true)}
                        onOpenConnections={() => {
                            setSettingsDraft(headerPreferences);
                            setIsSettingsOpen(true);
                        }}
                        onLogout={() => void handleLogout()}
                        isLoggingOut={isLoggingOut}
                    />

                    <main
                        className={cn(
                            activeSection === "email" ? "pt-10 lg:pt-12" : "pt-16 lg:pt-20",
                            activeSection === "twitter"
                                ? "space-y-0"
                                : cn(
                                    "space-y-4 px-4 pb-4 lg:px-6 lg:pb-6",
                                    headerPreferences.workspace.compactMode && "space-y-3 px-3 pb-3 lg:px-4 lg:pb-4",
                                ),
                        )}
                    >
                        <div
                            className={cn(
                                "flex flex-wrap gap-3",
                                activeSection === "twitter"
                                    ? "items-center justify-between px-4 py-4 lg:px-6 lg:py-5"
                                    : "items-end justify-between",
                            )}
                        >
                            <div className={cn(activeSection === "twitter" ? "space-y-1" : "")}>
                                <h1 className="text-2xl font-semibold leading-tight tracking-tight">{copy.title}</h1>
                                <p className="text-sm leading-5 text-slate-500">{copy.subtitle}</p>
                            </div>
                            {activeSection === "twitter" ? (
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <TrendingUp className="h-4 w-4" />
                                    {twitterConnected ? "Live timeline mode" : "Connect Twitter to start feed"}
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <TrendingUp className="h-4 w-4" />
                                    {isOverviewLoading ? "Refreshing overview..." : overviewError ? "Overview unavailable" : "Live unified overview"}
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </div>
                            )}
                        </div>

                        {renderMainContent()}
                    </main>
                </div>
            </div>

            <ZyncoChatbot
                openSignal={chatbotOpenSignal}
                source={chatbotSource}
                context={chatbotContext}
                pageLabel={copy.title}
            />

            <Dialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
                <DialogContent className="max-w-2xl border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Notifications</DialogTitle>
                        <DialogDescription>
                            Live activity alerts from all connected channels.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-slate-500">
                                {unreadNotificationsCount} unread of {notificationItems.length} total
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-300"
                                    onClick={() => void fetchDashboardOverview()}
                                >
                                    <RefreshCw className="mr-1 h-4 w-4" />
                                    Refresh
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-300"
                                    onClick={() => void handleMarkAllNotificationsRead()}
                                    disabled={isPreferencesSaving || unreadNotificationsCount === 0}
                                >
                                    Mark All Read
                                </Button>
                            </div>
                        </div>

                        <div className="max-h-105 space-y-2 overflow-y-auto pr-1">
                            {visibleNotifications.map((item) => {
                                const unread = unreadNotificationIds.has(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "rounded-lg border border-slate-200 bg-white p-3",
                                            unread && "border-blue-200 bg-blue-50/40",
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">{item.source}</Badge>
                                                {unread && <Badge variant="secondary" className="bg-blue-100 text-blue-700">Unread</Badge>}
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

                                        <p className="mt-2 text-sm font-medium text-slate-900">{item.title}</p>
                                        <p className="mt-1 text-xs text-slate-600">{item.description || "No description"}</p>
                                        <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{formatRelativeTime(item.timestamp)}</p>
                                    </div>
                                );
                            })}

                            {visibleNotifications.length === 0 && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                    No notifications found for the current filter.
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogContent className="max-w-md border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Profile</DialogTitle>
                        <DialogDescription>
                            Account essentials and quick actions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Name</p>
                            <p className="text-sm font-semibold text-slate-900">{headerUser?.name || "N/A"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Email</p>
                            <p className="text-sm font-semibold text-slate-900">{headerUser?.email || "N/A"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs text-slate-500">User ID</p>
                                    <p className="text-sm font-semibold text-slate-900">{headerUser?.id || "N/A"}</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" className="border-slate-300" onClick={() => void handleCopyUserId()}>
                                    Copy
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="border-slate-300"
                            onClick={() => {
                                setIsProfileOpen(false);
                                setSettingsDraft(headerPreferences);
                                setIsSettingsOpen(true);
                            }}
                        >
                            Social Connections
                        </Button>
                        <Button
                            type="button"
                            className="bg-black text-white hover:bg-slate-900"
                            onClick={() => void handleLogout()}
                            disabled={isLoggingOut}
                        >
                            {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Logout
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isSettingsOpen}
                onOpenChange={(open) => {
                    setIsSettingsOpen(open);
                    if (open) {
                        setSettingsDraft(headerPreferences);
                    }
                }}
            >
                <DialogContent className="max-w-lg border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Settings & Connections</DialogTitle>
                        <DialogDescription>
                            Manage social platform connections and dashboard preferences.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Connections</p>
                            <div className="space-y-2">
                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">Gmail</p>
                                            <p className="text-xs text-slate-500">
                                                {gmailConnected
                                                    ? (gmailAccount ? `Connected as ${gmailAccount}` : "Connected")
                                                    : "Not connected"}
                                            </p>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                gmailConnected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                                            )}
                                        >
                                            {gmailConnected ? "Connected" : "Disconnected"}
                                        </Badge>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-slate-300"
                                            onClick={() => {
                                                setActiveSection("email");
                                                setIsSettingsOpen(false);
                                            }}
                                        >
                                            {gmailConnected ? "Manage Gmail" : "Connect Gmail"}
                                        </Button>
                                    </div>
                                </div>

                                {socialConnectionRows.map((row) => (
                                    <div key={row.channel} className="rounded-lg border border-slate-200 bg-white p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                                                <p className="text-xs text-slate-500">
                                                    {row.connected
                                                        ? (row.account ? `Connected as ${row.account}` : "Connected")
                                                        : "Not connected"}
                                                </p>
                                            </div>
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    row.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                                                )}
                                            >
                                                {row.connected ? "Connected" : "Disconnected"}
                                            </Badge>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="border-slate-300"
                                                onClick={() => handleOpenChannelConnectionSettings(row.channel)}
                                            >
                                                {row.connected ? "Manage / Reconnect" : "Connect"}
                                            </Button>
                                            {row.connected && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    onClick={() => void handleDisconnectDirect(row.channel)}
                                                >
                                                    Disconnect
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Notifications</p>

                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Show only unread in panel</p>
                                    <p className="text-xs text-slate-500">Filter notification drawer to unread updates by default.</p>
                                </div>
                                <Switch
                                    checked={settingsDraft.notifications.showOnlyUnread}
                                    onCheckedChange={(checked) => {
                                        setSettingsDraft((prev) => ({
                                            ...prev,
                                            notifications: {
                                                ...prev.notifications,
                                                showOnlyUnread: checked,
                                            },
                                        }));
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Mute notification sound</p>
                                    <p className="text-xs text-slate-500">Store preference for in-app alert sound behavior.</p>
                                </div>
                                <Switch
                                    checked={settingsDraft.notifications.muteSound}
                                    onCheckedChange={(checked) => {
                                        setSettingsDraft((prev) => ({
                                            ...prev,
                                            notifications: {
                                                ...prev.notifications,
                                                muteSound: checked,
                                            },
                                        }));
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Workspace</p>

                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Compact mode</p>
                                    <p className="text-xs text-slate-500">Reduce spacing and density for faster operations.</p>
                                </div>
                                <Switch
                                    checked={settingsDraft.workspace.compactMode}
                                    onCheckedChange={(checked) => {
                                        setSettingsDraft((prev) => ({
                                            ...prev,
                                            workspace: {
                                                ...prev.workspace,
                                                compactMode: checked,
                                            },
                                        }));
                                    }}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="default-section">Default section on dashboard open</Label>
                                <select
                                    id="default-section"
                                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                                    value={settingsDraft.workspace.defaultSection}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        if (!isSectionId(value)) return;
                                        setSettingsDraft((prev) => ({
                                            ...prev,
                                            workspace: {
                                                ...prev.workspace,
                                                defaultSection: value,
                                            },
                                        }));
                                    }}
                                >
                                    {DASHBOARD_SECTION_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" className="border-slate-300" onClick={() => setIsSettingsOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="bg-black text-white hover:bg-slate-900"
                            onClick={() => void handleSaveSettings()}
                            disabled={isPreferencesSaving}
                        >
                            {isPreferencesSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Settings
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(connectDialogChannel)} onOpenChange={(isOpen) => !isOpen && handleCloseConnectDialog()}>
                <DialogContent className="max-w-xl border-slate-200">
                    <DialogHeader>
                        <DialogTitle>
                            {connectDialogChannel
                                ? `${connectDialogChannel.charAt(0).toUpperCase()}${connectDialogChannel.slice(1)} ${dialogConnected ? "Settings" : "Connect"}`
                                : "Channel Settings"}
                        </DialogTitle>
                        <DialogDescription>
                            {connectDialogChannel === "twitter" && dialogConnected
                                ? "Manage your connected X account. You can reconnect with a different account or disconnect here."
                                : connectDialogChannel === "twitter"
                                    ? "Authenticate with X (Twitter) in the provider window. Account identity is set only from OAuth callback."
                                    : "Authenticate through the provider login, then paste your Unipile account ID to complete connection."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                            {connectDialogChannel === "twitter" && dialogConnected
                                ? "This account is already connected. Use Open Provider Login to switch accounts, or click Disconnect to remove this connection."
                                : connectDialogChannel === "twitter"
                                    ? "Step 1: Click provider login. Step 2: Sign in to X and approve access. Step 3: Return here; identity is accepted only from OAuth response."
                                    : "Step 1: Click provider login. Step 2: Sign in and complete verification. Step 3: Paste the resulting account ID below. If verification fails, close that window and click provider login again to regenerate a fresh auth session."}
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
                            <Label htmlFor="social-account-id">
                                {connectDialogChannel === "twitter" ? "Twitter Account ID (username)" : "Unipile Account ID"}
                            </Label>
                            <Input
                                id="social-account-id"
                                value={
                                    connectDialogChannel
                                        ? (channelState[connectDialogChannel].accountId || selectedDialogMeta?.accountId || selectedDialogMeta?.username || "")
                                        : ""
                                }
                                onChange={(event) => {
                                    if (!connectDialogChannel) return;
                                    if (connectDialogChannel === "twitter") return;
                                    updateChannelState(connectDialogChannel, { accountId: event.target.value });
                                }}
                                placeholder={connectDialogChannel === "twitter" ? "OAuth-managed (read only)" : "Paste account ID from Unipile"}
                                readOnly={connectDialogChannel === "twitter"}
                                disabled={connectDialogChannel === "twitter"}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        {connectDialogChannel && dialogConnected && (
                            <Button type="button" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void handleDisconnectChannel()}>
                                Disconnect
                            </Button>
                        )}
                        <Button type="button" variant="outline" className="border-slate-300" onClick={handleCloseConnectDialog}>
                            Cancel
                        </Button>
                        {connectDialogChannel !== "twitter" ? (
                            <Button type="button" className="bg-black text-white hover:bg-slate-900" onClick={() => void handleSaveChannelConnection()}>
                                Save Connection
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
