"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUpRight, Loader2, SendHorizontal, Sparkles, Wand2, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ChatWorkspaceSectionTarget =
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

type ChatSource = "instagram" | "linkedin" | "email" | "twitter";
type ChatUpdateSource = ChatSource | "whatsapp" | "automation";

type QueueStatus = "success" | "failed" | "pending";

interface ChatWorkspaceUpdate {
    id: string;
    source: ChatUpdateSource;
    title: string;
    description: string;
    timestamp: string;
    status: QueueStatus;
    kind?: "message" | "post" | "activity";
    direction?: "INBOUND" | "OUTBOUND";
    contactName?: string;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

interface AutomationFilter {
    category?: string;
    priority?: "low" | "medium" | "high" | "critical";
}

type AutomationCommandKind = "none" | "status" | "dry-run" | "execute";

interface AutomationCommand {
    kind: AutomationCommandKind;
    filter: AutomationFilter;
    confirmed: boolean;
}

interface ApplyAutomationResponse {
    success?: boolean;
    dryRun?: boolean;
    emailsChecked?: number;
    rulesChecked?: number;
    matched?: number;
    executed?: number;
    failed?: number;
    results?: Array<{
        status?: string;
        subject?: string;
        ruleName?: string;
        action?: string;
        result?: string;
    }>;
    error?: string;
}

interface AutomationRuleSummary {
    id: string;
    name: string;
    enabled: boolean;
    action?: {
        type?: string;
    };
}

interface ActivityLogSummary {
    id: string;
    action: string;
    status: "success" | "failed" | "pending";
    timestamp: string;
    details?: string;
}

interface ChatWorkspaceProps {
    updates: ChatWorkspaceUpdate[];
    onJump: (section: ChatWorkspaceSectionTarget) => void;
    connectionStatus?: Partial<Record<ChatSource, boolean>>;
}

const SOURCES: ChatSource[] = ["instagram", "linkedin", "email", "twitter"];

const SOURCE_META: Record<
    ChatSource,
    {
        label: string;
        section: ChatWorkspaceSectionTarget;
        hint: string;
        tint: string;
    }
> = {
    instagram: {
        label: "Instagram",
        section: "instagram",
        hint: "High-intent DMs and comment hotspots",
        tint: "linear-gradient(90deg, #fbcfe8 0%, #fda4af 45%, #fed7aa 100%)",
    },
    linkedin: {
        label: "LinkedIn",
        section: "linkedin",
        hint: "B2B pipeline and relationship follow-ups",
        tint: "linear-gradient(90deg, #bae6fd 0%, #a5f3fc 45%, #c7d2fe 100%)",
    },
    email: {
        label: "Email",
        section: "email",
        hint: "Inbox triage and reply prioritization",
        tint: "linear-gradient(90deg, #fde68a 0%, #fef08a 45%, #d9f99d 100%)",
    },
    twitter: {
        label: "Twitter/X",
        section: "twitter",
        hint: "Mentions, conversations, and escalation",
        tint: "linear-gradient(90deg, #cbd5e1 0%, #e2e8f0 45%, #d4d4d8 100%)",
    },
};

const QUICK_PROMPTS: Record<ChatSource, string[]> = {
    instagram: [
        "Summarize priority Instagram conversations and suggest the next 3 replies.",
        "Find collaboration leads from Instagram updates and rank by urgency.",
    ],
    linkedin: [
        "Give me the top B2B LinkedIn leads and a follow-up strategy.",
        "Draft concise responses for today\'s pending LinkedIn messages.",
    ],
    email: [
        "Classify this email queue into urgent, important, and later.",
        "Draft a high-quality response for the most urgent email thread.",
        "automation status",
        "run automation dry run for high priority",
    ],
    twitter: [
        "Summarize top Twitter mentions and recommended responses.",
        "Find risky Twitter threads and prepare escalation notes.",
    ],
};

function extractAutomationFilter(input: string): AutomationFilter {
    const lower = input.toLowerCase();
    const filter: AutomationFilter = {};

    if (/(requires[\s_-]?action|needs[\s_-]?action)/.test(lower)) {
        filter.category = "requires_action";
    } else if (/important/.test(lower)) {
        filter.category = "important";
    } else if (/(transactional|invoice|order)/.test(lower)) {
        filter.category = "transactional";
    } else if (/(promotion|marketing)/.test(lower)) {
        filter.category = "promotions";
    } else if (/social/.test(lower)) {
        filter.category = "social";
    } else if (/updates?/.test(lower)) {
        filter.category = "updates";
    }

    if (/\bcritical\b/.test(lower)) {
        filter.priority = "critical";
    } else if (/(high|urgent)/.test(lower)) {
        filter.priority = "high";
    } else if (/\bmedium\b/.test(lower)) {
        filter.priority = "medium";
    } else if (/\blow\b/.test(lower)) {
        filter.priority = "low";
    }

    return filter;
}

function parseAutomationCommand(input: string): AutomationCommand {
    const lower = input.toLowerCase().trim();
    const mentionsRules = /(automation|rules?)/.test(lower);

    if (!mentionsRules) {
        return { kind: "none", filter: {}, confirmed: false };
    }

    const filter = extractAutomationFilter(lower);
    const confirmed = /(confirm|approved|proceed|go ahead|yes execute)/.test(lower);

    if (/(status|health|summary)/.test(lower)) {
        return { kind: "status", filter, confirmed };
    }

    if (/(dry[\s-]?run|preview|test run|safe run)/.test(lower)) {
        return { kind: "dry-run", filter, confirmed };
    }

    if (/(apply|execute|run)/.test(lower)) {
        return { kind: "execute", filter, confirmed };
    }

    return { kind: "none", filter, confirmed };
}

function describeFilter(filter: AutomationFilter): string {
    const chips: string[] = [];
    if (filter.category) chips.push(`category=${filter.category}`);
    if (filter.priority) chips.push(`priority=${filter.priority}`);
    return chips.length > 0 ? chips.join(", ") : "none";
}

function createWelcomeMessage(source: ChatSource): ChatMessage {
    return {
        id: `welcome-${source}`,
        role: "assistant",
        content: `Connected to **${SOURCE_META[source].label} intelligence**. Ask for triage, response drafts, risk flags, or a compact action plan.`,
        timestamp: Date.now(),
    };
}

function formatRelativeTime(value: string): string {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return "unknown";

    const diffSeconds = Math.round((time - Date.now()) / 1000);
    const abs = Math.abs(diffSeconds);

    if (abs < 60) return "just now";

    const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    if (abs < 3600) {
        return format.format(Math.round(diffSeconds / 60), "minute");
    }

    if (abs < 86400) {
        return format.format(Math.round(diffSeconds / 3600), "hour");
    }

    return format.format(Math.round(diffSeconds / 86400), "day");
}

function statusTone(status: QueueStatus): string {
    if (status === "failed") return "bg-red-100 text-red-700 border-red-200";
    if (status === "pending") return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function isChatSource(value: ChatUpdateSource): value is ChatSource {
    return SOURCES.includes(value as ChatSource);
}

function isInboxItem(update: ChatWorkspaceUpdate): boolean {
    if (update.kind) return update.kind === "message";

    const text = `${update.title || ""} ${update.description || ""}`.toLowerCase();
    return /(inbox|message|dm|conversation|thread|reply)/.test(text);
}

export default function ChatWorkspace({ updates, onJump, connectionStatus }: ChatWorkspaceProps) {
    const [selectedSource, setSelectedSource] = useState<ChatSource>("instagram");
    const [draft, setDraft] = useState("");
    const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
    const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
    const [threads, setThreads] = useState<Record<ChatSource, ChatMessage[]>>(() => {
        const initial = {} as Record<ChatSource, ChatMessage[]>;
        SOURCES.forEach((source) => {
            initial[source] = [createWelcomeMessage(source)];
        });
        return initial;
    });
    const [pendingSource, setPendingSource] = useState<ChatSource | null>(null);
    const [requestError, setRequestError] = useState<string | null>(null);
    const composerRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const automationAgentIdRef = useRef<string | null>(null);

    const connectedBySource = useMemo(() => {
        const map = {} as Record<ChatSource, boolean>;
        SOURCES.forEach((source) => {
            map[source] = Boolean(connectionStatus?.[source]);
        });
        return map;
    }, [connectionStatus]);

    const counts = useMemo(() => {
        const map = new Map<ChatSource, number>();
        SOURCES.forEach((source) => {
            const sourceItems = updates.filter((item) => item.source === source);
            const inboxItems = sourceItems.filter((item) => isInboxItem(item));
            map.set(source, inboxItems.length > 0 ? inboxItems.length : sourceItems.length);
        });
        return map;
    }, [updates]);

    const queueMode = useMemo<"inbox" | "fallback">(() => {
        const sourceItems = updates.filter((item) => item.source === selectedSource);
        const inboxItems = sourceItems.filter((item) => isInboxItem(item));
        return inboxItems.length > 0 ? "inbox" : "fallback";
    }, [selectedSource, updates]);

    const queue = useMemo(
        () => {
            const sourceItems = updates.filter((item) => item.source === selectedSource);
            const inboxItems = sourceItems.filter((item) => isInboxItem(item));
            const selectedItems = inboxItems.length > 0 ? inboxItems : sourceItems;
            return selectedItems.slice(0, 18);
        },
        [selectedSource, updates],
    );

    const activeQueueItem = useMemo(
        () => queue.find((item) => item.id === activeQueueId) || null,
        [activeQueueId, queue],
    );

    const selectedContextItem = useMemo(
        () => queue.find((item) => item.id === selectedContextId) || null,
        [queue, selectedContextId],
    );

    const composerContextItem = selectedContextItem || activeQueueItem;
    const isComposerContextAttached = Boolean(selectedContextItem && composerContextItem && selectedContextItem.id === composerContextItem.id);

    const activeQueueSourceMeta = useMemo(() => {
        if (!activeQueueItem) return SOURCE_META[selectedSource];
        return isChatSource(activeQueueItem.source) ? SOURCE_META[activeQueueItem.source] : SOURCE_META[selectedSource];
    }, [activeQueueItem, selectedSource]);

    const messages = threads[selectedSource] || [];
    const isSendingCurrentSource = pendingSource === selectedSource;

    useEffect(() => {
        if (queue.length === 0) {
            setActiveQueueId(null);
            return;
        }

        if (!queue.some((entry) => entry.id === activeQueueId)) {
            setActiveQueueId(queue[0].id);
        }
    }, [activeQueueId, queue]);

    useEffect(() => {
        if (selectedContextId && !queue.some((entry) => entry.id === selectedContextId)) {
            setSelectedContextId(null);
        }
    }, [queue, selectedContextId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, pendingSource, selectedSource]);

    const getAutomationAgentId = async (): Promise<string> => {
        if (automationAgentIdRef.current) return automationAgentIdRef.current;

        const response = await fetch("/api/standalone-agents/gmail-classifier/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });

        const payload = (await response.json()) as {
            agent?: { id?: string };
            error?: string;
        };

        if (!response.ok || !payload.agent?.id) {
            throw new Error(payload.error || "Failed to initialize automation agent");
        }

        automationAgentIdRef.current = payload.agent.id;
        return payload.agent.id;
    };

    const runAutomationCommand = async (command: AutomationCommand): Promise<string> => {
        const agentId = await getAutomationAgentId();

        if (command.kind === "status") {
            const [rulesResponse, activityResponse] = await Promise.all([
                fetch(`/api/standalone-agents/gmail-classifier/automation-rules?agentId=${encodeURIComponent(agentId)}`, {
                    cache: "no-store",
                }),
                fetch(`/api/standalone-agents/gmail-classifier/activity?agentId=${encodeURIComponent(agentId)}&type=automation&limit=5`, {
                    cache: "no-store",
                }),
            ]);

            const rulesPayload = (await rulesResponse.json()) as { rules?: AutomationRuleSummary[]; error?: string };
            const activityPayload = (await activityResponse.json()) as { logs?: ActivityLogSummary[]; error?: string };

            if (!rulesResponse.ok) {
                throw new Error(rulesPayload.error || "Failed to load automation rules");
            }

            if (!activityResponse.ok) {
                throw new Error(activityPayload.error || "Failed to load automation activity");
            }

            const rules = rulesPayload.rules || [];
            const enabledRules = rules.filter((rule) => rule.enabled);
            const latestLogs = (activityPayload.logs || []).slice(0, 3);

            const lines: string[] = [
                `Automation status snapshot:`,
                `- Total rules: ${rules.length}`,
                `- Enabled rules: ${enabledRules.length}`,
                `- Disabled rules: ${Math.max(0, rules.length - enabledRules.length)}`,
            ];

            if (enabledRules.length > 0) {
                lines.push(`- Enabled actions: ${enabledRules.slice(0, 4).map((rule) => rule.action?.type || "unknown").join(", ")}`);
            }

            if (latestLogs.length > 0) {
                lines.push("", "Recent automation activity:");
                latestLogs.forEach((log) => {
                    lines.push(`- ${log.status.toUpperCase()}: ${log.action}`);
                });
            }

            lines.push("", "Try: run automation dry run for high priority");
            return lines.join("\n");
        }

        const executeRequested = command.kind === "execute";
        const shouldExecute = executeRequested && command.confirmed;
        const dryRun = !shouldExecute;

        const applyResponse = await fetch("/api/standalone-agents/gmail-classifier/automation-rules/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agentId,
                dryRun,
                filter: command.filter,
            }),
        });

        const applyPayload = (await applyResponse.json()) as ApplyAutomationResponse;

        if (!applyResponse.ok) {
            throw new Error(applyPayload.error || "Failed to run automation command");
        }

        const modeLabel = dryRun ? "Dry run" : "Execution";
        const lines: string[] = [
            `${modeLabel} completed for automation rules.`,
            `- Filter: ${describeFilter(command.filter)}`,
            `- Emails checked: ${applyPayload.emailsChecked || 0}`,
            `- Rules checked: ${applyPayload.rulesChecked || 0}`,
            `- Matched actions: ${applyPayload.matched || 0}`,
            `- Executed: ${applyPayload.executed || 0}`,
            `- Failed: ${applyPayload.failed || 0}`,
        ];

        const topResults = (applyPayload.results || []).slice(0, 3);
        if (topResults.length > 0) {
            lines.push("", "Top results:");
            topResults.forEach((result) => {
                lines.push(`- ${result.status || "unknown"}: ${result.ruleName || "rule"} on ${result.subject || "email"}`);
            });
        }

        if (executeRequested && !command.confirmed) {
            const confirmParts: string[] = ["confirm execute automation"];
            if (command.filter.category) confirmParts.push(`category ${command.filter.category}`);
            if (command.filter.priority) confirmParts.push(`priority ${command.filter.priority}`);

            lines.push(
                "",
                "Safety gate: This was a dry run only.",
                `To execute for real, send: ${confirmParts.join(" ")}`,
            );
        }

        return lines.join("\n");
    };

    const sendMessage = async (preset?: string) => {
        const text = (preset ?? draft).trim();
        if (!text || pendingSource) return;

        const sourceAtSend = selectedSource;
        const threadHistory = threads[sourceAtSend] || [];
        const history = threadHistory
            .slice(-10)
            .map((entry) => ({ role: entry.role, content: entry.content }));

        const context = selectedContextItem
            ? `Queue item\nTitle: ${selectedContextItem.contactName || selectedContextItem.title}\nStatus: ${selectedContextItem.status}\nTime: ${formatRelativeTime(selectedContextItem.timestamp)}\nSummary: ${selectedContextItem.description || "No summary"}`
            : `No queue item explicitly attached for ${SOURCE_META[sourceAtSend].label}`;

        const userMessage: ChatMessage = {
            id: `${sourceAtSend}-user-${Date.now()}`,
            role: "user",
            content: text,
            timestamp: Date.now(),
        };

        setThreads((previous) => ({
            ...previous,
            [sourceAtSend]: [...(previous[sourceAtSend] || []), userMessage],
        }));
        setPendingSource(sourceAtSend);
        setRequestError(null);
        if (!preset) setDraft("");

        try {
            if (sourceAtSend === "email") {
                const automationCommand = parseAutomationCommand(text);

                if (automationCommand.kind !== "none") {
                    const automationReply = await runAutomationCommand(automationCommand);

                    setThreads((previous) => ({
                        ...previous,
                        [sourceAtSend]: [
                            ...(previous[sourceAtSend] || []),
                            {
                                id: `${sourceAtSend}-assistant-${Date.now()}`,
                                role: "assistant",
                                content: automationReply,
                                timestamp: Date.now(),
                            },
                        ],
                    }));
                    return;
                }
            }

            const response = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    source: sourceAtSend,
                    context,
                    history,
                }),
            });

            const data = (await response.json()) as {
                reply?: string;
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error || `Request failed (${response.status})`);
            }

            const assistantMessage: ChatMessage = {
                id: `${sourceAtSend}-assistant-${Date.now()}`,
                role: "assistant",
                content:
                    data.reply?.trim() ||
                    "I could not generate a model response, but your request has been captured and can be retried.",
                timestamp: Date.now(),
            };

            setThreads((previous) => ({
                ...previous,
                [sourceAtSend]: [...(previous[sourceAtSend] || []), assistantMessage],
            }));
        } catch {
            setThreads((previous) => ({
                ...previous,
                [sourceAtSend]: [
                    ...(previous[sourceAtSend] || []),
                    {
                        id: `${sourceAtSend}-assistant-error-${Date.now()}`,
                        role: "assistant",
                        content:
                            "I hit a temporary issue while contacting the model. You can retry now, or continue with queue actions in this panel.",
                        timestamp: Date.now(),
                    },
                ],
            }));
            setRequestError("AI response is temporarily unavailable. Please try again.");
        } finally {
            setPendingSource((previous) => (previous === sourceAtSend ? null : previous));
            composerRef.current?.focus();
        }
    };

    return (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <Card className="overflow-hidden border-slate-200 bg-white py-0">
                <CardHeader className="rounded-t-xl border-b border-slate-200 bg-linear-to-r from-blue-100 to-indigo-100 py-5">
                    <CardTitle className="text-base text-slate-900">Conversation Sources</CardTitle>
                    <p className="text-xs text-slate-700">Pick a source and process queue items in priority order.</p>
                </CardHeader>
                <CardContent className="space-y-3 pb-6 pt-4">
                    {SOURCES.map((source) => {
                        const active = selectedSource === source;
                        const sourceConnected = connectedBySource[source];
                        return (
                            <button
                                key={source}
                                className={cn(
                                    "w-full rounded-xl border px-3 py-2.5 text-left transition",
                                    active
                                        ? "border-blue-300 bg-blue-100 text-blue-950 shadow-sm"
                                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
                                )}
                                onClick={() => setSelectedSource(source)}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold">{SOURCE_META[source].label}</p>
                                    <div className="flex items-center gap-1.5">
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                "border",
                                                sourceConnected
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                    : "border-slate-300 bg-slate-100 text-slate-600",
                                            )}
                                        >
                                            {sourceConnected ? "Connected" : "Disconnected"}
                                        </Badge>
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                "border",
                                                active
                                                    ? "border-blue-300 bg-white text-blue-800"
                                                    : "border-slate-200 bg-white text-slate-700",
                                            )}
                                        >
                                            {sourceConnected ? (counts.get(source) || 0) : 0}
                                        </Badge>
                                    </div>
                                </div>
                                <p className={cn("mt-1 text-[11px]", active ? "text-blue-800" : "text-slate-500")}>
                                    {SOURCE_META[source].hint}
                                </p>
                            </button>
                        );
                    })}

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Queue Snapshot</p>
                        {!connectedBySource[selectedSource] && queue.length === 0 ? (
                            <p className="mt-1 text-sm text-slate-700">
                                {SOURCE_META[selectedSource].label} is disconnected. Connect this app to load inbox/chat data.
                            </p>
                        ) : (
                            <div className="mt-1 space-y-1">
                                <p className="text-sm text-slate-700">
                                    {queue.length === 0
                                        ? `No ${SOURCE_META[selectedSource].label} queue items yet`
                                        : queueMode === "inbox"
                                            ? `${queue.length} ${SOURCE_META[selectedSource].label} inbox/chat messages in queue`
                                            : `${queue.length} ${SOURCE_META[selectedSource].label} recent updates in queue`}
                                </p>
                                {!connectedBySource[selectedSource] && queue.length > 0 && (
                                    <p className="text-[11px] text-amber-700">Showing last synced items. Source is currently disconnected.</p>
                                )}
                            </div>
                        )}
                        {queue.length > 0 && (
                            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
                                {queue.map((item) => {
                                    const isActive = item.id === activeQueueId;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setActiveQueueId(item.id);
                                                if (selectedContextId) {
                                                    setSelectedContextId(item.id);
                                                }
                                            }}
                                            className={cn(
                                                "w-full rounded-lg border px-2.5 py-2 text-left transition",
                                                isActive
                                                    ? "border-slate-900 bg-white shadow-sm"
                                                    : "border-slate-200 bg-white/70 hover:border-slate-300",
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate text-xs font-semibold text-slate-900">
                                                    {item.contactName || item.title}
                                                </p>
                                                <span className="text-[10px] text-slate-500">{formatRelativeTime(item.timestamp)}</span>
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                                                {item.description || "No summary"}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 bg-white py-0">
                <CardHeader
                    className="rounded-t-xl border-b border-slate-200 py-5"
                    style={{ background: SOURCE_META[selectedSource].tint }}
                >
                    <div>
                        <CardTitle className="text-lg text-slate-950">{SOURCE_META[selectedSource].label} AI Workspace</CardTitle>
                        <p className="mt-1 text-xs text-slate-700">Ask for triage, response drafts, prioritization, or workflow decisions.</p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-6 pt-4">
                    <div className="h-110 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn("flex", message.role === "assistant" ? "justify-start" : "justify-end")}
                            >
                                <div
                                    className={cn(
                                        "max-w-[88%] rounded-2xl border px-3.5 py-2.5 text-sm",
                                        message.role === "assistant"
                                            ? "border-slate-200 bg-white text-slate-700"
                                            : "border-slate-900 bg-slate-900 text-white",
                                    )}
                                >
                                    {message.role === "assistant" ? (
                                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0 prose-strong:text-slate-900">
                                            <ReactMarkdown
                                                components={{
                                                    a: ({ ...props }) => (
                                                        <a
                                                            {...props}
                                                            className="font-semibold text-blue-600 underline decoration-blue-400 underline-offset-2"
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        />
                                                    ),
                                                }}
                                            >
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                    )}
                                    <p
                                        className={cn(
                                            "mt-1 text-[10px]",
                                            message.role === "assistant" ? "text-slate-400" : "text-slate-300",
                                        )}
                                    >
                                        {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {isSendingCurrentSource && (
                            <div className="flex justify-start">
                                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Zynco AI is generating a response
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {requestError && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            {requestError}
                        </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        {composerContextItem ? (
                            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedContextId(composerContextItem.id)}
                                    className={cn(
                                        "w-full rounded-md border px-2.5 py-2 text-left transition",
                                        isComposerContextAttached
                                            ? "border-blue-300 bg-blue-50"
                                            : "border-slate-200 bg-white hover:border-slate-300",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-xs font-semibold text-slate-900">
                                            {composerContextItem.contactName || composerContextItem.title}
                                        </p>
                                        <span className="text-[10px] text-slate-500">{formatRelativeTime(composerContextItem.timestamp)}</span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                                        {composerContextItem.description || "No summary"}
                                    </p>
                                </button>
                                <div className="mt-1.5 flex items-center justify-between px-1">
                                    <p className="text-[11px] text-slate-600">
                                        {isComposerContextAttached
                                            ? "Attached to this prompt"
                                            : "Click context card to attach"}
                                    </p>
                                    {isComposerContextAttached && (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedContextId(null);
                                            }}
                                            className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-slate-400"
                                        >
                                            <X className="h-3 w-3" />
                                            Deselect
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                                Select a queue message from this app to attach it as context.
                            </div>
                        )}
                        <Textarea
                            ref={composerRef}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    void sendMessage();
                                }
                            }}
                            placeholder={`Ask Zynco AI about ${SOURCE_META[selectedSource].label}...`}
                            className="min-h-23 resize-none border-0 bg-slate-50 text-sm shadow-none focus-visible:ring-2"
                            disabled={Boolean(pendingSource)}
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                                {QUICK_PROMPTS[selectedSource].map((prompt) => (
                                    <button
                                        key={prompt}
                                        onClick={() => void sendMessage(prompt)}
                                        disabled={Boolean(pendingSource)}
                                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                        {prompt.length > 48 ? `${prompt.slice(0, 48)}...` : prompt}
                                    </button>
                                ))}
                            </div>
                            <Button
                                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                                onClick={() => void sendMessage()}
                                disabled={!draft.trim() || Boolean(pendingSource)}
                            >
                                {isSendingCurrentSource ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                                Send
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <Card className="overflow-hidden border-slate-200 bg-white py-0">
                    <CardHeader>
                        <CardTitle className="text-base">Action Panel</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-6 pt-4 text-sm text-slate-600">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                <Sparkles className="h-4 w-4 text-blue-600" />
                                Reply SLA
                            </p>
                            <p className="mt-1 text-xs">
                                First response target: 10 minutes for active leads, 30 minutes for standard conversations.
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                <Zap className="h-4 w-4 text-amber-500" />
                                Escalation Path
                            </p>
                            <p className="mt-1 text-xs">If sentiment is negative, legal risk appears, or revenue risk is high, escalate to human owner within 5 minutes.</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-slate-900">Suggested Next Action</p>
                            <p className="mt-1 text-xs">
                                Generate a draft from the selected queue item, review tone and intent, then execute from the source workspace.
                            </p>
                        </div>
                        {selectedSource === "email" && (
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                <p className="text-sm font-semibold text-blue-900">Email Automation Control</p>
                                <p className="mt-1 text-xs text-blue-800">
                                    Run automation directly in this chat: <strong>automation status</strong>, <strong>run automation dry run for high priority</strong>, then
                                    <strong> confirm execute automation</strong>.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white">
                    <CardHeader>
                        <CardTitle className="text-base">Live Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {activeQueueItem ? (
                            <>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {activeQueueItem.contactName || activeQueueItem.title}
                                    </p>
                                    <span
                                        className={cn(
                                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                            statusTone(activeQueueItem.status),
                                        )}
                                    >
                                        {activeQueueItem.status}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600">{activeQueueItem.description || "No summary provided."}</p>
                                <p className="text-[11px] text-slate-500">Updated {formatRelativeTime(activeQueueItem.timestamp)}</p>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between border-slate-300 text-slate-700"
                                    onClick={() => onJump(activeQueueSourceMeta.section)}
                                >
                                    Open {activeQueueSourceMeta.label}
                                    <ArrowUpRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="w-full justify-between"
                                    onClick={() => setDraft(`Draft a high-quality response for this queue item:\n\n${activeQueueItem.description || activeQueueItem.title}`)}
                                >
                                    Use As Prompt
                                    <Wand2 className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                                No queue item selected for this source. You can still chat with the model directly.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
