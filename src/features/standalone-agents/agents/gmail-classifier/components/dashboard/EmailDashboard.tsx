"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import {
    Activity, Search, RefreshCw, Settings, Tag, Inbox, Mail, AlertCircle,
    CheckCircle, Archive, Trash2, ChevronLeft, ChevronRight, Shield,
    ShieldCheck, Zap, Star, Square, CheckSquare, ArrowDownUp, LayoutGrid,
    Sparkles, MessageSquare, ChevronDown, CreditCard, LogOut, Send,
    PanelRight, X, Plus, ExternalLink, Loader2, Newspaper, Bell, Bot,
    User, Megaphone, Play, Clock, History, Paperclip, Target,
    MoreHorizontal, Menu, Reply, ReplyAll, Forward,
    CheckCircle2, HelpCircle, VolumeX, type LucideIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, stripHtml } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

// Internal Dashboard Components
import { EmailBodyRenderer } from "./EmailBodyRenderer";
import { EmailAttachmentsWithPreview } from "./EmailAttachmentsWithPreview";
import { AttachmentPreviewDialog } from "./AttachmentPreviewDialog";
import { DailyDigest } from "./DailyDigest";
import { FocusView } from "./FocusView";
import { ComposeDialog } from "./ComposeDialog";
import { TutorialOverlay } from "./TutorialOverlay";
import { SettingsPanel } from "./SettingsPanel";
import { SyncPreferencesModal, SyncPreferences, dateRangeToQuery } from "./SyncPreferencesModal";
import { AnalyticsWidget } from "./AnalyticsWidget";
import { AutomationRulesManager } from "./AutomationRulesManager";
import { KnowledgeBaseSettings } from "./KnowledgeBaseSettings";
import { ActionNowSection, SmartScoreBadge, InsightTags } from "./ActionNowSection";
import { NotionPageDialog } from "./NotionPageDialog";
import { ActivityHistory } from "./ActivityHistory";
import { AttachmentsView } from "./AttachmentsView";
import { SpamRescueView } from "./SpamRescueView";
import { SecurityTermsView } from "./SecurityTermsView";

// Project & Shared Components
import { ChatSidePanel } from "../ChatSidePanel";
import { FilterToolbar, FilterState, SortState, defaultFilters, defaultSort } from "./FilterToolbar";

// ─── NEW: Hooks & Constants ──────────────────────────────────────────────
import { useAgentConfig } from "../../hooks/useAgentConfig";
import { useEmails, type Email } from "../../hooks/useEmails";
import { useRules } from "../../hooks/useRules";
import { useLabels } from "../../hooks/useLabels";
import { useTutorial } from "../../hooks/useTutorial";
import { type TutorialStep } from "./TutorialOverlay";
import { CATEGORY_CONFIG, CATEGORY_TABS, FOLDERS } from "./constants";

interface EmailDashboardProps {
    agentId: string;
    isConnected: boolean;
    isSlackConnected?: boolean;
    isJiraConnected?: boolean;
    isNotionConnected?: boolean;
    isCrmConnected?: boolean;
    userEmail?: string;
    userName?: string;
    onConnectSlack?: () => void;
    onConnect: () => void;
    onConnectJira?: () => void;
    onConnectNotion?: () => void;
    onConnectCrm?: () => void;
    onDisconnectJira?: () => void;
    onDisconnectGmail?: () => void;
    onDisconnectNotion?: () => void;
    onDisconnectSlack?: () => void;
    onDisconnectCrm?: () => void;
    onOpenSettings: () => void;
    handleSignOut?: () => void;
}

// Email and Attachment types are now imported from useEmails

// Get sender initials and color (UI helper)
const getSenderInfo = (from: string) => {
    const sender = from.replace(/<.*>/, '').trim();
    const initials = sender.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

    const colors = [
        'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500',
        'bg-cyan-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500',
        'bg-teal-500', 'bg-pink-500',
    ];
    const colorIndex = (sender.charCodeAt(0) || 0) % colors.length;

    return { name: sender, initials, color: colors[colorIndex] };
};

const getCategoryStyle = (category: string) => {
    const config = CATEGORY_CONFIG[category.toLowerCase()];
    return config?.bgClass || 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/15 dark:text-gray-400';
};

export function EmailDashboard(props: EmailDashboardProps) {
    const { agentId, isConnected } = props;

    // ─── 1. Core State & Logic (Hooks) ───────────────────────────────────────

    // Agent Config & Data
    const agentState = useAgentConfig(agentId);

    // Emails, Filtering, Syncing
    const emailState = useEmails(agentId, isConnected);

    // Automation Rules
    const ruleState = useRules(agentId);

    // Custom Labels
    const labelState = useLabels(agentId);

    // Onboarding Tutorial
    const tutorialState = useTutorial(
        agentId,
        agentState.config?.hasCompletedTutorial === true,
        () => agentState.updateConfig({ hasCompletedTutorial: true })
    );

    // ─── 2. Local UI State (Remaining) ────────────────────────────────────────

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState("focus");
    const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Reset inline reply state when context changes
    useEffect(() => {
        setIsInlineReplyOpen(false);
        setInlineReplyText("");
    }, [activeEmailId]);
    const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'brain' | 'integrations' | 'labels'>('general');
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
    const [showAnalytics, setShowAnalytics] = useState(true);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState<any>(null);
    const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
    const [isReadingPaneOpen, setIsReadingPaneOpen] = useState(true);
    const [chatContext, setChatContext] = useState<any>(null);

    // Manual Action States (Jira/Notion)
    const [isCreatingJiraTask, setIsCreatingJiraTask] = useState(false);
    const [isNotionDialogOpen, setIsNotionDialogOpen] = useState(false);
    const [notionInitialData, setNotionInitialData] = useState({ title: "", content: "" });
    const [isSendingSlackMessage, setIsSendingSlackMessage] = useState(false);
    const [isDrafting, setIsDrafting] = useState(false);
    const [draftingIntent, setDraftingIntent] = useState<string | null>(null);
    const [isInlineReplyOpen, setIsInlineReplyOpen] = useState(false);
    const [inlineReplyText, setInlineReplyText] = useState("");
    const [isSendingInline, setIsSendingInline] = useState(false);

    // Refresh references for child components that manage their own state
    const refreshKnowledgeRef = useRef<(() => void) | null>(null);
    const handleChatNavigate = useCallback((target: string) => {
        switch (target) {
            case 'analytics':
                setSelectedFolder('analytics'); // Show the dedicated analytics view
                break;
            case 'labels':
                setSettingsInitialTab('labels');
                setSettingsOpen(true);
                break;
            case 'settings_general':
                setSettingsInitialTab('general');
                setSettingsOpen(true);
                break;
            case 'settings_integrations':
                setSettingsInitialTab('integrations');
                setSettingsOpen(true);
                break;
            case 'settings_brain':
                setSettingsInitialTab('brain');
                setSettingsOpen(true);
                break;
            default:
                setSettingsOpen(true);
        }
    }, []);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const generateReplyDraftMutation = useMutation(trpc.standaloneAgents.generateReplyDraft.mutationOptions());
    const sendEmailMutation = useMutation(trpc.standaloneAgents.sendEmail.mutationOptions());
    const createJiraTaskMutation = useMutation(trpc.standaloneAgents.createJiraTask.mutationOptions());
    const sendSlackMessageMutation = useMutation(trpc.standaloneAgents.sendSlackMessage.mutationOptions());
    const applyLabelMutation = useMutation(trpc.standaloneAgents.applyLabel.mutationOptions());
    const updateBrainSettingsMutation = useMutation(trpc.standaloneAgents.updateBrainSettings.mutationOptions());

    const handleChatPreferenceUpdate = useCallback(async (type: string, content: string) => {
        try {
            await updateBrainSettingsMutation.mutateAsync({
                id: agentId,
                type: type as any,
                content
            });

            // Sync local agent state
            await agentState.refresh();
            toast.success(`Automatically updated your ${type} preference!`);
        } catch (error: any) {
            console.error("Failed to update preference via chat:", error);
            toast.error(error.message);
        }
    }, [agentId, agentState, updateBrainSettingsMutation]);

    const handleChatContextChange = useCallback((context: any) => {
        setChatContext(context);
    }, []);

    const handleChatDataRefresh = useCallback(async () => {
        console.log("[Chat] Action executed, refreshing data...");
        // Refresh both agent config and rules
        await Promise.all([
            agentState.refresh(),
            ruleState.fetchRules()
        ]);

        // Refresh knowledge base if available
        if (refreshKnowledgeRef.current) {
            refreshKnowledgeRef.current();
        }
    }, [agentState, ruleState]);

    const handleSavePreferences = async (prefs: any) => {
        try {
            await agentState.updateConfig({ syncPreferences: prefs });
            emailState.syncEmails(prefs, true);
            setShowSyncModal(false);
            toast.success("Sync preferences updated");
        } catch (error) {
            // Error managed by hook
        }
    };

    // ─── 3. Computed Views ───────────────────────────────────────────────────

    const activeEmail = useMemo(() =>
        emailState.emails.find(e => e.id === activeEmailId) || null,
        [emailState.emails, activeEmailId]);

    // Priority emails (Action Required / High Priority)
    const priorityEmails = useMemo(() => {
        if (emailState.selectedCategory !== 'all') return [];
        return emailState.emails
            .filter(e => e.category === 'requires_action' || e.priority === 'high' || e.priority === 'urgent')
            .slice(0, 3);
    }, [emailState.emails, emailState.selectedCategory]);

    // Pagination (using filtered list from useEmails)
    const paginatedEmails = useMemo(() => {
        if (emailState.searchQuery.trim()) return emailState.filteredEmails;
        const startIndex = (emailState.currentPage - 1) * 25;
        return emailState.filteredEmails.slice(startIndex, startIndex + 25);
    }, [emailState.filteredEmails, emailState.currentPage, emailState.searchQuery]);

    // ─── 4. Specialized Action Handlers ───────────────────────────────────────

    // Initial Load & Refresh Logic
    useEffect(() => {
        if (isConnected) {
            emailState.loadCachedEmails();
            labelState.fetchLabels();
            ruleState.fetchRules();
        }
    }, [isConnected, agentId]);

    const handleRefresh = useCallback(() => {
        if (agentState.config?.syncPreferences) {
            emailState.syncEmails(agentState.config.syncPreferences, true);
        } else {
            setShowSyncModal(true);
        }
    }, [agentState.config, emailState.syncEmails]);

    const handleApplyRules = async (targetCategory?: string) => {
        const result = await ruleState.applyRules({
            category: targetCategory || (emailState.selectedCategory !== 'all' ? emailState.selectedCategory : undefined),
            emailIds: selectedEmails.size > 0 ? Array.from(selectedEmails) : undefined,
        });

        const executed = (result as any)?.executed || 0;

        if (executed > 0) {
            toast.success(`Successfully applied rules to ${executed} emails`);
            emailState.loadCachedEmails();
        }
    };

    const handleAutoDraft = async (intent: string) => {
        if (!activeEmail) return;
        setIsDrafting(true);
        setDraftingIntent(intent);
        try {
            const data = await generateReplyDraftMutation.mutateAsync({
                id: agentId,
                emailId: activeEmail.id,
                intent
            });

            const safeSubject = activeEmail.subject || "No Subject";

            if (intent === "full_reply") {
                setComposeData({
                    to: activeEmail.from,
                    subject: safeSubject.startsWith('Re:') ? safeSubject : `Re: ${safeSubject}`,
                    body: `${data.draft}<br/><br/>---<br/>${emailState.emailDetails.get(activeEmail.id)?.bodyHtml || activeEmail.snippet}`,
                    threadId: activeEmail.threadId,
                    inReplyTo: activeEmail.id,
                });
                setIsComposeOpen(true);
                toast.success("AI draft generated in modal");
            } else {
                // Quick Action -> Inline
                setInlineReplyText(data.draft);
                setIsInlineReplyOpen(true);
                toast.success("AI draft ready inline");

                // Optional: Scroll to inline box
                setTimeout(() => {
                    document.getElementById('inline-reply-box')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 200);
            }
        } catch (error: any) {
            toast.error("Drafting failed: " + error.message);
        } finally {
            setIsDrafting(false);
            setDraftingIntent(null);
        }
    };

    const handleSendInlineReply = async () => {
        if (!activeEmail || !inlineReplyText.trim()) return;

        setIsSendingInline(true);
        try {
            const safeSubject = activeEmail.subject || "No Subject";
            const originalBody = emailState.emailDetails.get(activeEmail.id)?.bodyHtml || activeEmail.snippet;
            const quotation = `<br/><br/><div style="border-left: 2px solid #ccc; padding-left: 10px; color: #666;"><p>On ${new Date(activeEmail.date).toLocaleString()}, ${activeEmail.from} wrote:</p>${originalBody}</div>`;

            await sendEmailMutation.mutateAsync({
                id: agentId,
                to: activeEmail.from,
                subject: safeSubject.startsWith('Re:') ? safeSubject : `Re: ${safeSubject}`,
                body: inlineReplyText.replace(/\n/g, '<br/>') + quotation,
                threadId: activeEmail.threadId,
                inReplyTo: activeEmail.id,
                references: activeEmail.id
            });

            toast.success("Reply sent successfully!");
            setIsInlineReplyOpen(false);
            setInlineReplyText("");

            // Refresh emails to show updated status
            emailState.loadCachedEmails();
        } catch (error: any) {
            toast.error("Sending failed: " + error.message);
        } finally {
            setIsSendingInline(false);
        }
    };

    const createManualJiraTask = async (email: Email) => {
        if (!props.isJiraConnected) return toast.error("Please connect Jira first");
        if (!agentState.config?.jiraProjectKey) {
            toast.error("Please select a Jira project in Settings");
            setSettingsInitialTab('integrations');
            setSettingsOpen(true);
            return;
        }

        setIsCreatingJiraTask(true);
        try {
            const data = await createJiraTaskMutation.mutateAsync({
                id: agentId,
                email,
                projectKey: agentState.config.jiraProjectKey
            });

            toast.success(`Jira task created: ${data.issueKey}`);
        } catch (err: any) {
            toast.error("Failed to create Jira task: " + err.message);
        } finally {
            setIsCreatingJiraTask(false);
        }
    };

    const sendManualSlackMessage = async (email: Email) => {
        if (!props.isSlackConnected) return toast.error("Please connect Slack first");
        if (!agentState.config?.slackChannelId) {
            toast.error("Please select a Slack channel in Settings");
            setSettingsInitialTab('integrations');
            setSettingsOpen(true);
            return;
        }

        setIsSendingSlackMessage(true);
        try {
            await sendSlackMessageMutation.mutateAsync({
                id: agentId,
                email,
                channelId: agentState.config.slackChannelId
            });
            toast.success("Notification sent to Slack!");
        } catch (err: any) {
            toast.error("Failed to send Slack message: " + err.message);
        } finally {
            setIsSendingSlackMessage(false);
        }
    };

    const toggleEmailSelection = (id: string) => {
        const newSelected = new Set(selectedEmails);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedEmails(newSelected);
    };

    const selectAll = () => {
        if (selectedEmails.size === emailState.emails.length) setSelectedEmails(new Set());
        else setSelectedEmails(new Set(emailState.emails.map(e => e.id)));
    };

    const assignEmailToLabel = async (emailId: string, labelId: string) => {
        try {
            await applyLabelMutation.mutateAsync({
                id: agentId,
                labelId,
                emailIds: [emailId],
            });

            toast.success("Label applied");
            emailState.loadCachedEmails();
            labelState.fetchLabels();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    // ─── 5. Tutorial Steps ───────────────────────────────────────────────────
    const tutorialSteps: TutorialStep[] = [
        { id: 'welcome', title: 'Welcome to Spinabot!', content: 'Let\'s take a quick tour to show you how AI helps you manage your inbox with zero effort.', targetId: 'tutorial-welcome', placement: 'center' },
        { id: 'sidebar', title: 'Primary Navigation', content: 'Quickly switch between your Focused view, All Mail, and specialized productivity folders.', targetId: 'tutorial-sidebar-focus', placement: 'right' },
        { id: 'search', title: 'Intelligent Search', content: 'Find any email, attachment, or conversation instantly.', targetId: 'tutorial-search-container', placement: 'bottom' },
        {
            id: 'focus-view', title: 'Focused Productivity', content: 'The "Focus" view uses AI to extract urgent tasks and high-priority conversations.', targetId: 'tutorial-sidebar-focus', placement: 'right',
            onStepEnter: () => { setSelectedFolder('focus'); setSettingsOpen(false); }
        },
        { id: 'action-now', title: 'Action Required', content: 'Spinabot prioritizes critical emails here.', targetId: 'tutorial-action-now', placement: 'bottom', onStepEnter: () => setSelectedFolder('focus') },
        { id: 'action-card', title: 'AI Smart Scoring', content: 'Every email gets a priority score.', targetId: 'tutorial-action-card-0', placement: 'bottom', onStepEnter: () => setSelectedFolder('focus') },
        {
            id: 'all-mail', title: 'Every Connection', content: 'The "All Mail" view gives you a complete picture of your inbox.', targetId: 'tutorial-sidebar-inbox', placement: 'right',
            onStepEnter: () => setSelectedFolder('inbox')
        },
        { id: 'category-filters', title: 'Visual Categorization', content: 'Our AI automatically groups emails into folders.', targetId: 'tutorial-category-tabs', placement: 'bottom', onStepEnter: () => setSelectedFolder('inbox') },
        { id: 'attachments', title: 'Attachment Library', content: 'Never hunt for a file again.', targetId: 'tutorial-sidebar-attachments', placement: 'right', onStepEnter: () => setSelectedFolder('attachments') },
        { id: 'spam-rescue', title: 'Spam Rescue', content: 'Our AI monitors your spam folder.', targetId: 'tutorial-sidebar-spam', placement: 'right', onStepEnter: () => setSelectedFolder('spam') },
        { id: 'history', title: 'Activity Timeline', content: 'Track every action Spinabot takes.', targetId: 'tutorial-sidebar-history', placement: 'right', onStepEnter: () => setSelectedFolder('history') },
        { id: 'analytics', title: 'Inbox Intelligence', content: 'Get deep insights into your communication patterns.', targetId: 'tutorial-sidebar-analytics', placement: 'right', onStepEnter: () => setSelectedFolder('analytics') },
        { id: 'labels-sidebar', title: 'Smart Labels Workspace', content: 'Custom labels act as autonomous filters.', targetId: 'tutorial-labels-header', placement: 'right' },
        { id: 'toolkit-sync', title: 'Real-time Sync', content: 'Force a manual sync or refresh your view.', targetId: 'tutorial-refresh-btn', placement: 'bottom' },
        { id: 'toolkit-prefs', title: 'Sync Preferences', content: 'Configure how often Spinabot scans your inbox.', targetId: 'tutorial-sync-prefs-btn', placement: 'bottom' },
        { id: 'toolkit-layout', title: 'Desktop Reading Pane', content: 'Toggle the reading pane to browse emails side-by-side.', targetId: 'tutorial-reading-pane-toggle', placement: 'bottom' },
        { id: 'pagination', title: 'Bulk Navigation', content: 'Quickly move through thousands of emails.', targetId: 'tutorial-pagination-controls', placement: 'bottom' },
        { id: 'compose', title: 'Intelligent Compose', content: 'Write new emails with AI assistance.', targetId: 'tutorial-compose', placement: 'right' },
        {
            id: 'settings-general', title: 'Global Preferences', content: 'Manage your profile and core app preferences.', targetId: 'tutorial-tab-general', placement: 'bottom',
            onStepEnter: () => { setSettingsOpen(true); setSettingsInitialTab('general'); }
        },
        {
            id: 'settings-integrations', title: 'Automation Toolkit', content: 'Connect Jira, Slack, or Notion.', targetId: 'tutorial-tab-integrations', placement: 'bottom',
            onStepEnter: () => { setSettingsOpen(true); setSettingsInitialTab('integrations'); }
        },
        {
            id: 'settings-labels-create', title: 'Creating Intelligence', content: 'Define a new category in plain English.', targetId: 'tutorial-label-create', placement: 'bottom',
            onStepEnter: () => { setSettingsOpen(true); setSettingsInitialTab('labels'); }
        },
        {
            id: 'settings-labels-items', title: 'Model Fine-tuning', content: 'Review match accuracy and adjust label weights.', targetId: 'tutorial-labels-content', placement: 'bottom',
            onStepEnter: () => { setSettingsOpen(true); setSettingsInitialTab('labels'); }
        },
        {
            id: 'security-link', title: 'Privacy & Trust', content: 'Spinabot is built with enterprise-grade security.', targetId: 'tutorial-sidebar-security', placement: 'right',
            onStepEnter: () => { setSettingsOpen(false); setSelectedFolder('security'); }
        },
        {
            id: 'assistant', title: 'Conversational Assistant', content: 'Chat with your inbox.', targetId: 'tutorial-assistant', placement: 'bottom',
            onStepEnter: () => { setSettingsOpen(false); setSelectedFolder('focus'); }
        },
        { id: 'end', title: 'Dominate Your Inbox!', content: 'You\'re all set.', targetId: 'tutorial-welcome', placement: 'center' },
    ];

    const handleStartTutorial = () => {
        setSettingsOpen(false);
        tutorialState.startTutorial();
    };

    const handleTutorialComplete = () => {
        tutorialState.completeTutorial();
    };



    // Not Connected State
    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-8 animate-in fade-in duration-500 bg-background">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-[32px] rounded-full transition-all duration-1000" />
                    <div className="relative bg-card border border-border p-8 rounded-3xl shadow-2xl">
                        <Mail className="w-16 h-16 text-primary" />
                    </div>
                </div>

                <div className="max-w-md space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight text-foreground">
                        Connect Your Gmail
                    </h1>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                        Let Spinabot analyze and organize your inbox.
                        Connect your account to get started with intelligent email classification.
                    </p>
                </div>

                <Button
                    size="lg"
                    onClick={props.onConnect}
                    className="h-12 px-8 text-base shadow-lg"
                >
                    <Shield className="w-4 h-4 mr-2" />
                    Connect Securely
                </Button>
            </div>
        );
    }

    // Connected Dashboard - Theme Adaptive
    return (
        <div className="flex h-full w-full overflow-hidden bg-background text-foreground isolate">

            {/* Sidebar */}
            <aside
                id="tutorial-sidebar"
                className={cn(
                    "flex-shrink-0 border-r border-border bg-muted/10 flex flex-col transition-all duration-300 z-50",
                    sidebarCollapsed
                        ? "hidden md:flex md:w-16"
                        : "absolute inset-y-0 left-0 w-64 shadow-2xl md:static md:w-56 md:shadow-none bg-background md:bg-muted/10"
                )}
            >
                {/* Sidebar Header - Back to Setup */}
                <div className="p-3 flex items-center justify-between border-b border-border/50">
                    {!sidebarCollapsed && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                props.onOpenSettings();
                            }}
                            className="gap-2 text-muted-foreground hover:text-foreground"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span className="text-sm">Back to Setup</span>
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            const newCollapsed = !sidebarCollapsed;
                            setSidebarCollapsed(newCollapsed);
                            // If sidebar is being expanded, close chat panel
                            if (!newCollapsed && isChatPanelOpen) {
                                setIsChatPanelOpen(false);
                                setChatContext(null);
                            }
                        }}
                        className={cn("text-muted-foreground hover:text-foreground h-8 w-8", sidebarCollapsed && "mx-auto")}
                    >
                        <ChevronLeft className={cn("w-4 h-4 transition-transform", sidebarCollapsed && "rotate-180")} />
                    </Button>
                </div>

                {/* Main Navigation */}
                <div id="tutorial-compose" className={cn("p-4", sidebarCollapsed ? "px-2" : "px-4")}>
                    <Button
                        className={cn("bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-all active:scale-95",
                            sidebarCollapsed ? "w-10 h-10 p-0 rounded-full mx-auto flex" : "w-full gap-2")}
                        onClick={() => setIsComposeOpen(true)}
                    >
                        <Plus className={cn("transition-transform", sidebarCollapsed ? "w-5 h-5" : "w-4 h-4")} />
                        {!sidebarCollapsed && <span className="font-semibold">Compose</span>}
                    </Button>
                </div>

                <nav className="py-3 px-2 space-y-1">
                    {[
                        { id: 'focus', label: 'Focus', icon: Target, count: 0 },
                        { id: 'inbox', label: 'All Mail', icon: Mail, count: emailState.emails.length },
                        { id: 'attachments', label: 'Attachments', icon: Paperclip, count: emailState.emails.filter((e: any) => e.attachments && e.attachments.length > 0).reduce((acc: number, e: any) => acc + (e.attachments?.length || 0), 0) },
                        { id: 'spam', label: 'Spam Rescue', icon: Shield, count: 0 },
                        { id: 'history', label: 'History', icon: History, count: 0 },
                        { id: 'analytics', label: 'Analytics', icon: Activity, count: 0 },
                        { id: 'settings', label: 'Settings', icon: Settings, count: 0 },
                        { id: 'security', label: 'Security & Terms', icon: ShieldCheck, count: 0 },
                    ].map((item) => (
                        <button
                            key={item.id}
                            id={`tutorial-sidebar-${item.id}`}
                            onClick={() => {
                                setSelectedFolder(item.id);
                                emailState.setSelectedLabel(null); // Clear label filter when switching folders
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
                                selectedFolder === item.id
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <item.icon className={cn("w-4 h-4 flex-shrink-0", selectedFolder === item.id && "text-primary")} />
                            {!sidebarCollapsed && (
                                <>
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {item.count > 0 && (
                                        <Badge variant="secondary" className="h-5 px-1.5 text-xs font-medium">
                                            {item.count}
                                        </Badge>
                                    )}
                                </>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Custom Labels Section - MOVED ABOVE CATEGORIES */}
                {!sidebarCollapsed && (
                    <div className="px-2 py-3 border-t border-border/50">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <h3 id="tutorial-labels-header" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Labels
                            </h3>
                            <button
                                onClick={() => {
                                    setSettingsInitialTab('labels');
                                    setSettingsOpen(true);
                                }}
                                className="p-1 hover:bg-accent rounded transition-colors"
                                title="Create Label"
                            >
                                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                        </div>
                        {labelState.labels.length > 0 ? (
                            <div className="space-y-0.5">
                                {labelState.labels.map((label: any) => {
                                    const count = emailState.emails.filter((email: any) => email.customLabels?.includes(label.id)).length;
                                    const isSelected = emailState.selectedLabel === label.id;
                                    return (
                                        <button
                                            key={label.id}
                                            onClick={() => {
                                                emailState.setSelectedLabel(isSelected ? null : label.id);
                                                emailState.setSelectedCategory('all');
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all",
                                                isSelected
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-accent/50"
                                            )}
                                        >
                                            <Tag className="w-3.5 h-3.5" style={{ color: label.color }} />
                                            <span className="flex-1 text-left truncate">{label.name}</span>
                                            {count > 0 && (
                                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                    {count}
                                                </Badge>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground px-3 py-2">No labels yet. Click + to create.</p>
                        )}
                    </div>
                )}

                {/* Categories Section - NOW BELOW LABELS */}
                {!sidebarCollapsed && (
                    <div className="px-2 py-3 border-t border-border/50">
                        <h3 id="tutorial-categories-header" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                            Categories
                        </h3>
                        <div className="space-y-0.5">
                            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                                const count = emailState.categoryCounts[key] || 0;
                                if (count === 0) return null;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            emailState.setSelectedCategory(emailState.selectedCategory === key ? 'all' : key);
                                            emailState.setSelectedLabel(null); // Clear label filter
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all",
                                            emailState.selectedCategory === key
                                                ? config.bgClass
                                                : "text-muted-foreground hover:bg-accent/50"
                                        )}
                                    >
                                        <config.Icon className="w-4 h-4" />
                                        <span className="flex-1 text-left truncate">{config.label}</span>
                                        <Badge variant="secondary" className="h-4 px-1 text-[10px] font-medium bg-background/50">
                                            {count}
                                        </Badge>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Collapsed Categories - Icons only */}

                {/* Collapsed Labels Section */}
                {sidebarCollapsed && labelState.labels.length > 0 && (
                    <div className="px-2 py-3 border-t border-border/50 space-y-1">
                        {labelState.labels.slice(0, 5).map((label: any) => {
                            const count = emailState.emails.filter((email: any) => email.customLabels?.includes(label.id)).length;
                            const isSelected = emailState.selectedLabel === label.id;
                            return (
                                <button
                                    key={label.id}
                                    onClick={() => {
                                        emailState.setSelectedLabel(isSelected ? null : label.id);
                                        emailState.setSelectedCategory('all');
                                    }}
                                    className={cn(
                                        "relative w-full flex items-center justify-center py-2 rounded-md transition-all",
                                        isSelected
                                            ? "bg-primary/10"
                                            : "hover:bg-accent/50"
                                    )}
                                    title={`${label.name}${count > 0 ? ` (${count})` : ''}`}
                                >
                                    <Tag className="w-5 h-5" style={{ color: label.color }} />
                                    {count > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                            {count > 9 ? '9+' : count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                        {labelState.labels.length > 5 && (
                            <button
                                onClick={() => {
                                    setSettingsInitialTab('labels');
                                    setSettingsOpen(true);
                                }}
                                className="w-full flex items-center justify-center py-2 rounded-md hover:bg-accent/50 transition-all"
                                title="View all labels"
                            >
                                <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                            </button>
                        )}
                    </div>
                )}

                {/* Collapsed Categories Section */}
                {sidebarCollapsed && (
                    <div className="px-2 py-3 border-t border-border/50 space-y-1">
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                            const count = emailState.categoryCounts[key] || 0;
                            if (count === 0) return null;
                            return (
                                <button
                                    key={key}
                                    onClick={() => emailState.setSelectedCategory(emailState.selectedCategory === key ? 'all' : key)}
                                    className={cn(
                                        "w-full flex items-center justify-center py-2 text-lg rounded-md transition-all",
                                        emailState.selectedCategory === key
                                            ? config.bgClass
                                            : "hover:bg-accent/50"
                                    )}
                                    title={`${config.label} (${count})`}
                                >
                                    <config.Icon className="w-5 h-5" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </aside>

            {/* Main Content - Fixed Layout Split View */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* SHARED HEADER - Spans full width above both panes */}
                <header className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Connected Tools - Logo Row */}
                        <div className="flex items-center gap-2">
                            {/* Gmail - Always Primary */}
                            <div className={cn("relative group flex items-center justify-center w-8 h-8 rounded-full border transition-all",
                                isConnected ? "bg-white border-emerald-200 shadow-sm" : "bg-muted border-transparent opacity-50 grayscale")}>
                                <Image src="/logos/gmail.svg" alt="Gmail" width={18} height={18} className="w-4.5 h-4.5" />
                                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full transition-transform scale-0 group-hover:scale-100" />
                            </div>

                            {/* Divider if other integrations exist */}
                            {(props.isSlackConnected || props.isJiraConnected || props.isNotionConnected) && (
                                <div className="h-4 w-[1px] bg-border mx-1" />
                            )}

                            {/* Slack */}
                            {props.isSlackConnected && (
                                <div className="relative group flex items-center justify-center w-8 h-8 rounded-full bg-white border border-emerald-200 shadow-sm" title="Slack Connected">
                                    <Image src="/logos/slack.svg" alt="Slack" width={18} height={18} className="w-4.5 h-4.5" />
                                    <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full transition-transform scale-0 group-hover:scale-100" />
                                </div>
                            )}

                            {/* Jira */}
                            {props.isJiraConnected && (
                                <div className="relative group flex items-center justify-center w-8 h-8 rounded-full bg-white border border-emerald-200 shadow-sm" title="Jira Connected">
                                    <Image src="/logos/jira.svg" alt="Jira" width={18} height={18} className="w-4.5 h-4.5" />
                                    <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full transition-transform scale-0 group-hover:scale-100" />
                                </div>
                            )}

                            {/* Notion */}
                            {props.isNotionConnected && (
                                <div className="relative group flex items-center justify-center w-8 h-8 rounded-full bg-white border border-emerald-200 shadow-sm" title="Notion Connected">
                                    <Image src="/logos/notion.svg" alt="Notion" width={18} height={18} className="w-4.5 h-4.5" />
                                    <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full transition-transform scale-0 group-hover:scale-100" />
                                </div>
                            )}

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 ml-2 gap-1.5 text-xs font-medium border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 transition-all rounded-full px-3 shadow-sm"
                                onClick={() => {
                                    setSettingsInitialTab('integrations');
                                    setSettingsOpen(true);
                                }}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Integrations</span>
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 md:hidden">
                            <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(false)}>
                                <Menu className="w-5 h-5" />
                            </Button>
                            <span className="font-bold">SPINaBOT</span>
                        </div>
                    </div>

                    <div className="flex-1 max-w-md px-2 hidden md:block">
                        <div id="tutorial-search-container" className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search emails..."
                                className="pl-9 h-9 bg-background/50 focus:bg-background transition-colors"
                                value={emailState.searchQuery}
                                onChange={(e) => emailState.setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">

                        <Button
                            id="tutorial-assistant"
                            variant={isChatPanelOpen ? "default" : "ghost"}
                            size="icon"
                            onClick={() => {
                                const willOpen = !isChatPanelOpen;
                                setIsChatPanelOpen(willOpen);
                                if (willOpen) setSidebarCollapsed(true);
                            }}
                            className={cn("h-9 w-9", isChatPanelOpen && "bg-primary text-primary-foreground")}
                            title="AI Assistant"
                        >
                            <Sparkles className="w-4 h-4" />
                        </Button>

                        <Button
                            id="tutorial-settings"
                            variant="ghost"
                            size="icon"
                            onClick={() => setSettingsOpen(true)}
                            title="Settings"
                            className="h-9 w-9"
                        >
                            <Settings className="w-4 h-4" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={tutorialState.startTutorial}
                            title="Show User Guide"
                            className="h-9 w-9 text-muted-foreground hover:text-primary transition-colors"
                        >
                            <HelpCircle className="w-4 h-4" />
                        </Button>

                        <Avatar className="h-8 w-8 border ring-1 ring-border cursor-pointer transition-opacity hover:opacity-80" onClick={() => setSettingsOpen(true)}>
                            {/* Show fetched profile picture in header too */}
                            {agentState.config?.gmailProfilePicture ? (
                                <AvatarImage src={agentState.config.gmailProfilePicture} alt="Profile" />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {(agentState.config?.gmailProfileName?.[0] || agentState.config?.gmailEmail?.[0])?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </header>

                {/* SHARED TOOLBAR - Controls + Categories */}
                <div id="tutorial-sync-refresh" className="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between bg-background/50 backdrop-blur">
                    <div className="flex items-center gap-2">

                        <Button
                            id="tutorial-refresh-btn"
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={emailState.isSyncing}
                            className={cn("gap-2 h-8", emailState.isSyncing && "animate-pulse")}
                            title="Sync Emails"
                        >
                            <RefreshCw className={cn("w-4 h-4", emailState.isSyncing && "animate-spin")} />
                            {emailState.isSyncing && <span className="text-xs truncate max-w-[80px]">Syncing...</span>}
                        </Button>
                        <Button id="tutorial-sync-prefs-btn" variant="ghost" size="icon" onClick={() => setShowSyncModal(true)} className="h-8 w-8" title="Sync Preferences">
                            <Settings className="w-4 h-4" />
                        </Button>

                        <div id="tutorial-category-tabs" className="hidden md:flex items-center gap-2 ml-2 overflow-x-auto no-scrollbar">
                            {CATEGORY_TABS.map(tab => {
                                const isActive = emailState.selectedCategory === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => { emailState.setSelectedCategory(tab.id); emailState.setCurrentPage(1); }}
                                        className={cn("flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full border transition-all",
                                            isActive ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                        )}
                                    >
                                        {tab.label} {emailState.categoryCounts[tab.id] > 0 && <span className="opacity-75 ml-1">({emailState.categoryCounts[tab.id]})</span>}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md border border-border/50">
                            {emailState.filteredEmails.length > 0
                                ? `${(emailState.currentPage - 1) * emailState.pageSize + 1}-${Math.min(emailState.currentPage * emailState.pageSize, emailState.filteredEmails.length)} of ${emailState.filteredEmails.length}`
                                : '0'}
                        </span>
                        <div id="tutorial-pagination-controls" className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" disabled={emailState.currentPage <= 1} onClick={() => emailState.setCurrentPage(p => Math.max(1, p - 1))} className="h-7 w-7"><ChevronLeft className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" disabled={emailState.currentPage >= emailState.totalPages} onClick={() => emailState.setCurrentPage(p => Math.min(emailState.totalPages, p + 1))} className="h-7 w-7"><ChevronRight className="w-4 h-4" /></Button>
                        </div>
                        <div className="border-l border-border pl-2 flex items-center gap-1">
                            <Button
                                variant={isReadingPaneOpen ? "secondary" : "ghost"}
                                size="sm"
                                className="gap-2 h-7 px-2"
                                id="tutorial-reading-pane-toggle"
                                onClick={() => setIsReadingPaneOpen(!isReadingPaneOpen)}
                                title={isReadingPaneOpen ? "Close Reading Pane" : "Open Reading Pane"}
                            >
                                <PanelRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Advanced Filters Bar */}
                <div id="tutorial-filters-sort" className="flex-shrink-0 px-4 py-2 border-b border-border bg-muted/20">
                    <FilterToolbar
                        emails={emailState.emails}
                        filters={emailState.advancedFilters}
                        sort={emailState.sortConfig}
                        onFiltersChange={emailState.setAdvancedFilters}
                        onSortChange={emailState.setSortConfig}
                        onClearFilters={() => emailState.setAdvancedFilters({
                            categories: [],
                            priorities: [],
                            senders: [],
                            dateRange: "all",
                            readStatus: "all",
                            hasAttachment: null,
                        })}
                    />
                </div>

                {/* SPLIT VIEW - Email List + Reading Pane (same level) */}
                <div className="flex-1 flex overflow-hidden">
                    {selectedFolder === 'settings' ? (
                        <div className="flex-1 flex flex-col bg-muted/10 animate-in fade-in duration-300">
                            {/* Settings Header */}
                            <div className="flex-shrink-0 px-8 py-6 border-b border-border bg-background/50">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
                                <p className="text-muted-foreground text-sm mt-1">Manage your integrations and automation rules.</p>
                            </div>

                            {/* Settings Content - Better Layout */}
                            <div className="flex-1 flex flex-col gap-6 p-6 overflow-auto">
                                {/* Top Row: Account + Integrations (side by side) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
                                    {/* Account Card (Now includes Gmail) */}
                                    <div className="rounded-xl border border-border bg-card p-4">
                                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5" />
                                                Account
                                            </div>
                                            {/* Gmail Connection Status Badge in Header */}
                                            {isConnected && (
                                                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/20">
                                                    <Image src="/logos/gmail.svg" alt="Gmail" width={12} height={12} className="w-3 h-3" />
                                                    Connected
                                                </div>
                                            )}
                                        </h3>

                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border border-border">
                                                {/* Prioritize Gmail Profile Picture if connected */}
                                                {agentState.config?.gmailProfilePicture ? (
                                                    <AvatarImage src={agentState.config.gmailProfilePicture} alt="Profile" />
                                                ) : null}
                                                <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-primary-foreground font-medium text-sm">
                                                    {/* Use Gmail Name Initial if available, else User Email Initial */}
                                                    {(agentState.config?.gmailProfileName?.[0] || agentState.config?.gmailEmail?.[0])?.toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                {/* Show Gmail Name if available */}
                                                <p className="font-medium text-sm text-foreground truncate">
                                                    {agentState.config?.gmailProfileName || agentState.config?.gmailEmail?.split('@')[0]}
                                                </p>
                                                {/* Show Gmail Email if connected, else User Email */}
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {agentState.config?.gmailEmail || "Not Connected"}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-xs hover:bg-red-500/10 hover:text-red-500"
                                                onClick={isConnected ? props.onDisconnectGmail : () => {
                                                    if (props.handleSignOut) {
                                                        props.handleSignOut();
                                                    } else {
                                                        window.location.href = '/api/auth/signout';
                                                    }
                                                }}
                                                title={isConnected ? "Disconnect Gmail" : "Sign Out"}
                                            >
                                                <LogOut className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Integrations Card (Gmail removed, Slack added) */}
                                    <div className="rounded-xl border border-border bg-card p-4">
                                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                                            Integrations
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            {/* Slack (Moved here) */}
                                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 flex-1">
                                                <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center shrink-0">
                                                    <Image src="/logos/slack.svg" alt="Slack" width={18} height={18} className="w-4.5 h-4.5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium">Slack</p>
                                                </div>
                                                {props.isSlackConnected ? (
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                ) : (
                                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={props.onConnectSlack}>Connect</Button>
                                                )}
                                            </div>

                                            {/* Jira */}
                                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 flex-1">
                                                <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center shrink-0">
                                                    <Image src="/logos/jira.svg" alt="Jira" width={18} height={18} className="w-4.5 h-4.5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium">Jira</p>
                                                </div>
                                                {props.isJiraConnected ? (
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                ) : (
                                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={props.onConnectJira}>Connect</Button>
                                                )}
                                            </div>

                                            {/* Notion */}
                                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 flex-1">
                                                <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center shrink-0">
                                                    <Image src="/logos/notion.svg" alt="Notion" width={18} height={18} className="w-4.5 h-4.5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium">Notion</p>
                                                </div>
                                                {props.isNotionConnected ? (
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                ) : (
                                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={props.onConnectNotion}>Connect</Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>


                                </div>

                                {/* Bottom Row: Automation Rules + Knowledge Base (side by side, equal height) */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                                    {/* Automation Rules - Left */}
                                    <div className="rounded-xl border border-border bg-card p-4 flex flex-col overflow-auto">
                                        <AutomationRulesManager
                                            agentId={agentId}
                                            isJiraConnected={props.isJiraConnected || false}
                                            isNotionConnected={props.isNotionConnected || false}
                                            isSlackConnected={props.isSlackConnected || false}
                                            onConnectSlack={props.onConnectSlack}
                                            rules={ruleState.rules}
                                            onRefresh={ruleState.fetchRules}
                                            isLoadingRules={ruleState.isLoading}
                                        />
                                    </div>

                                    {/* Knowledge Base - Right */}
                                    <div className="rounded-xl border border-border bg-card p-4 flex flex-col overflow-hidden">
                                        <KnowledgeBaseSettings onRefresh={(refreshFn) => { refreshKnowledgeRef.current = refreshFn; }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : selectedFolder === 'history' ? (
                        <div className="flex-1 flex flex-col bg-muted/10 animate-in fade-in duration-300">
                            {/* History Header */}
                            <div className="flex-shrink-0 px-8 py-6 border-b border-border bg-background/50">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">Activity History</h2>
                                <p className="text-muted-foreground text-sm mt-1">Track all automated actions, connections, and changes.</p>
                            </div>

                            {/* Activity History Content */}
                            <ActivityHistory agentId={agentId} className="flex-1" />
                        </div>
                    ) :
                        selectedFolder === 'focus' ? (
                            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-muted/10">
                                <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <FocusView
                                        agentId={agentId}
                                        onEmailClick={(emailId) => {
                                            setSelectedFolder('inbox');
                                            setActiveEmailId(emailId);
                                            setIsReadingPaneOpen(true);
                                            emailState.fetchEmailDetails(emailId);
                                        }}
                                        onViewAllMail={() => setSelectedFolder('inbox')}
                                    />
                                </div>
                            </div>
                        ) : selectedFolder === 'attachments' ? (
                            <AttachmentsView
                                emails={emailState.emails}
                                onSelectEmail={(emailId) => {
                                    setSelectedFolder('inbox');
                                    setActiveEmailId(emailId);
                                    setIsReadingPaneOpen(true);
                                    emailState.fetchEmailDetails(emailId);
                                }}
                                className="animate-in fade-in duration-300"
                            />
                        ) : selectedFolder === 'spam' ? (
                            <div className="flex-1 flex flex-col bg-muted/10 animate-in fade-in duration-300">
                                <SpamRescueView
                                    agentId={agentId}
                                    className="flex-1"
                                    onEmailSelect={(emailId) => {
                                        setSelectedFolder('inbox');
                                        setActiveEmailId(emailId);
                                        setIsReadingPaneOpen(true);
                                        emailState.fetchEmailDetails(emailId);
                                    }}
                                />
                            </div>
                        ) : selectedFolder === 'analytics' ? (
                            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-muted/10">
                                <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">Inbox Analytics</h2>
                                        <p className="text-muted-foreground text-lg">Insights and health metrics for your email communications.</p>
                                    </div>
                                    <AnalyticsWidget emails={emailState.emails} stats={emailState.stats} className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" />
                                </div>
                            </div>
                        ) : selectedFolder === 'security' ? (
                            <SecurityTermsView />
                        ) : (
                            <>
                                {/* EMAIL LIST PANE */}
                                <div className={cn(
                                    "flex flex-col border-r border-border bg-background flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
                                    isReadingPaneOpen ? "hidden md:flex w-full md:w-[380px] lg:w-[420px] resize-x" : "w-full flex"
                                )}>

                                    {/* Scrollable Email List */}
                                    <div className="flex-1 overflow-y-auto min-h-0">
                                        {emailState.isLoading ? (
                                            <div className="p-4 space-y-4">
                                                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-muted/40 rounded-lg animate-pulse" />)}
                                            </div>
                                        ) : emailState.emails.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                                                <Inbox className="w-10 h-10 opacity-20 mb-2" />
                                                <span className="text-sm">No emails found</span>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Action Now - Smart Priority Cards */}
                                                {selectedFolder === 'inbox' && emailState.selectedCategory === 'all' && !emailState.selectedLabel && (
                                                    <div id="tutorial-action-now" className="border-b border-border/50">
                                                        <ActionNowSection
                                                            agentId={agentId || ''}
                                                            isConnected={isConnected}
                                                            onSelectEmail={(id) => {
                                                                setActiveEmailId(id);
                                                                setIsReadingPaneOpen(true);
                                                                emailState.fetchEmailDetails(id);
                                                            }}
                                                            onReplyWithDraft={(email, draft) => {
                                                                setActiveEmailId(email.id);
                                                                setIsReadingPaneOpen(true);
                                                                emailState.fetchEmailDetails(email.id);

                                                                // Use inline reply for a faster workflow
                                                                setInlineReplyText(draft);
                                                                setIsInlineReplyOpen(true);

                                                                // Scroll to inline box
                                                                setTimeout(() => {
                                                                    document.getElementById('inline-reply-box')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                                                }, 300);
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Daily Digest - AI-Powered Summary */}
                                                {selectedFolder === 'inbox' && emailState.selectedCategory === 'all' && !emailState.selectedLabel && (
                                                    <div className="px-4 pt-4">
                                                        <DailyDigest
                                                            agentId={agentId}
                                                            isConnected={isConnected}
                                                            onEmailClick={(emailId) => {
                                                                setActiveEmailId(emailId);
                                                                setIsReadingPaneOpen(true);
                                                                emailState.fetchEmailDetails(emailId);
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Priority Section */}
                                                {priorityEmails.length > 0 && (
                                                    <div className="border-b border-border/40 bg-red-50/30 dark:bg-zinc-900/50">
                                                        <div className="px-4 py-2 flex items-center gap-2 text-red-600 dark:text-red-400/80">
                                                            <AlertCircle className="w-3.5 h-3.5" />
                                                            <span className="text-xs font-semibold uppercase tracking-wide opacity-90">Requires Attention ({priorityEmails.length})</span>
                                                        </div>
                                                        <div className="divide-y divide-border/20">
                                                            {priorityEmails.map((email) => {
                                                                const senderInfo = getSenderInfo(email.from);
                                                                const isActive = activeEmailId === email.id;
                                                                return (
                                                                    <div
                                                                        key={`priority-${email.id}`}
                                                                        onClick={() => {
                                                                            setActiveEmailId(email.id);
                                                                            setIsReadingPaneOpen(true);
                                                                            emailState.fetchEmailDetails(email.id);
                                                                        }}
                                                                        className={cn(
                                                                            "px-4 py-2 cursor-pointer transition-all hover:bg-muted/30 dark:hover:bg-red-900/10 border-l-2",
                                                                            isActive
                                                                                ? "bg-muted/50 dark:bg-zinc-800/50 border-l-red-500"
                                                                                : "border-l-transparent border-l-red-500/30 hover:border-l-red-500/50"
                                                                        )}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                                <Avatar className="h-5 w-5 shrink-0 text-[10px]">
                                                                                    <AvatarFallback className="bg-red-500/80 text-white">{senderInfo.initials}</AvatarFallback>
                                                                                </Avatar>
                                                                                <span className="text-[13px] font-semibold text-foreground/90 truncate">{senderInfo.name}</span>
                                                                            </div>
                                                                            <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[10px] h-4 border-0">Action</Badge>
                                                                        </div>
                                                                        <h4 className="text-[13px] font-medium text-foreground/80 truncate mt-0.5">{email.subject}</h4>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Regular Email List */}
                                                <div className="divide-y divide-border/30">
                                                    {paginatedEmails.map((email) => {
                                                        const isSelected = selectedEmails.has(email.id);
                                                        const isActive = activeEmailId === email.id;
                                                        const senderInfo = getSenderInfo(email.from);
                                                        const isUrgent = email.category === 'requires_action' || email.priority === 'high';

                                                        return (
                                                            <div
                                                                key={email.id}
                                                                onClick={() => {
                                                                    setActiveEmailId(email.id);
                                                                    setIsReadingPaneOpen(true);
                                                                    emailState.fetchEmailDetails(email.id);
                                                                }}
                                                                className={cn(
                                                                    "group relative px-3 py-2 cursor-pointer transition-all border-l-2 border-b border-border/50 email-list-item", // Added email-list-item class
                                                                    "hover:bg-muted/50 dark:hover:bg-gradient-to-r dark:hover:from-zinc-900 dark:hover:to-neutral-900",
                                                                    isActive ? "bg-primary/5 dark:bg-gradient-to-r dark:from-zinc-900 dark:to-neutral-900 border-l-primary" : "border-l-transparent",
                                                                    isUrgent && !isActive && "border-l-red-500",
                                                                    !email.isRead && !isActive && "bg-muted/20 dark:bg-zinc-900/30"
                                                                )}
                                                            >
                                                                {/* Row 1: Sender + Date */}
                                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                        {/* Smart Score - HIDDEN in list view per request */}

                                                                        <Avatar className="h-5 w-5 shrink-0 text-[10px]">
                                                                            {/* Use grayscale for non-urgent items, colors for urgent */}
                                                                            <AvatarFallback className={cn(
                                                                                isUrgent ? senderInfo.color + " text-white" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                                                            )}>
                                                                                {senderInfo.initials}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <span className={cn("text-[13px] truncate", !email.isRead ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                                                                            {senderInfo.name}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                                                                        {new Date(email.date).toLocaleDateString() === new Date().toLocaleDateString()
                                                                            ? new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                            : new Date(email.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                    </span>
                                                                </div>

                                                                {/* Row 2: Subject + Badge */}
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className={cn("text-[13px] truncate flex-1", !email.isRead ? "font-semibold text-foreground" : "text-foreground/80")}>
                                                                        {email.subject}
                                                                    </h4>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        {email.silenceReason && (
                                                                            <Badge className="text-[9px] px-1.5 h-5 bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 gap-1 font-bold">
                                                                                <VolumeX className="w-2.5 h-2.5" />
                                                                                SILENCED
                                                                            </Badge>
                                                                        )}
                                                                        <Badge className={cn("text-[10px] px-1.5 h-5 min-w-[20px] shrink-0 font-medium flex items-center justify-center", getCategoryStyle(email.category))}>
                                                                            {/* Only show icon, no text label */}
                                                                            {email.category === 'promotional' && <Tag className="w-3 h-3" />}
                                                                            {email.category === 'updates' && <RefreshCw className="w-3 h-3" />}
                                                                            {email.category === 'newsletters' && <Newspaper className="w-3 h-3" />}
                                                                            {email.category === 'requires_action' && <AlertCircle className="w-3 h-3" />}
                                                                            {!['promotional', 'updates', 'newsletters', 'requires_action'].includes(email.category) && <Mail className="w-3 h-3" />}
                                                                        </Badge>
                                                                    </div>
                                                                </div>


                                                                {/* Row 3: Custom Labels */}
                                                                {email.customLabels && email.customLabels.length > 0 && (
                                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                        {email.customLabels.map((labelId: string) => {
                                                                            const label = labelState.labels.find(l => l.id === labelId);
                                                                            if (!label) return null;
                                                                            return (
                                                                                <Badge
                                                                                    key={labelId}
                                                                                    className="text-[10px] px-2 h-5 font-medium"
                                                                                    style={{
                                                                                        backgroundColor: `${label.color}20`,
                                                                                        color: label.color,
                                                                                        border: `1px solid ${label.color}40`
                                                                                    }}
                                                                                >
                                                                                    <Tag className="w-2.5 h-2.5 mr-1" />
                                                                                    {label.name}
                                                                                </Badge>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* READING PANE: Flex-1 fills remaining space */}
                                {isReadingPaneOpen && (
                                    <div className={cn(
                                        "flex-1 flex-col bg-background min-w-0 h-full border-l border-border/50 email-reading-pane", // Added email-reading-pane class
                                        "flex animate-in fade-in duration-300 slide-in-from-right-4 md:animate-none md:slide-in-from-right-0"
                                    )}>
                                        {activeEmail ? (
                                            <div className="flex flex-col h-full animate-in fade-in duration-300">
                                                {/* Reading Pane Toolbar */}
                                                <div className="flex-shrink-0 h-[60px] border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => setActiveEmailId(null)} className="md:hidden"><ChevronLeft className="w-4 h-4" /></Button>
                                                        <div className="flex items-center gap-1.5 text-muted-foreground mr-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><Archive className="w-4 h-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><Trash2 className="w-4 h-4" /></Button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {/* Chat with Agent Button */}
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="gap-2 h-8.5 rounded-full px-4 text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 border-none"
                                                            onClick={() => {
                                                                if (activeEmail) {
                                                                    setChatContext({
                                                                        type: 'email',
                                                                        id: activeEmail.id,
                                                                        subject: activeEmail.subject,
                                                                        sender: activeEmail.from,
                                                                        snippet: activeEmail.snippet,
                                                                        threadId: activeEmail.threadId
                                                                    });
                                                                    setIsChatPanelOpen(true);
                                                                }
                                                            }}
                                                        >
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            Chat
                                                        </Button>

                                                        {/* Add to Label Dropdown */}
                                                        {labelState.labels.length > 0 && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-full" title="Assign Label">
                                                                        <Tag className="w-4 h-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48">
                                                                    <DropdownMenuLabel className="text-xs">Assign to Label</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    {labelState.labels.map((label: any) => (
                                                                        <DropdownMenuItem
                                                                            key={label.id}
                                                                            onClick={() => assignEmailToLabel(activeEmail.id, label.id)}
                                                                            className="gap-2 text-xs"
                                                                        >
                                                                            <Tag className="w-3 h-3" style={{ color: label.color }} />
                                                                            {label.name}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}

                                                        {/* Action Dropdown - Create Task */}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="gap-1.5 h-8 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                                                                    disabled={isCreatingJiraTask}
                                                                >
                                                                    {isCreatingJiraTask ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                    )}
                                                                    Create
                                                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56">
                                                                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                                                                    Actions
                                                                </DropdownMenuLabel>
                                                                <DropdownMenuSeparator />

                                                                {/* Jira Task */}
                                                                <DropdownMenuItem
                                                                    disabled={!props.isJiraConnected}
                                                                    onClick={() => activeEmail && createManualJiraTask(activeEmail)}
                                                                >
                                                                    <Image src="/logos/jira.svg" alt="Jira" width={14} height={14} className="mr-2 grayscale-0" />
                                                                    <span>Create Issue</span>
                                                                    {!props.isJiraConnected && <span className="ml-auto text-[10px] text-muted-foreground">(Connect)</span>}
                                                                </DropdownMenuItem>

                                                                {/* Notion Page */}
                                                                <DropdownMenuItem
                                                                    disabled={!props.isNotionConnected}
                                                                    onClick={() => {
                                                                        if (activeEmail) {
                                                                            setNotionInitialData({
                                                                                title: activeEmail.subject || "No Subject",
                                                                                content: stripHtml(activeEmail.body || activeEmail.snippet || ""),
                                                                            });
                                                                            setIsNotionDialogOpen(true);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Image src="/logos/notion.svg" alt="Notion" width={14} height={14} className="mr-2 grayscale-0" />
                                                                    <span>Create Page</span>
                                                                    {!props.isNotionConnected && <span className="ml-auto text-[10px] text-muted-foreground">(Connect)</span>}
                                                                </DropdownMenuItem>

                                                                {/* Slack Message */}
                                                                <DropdownMenuItem
                                                                    disabled={!props.isSlackConnected || isSendingSlackMessage}
                                                                    onClick={() => activeEmail && sendManualSlackMessage(activeEmail)}
                                                                >
                                                                    {isSendingSlackMessage ? (
                                                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Image src="/logos/slack.svg" alt="Slack" width={14} height={14} className="mr-2 grayscale-0" />
                                                                    )}
                                                                    <span>{isSendingSlackMessage ? 'Sending...' : 'Send Message'}</span>
                                                                    {!props.isSlackConnected && <span className="ml-auto text-[10px] text-muted-foreground">(Connect)</span>}
                                                                </DropdownMenuItem>

                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="gap-2 text-xs">
                                                                    <Settings className="w-3.5 h-3.5" />
                                                                    Manage Integrations
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>

                                                        <Button variant="ghost" size="icon" onClick={() => { setIsReadingPaneOpen(false); setActiveEmailId(null); }} title="Close Preview"><X className="w-5 h-5 text-muted-foreground/70 hover:text-foreground" /></Button>
                                                        <Button variant="ghost" size="icon"><Star className="w-4 h-4" /></Button>
                                                        <Button variant="ghost" size="icon" title="Chat about this email"><MessageSquare className="w-4 h-4" /></Button>
                                                    </div>
                                                </div>

                                                {/* Email Content */}
                                                <div className="flex-1 overflow-y-auto p-8">
                                                    <div className="max-w-3xl mx-auto">
                                                        <h1 className="text-2xl font-bold text-foreground mb-6 leading-tigher">{activeEmail.subject}</h1>

                                                        <div className="flex items-start justify-between mb-8 pb-6 border-b border-border">
                                                            <div className="flex items-center gap-4">
                                                                <Avatar className="h-12 w-12">
                                                                    <AvatarFallback className={cn("text-white text-lg", getSenderInfo(activeEmail.from).color)}>{getSenderInfo(activeEmail.from).initials}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="font-semibold text-foreground text-lg">{getSenderInfo(activeEmail.from).name}</div>
                                                                    <div className="text-muted-foreground text-sm">{activeEmail.from}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right text-sm text-muted-foreground flex flex-col items-end gap-1">
                                                                <div>{new Date(activeEmail.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                                                <div className="flex items-center gap-2">
                                                                    <div>{new Date(activeEmail.date).toLocaleTimeString()}</div>
                                                                    {/* Smart Score Badge - Shown in Preview */}
                                                                    {(activeEmail as any).smartScore && (activeEmail as any).smartScore >= 50 && (
                                                                        <SmartScoreBadge
                                                                            score={(activeEmail as any).smartScore}
                                                                            level={(activeEmail as any).smartLevel || 'medium'}
                                                                            size="small"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Attachments Section */}
                                                        {emailState.emailDetails.get(activeEmail.id)?.attachments?.length > 0 && (
                                                            <EmailAttachmentsWithPreview
                                                                attachments={emailState.emailDetails.get(activeEmail.id).attachments}
                                                                emailId={activeEmail.id}
                                                                agentId={agentId}
                                                                onNavigateToAttachments={() => setSelectedFolder("attachments")}
                                                            />
                                                        )}

                                                        {/* Loading State */}
                                                        {emailState.loadingEmailId === activeEmail.id && (
                                                            <div className="flex items-center justify-center py-12">
                                                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                                <span className="ml-2 text-sm text-muted-foreground">Loading email content...</span>
                                                            </div>
                                                        )}

                                                        {/* Email Body */}
                                                        {!emailState.loadingEmailId && emailState.emailDetails.has(activeEmail.id) ? (
                                                            <EmailBodyRenderer
                                                                htmlBody={emailState.emailDetails.get(activeEmail.id)?.bodyHtml || (activeEmail as any).body}
                                                                textBody={emailState.emailDetails.get(activeEmail.id)?.bodyText || activeEmail.snippet}
                                                            />
                                                        ) : !emailState.loadingEmailId ? (
                                                            <div className="prose prose-slate dark:prose-invert max-w-none">
                                                                <div className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-light text-base">
                                                                    {activeEmail.snippet}
                                                                </div>
                                                            </div>
                                                        ) : null}

                                                        <div className="mt-12 pt-8 border-t border-border/60">
                                                            <div className="flex flex-col gap-6">
                                                                {/* Primary Actions */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <Button
                                                                            variant="default"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                if (activeEmail) {
                                                                                    setComposeData({
                                                                                        to: activeEmail.from,
                                                                                        subject: activeEmail.subject?.startsWith('Re:')
                                                                                            ? activeEmail.subject
                                                                                            : `Re: ${activeEmail.subject}`,
                                                                                        body: `<br/><br/><div style="border-left: 2px solid #ccc; padding-left: 10px; color: #666;"><p>On ${new Date(activeEmail.date).toLocaleString()}, ${activeEmail.from} wrote:</p>${emailState.emailDetails.get(activeEmail.id)?.bodyHtml || activeEmail.snippet}</div>`,
                                                                                        threadId: activeEmail.threadId,
                                                                                        inReplyTo: activeEmail.id,
                                                                                        references: activeEmail.id,
                                                                                    });
                                                                                    setIsComposeOpen(true);
                                                                                }
                                                                            }}
                                                                            className="h-9 px-5 gap-2 font-medium shadow-sm transition-all hover:scale-[1.02]"
                                                                        >
                                                                            <Reply className="w-4 h-4" />
                                                                            Reply
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                if (activeEmail) {
                                                                                    const allRecipients = [activeEmail.from];
                                                                                    setComposeData({
                                                                                        to: allRecipients.join(', '),
                                                                                        subject: activeEmail.subject?.startsWith('Re:')
                                                                                            ? activeEmail.subject
                                                                                            : `Re: ${activeEmail.subject}`,
                                                                                        body: `<br/><br/><div style="border-left: 2px solid #ccc; padding-left: 10px; color: #666;"><p>On ${new Date(activeEmail.date).toLocaleString()}, ${activeEmail.from} wrote:</p>${emailState.emailDetails.get(activeEmail.id)?.bodyHtml || activeEmail.snippet}</div>`,
                                                                                        threadId: activeEmail.threadId,
                                                                                        inReplyTo: activeEmail.id,
                                                                                        references: activeEmail.id,
                                                                                    });
                                                                                    setIsComposeOpen(true);
                                                                                }
                                                                            }}
                                                                            className="h-9 gap-2 border-border/40 hover:bg-muted/50"
                                                                        >
                                                                            <ReplyAll className="w-4 h-4" />
                                                                            Reply All
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                if (activeEmail) {
                                                                                    setComposeData({
                                                                                        subject: activeEmail.subject?.startsWith('Fwd:')
                                                                                            ? activeEmail.subject
                                                                                            : `Fwd: ${activeEmail.subject}`,
                                                                                        body: `<br/><br/><div style="border-left: 2px solid #ccc; padding-left: 10px; color: #666;"><p>---------- Forwarded message ---------</p><p>From: ${activeEmail.from}</p><p>Date: ${new Date(activeEmail.date).toLocaleString()}</p><p>Subject: ${activeEmail.subject}</p><br/>${emailState.emailDetails.get(activeEmail.id)?.bodyHtml || activeEmail.snippet}</div>`,
                                                                                    });
                                                                                    setIsComposeOpen(true);
                                                                                }
                                                                            }}
                                                                            className="h-9 gap-2 border-border/40 hover:bg-muted/50"
                                                                        >
                                                                            <Forward className="w-4 h-4" />
                                                                            Forward
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* AI Smart Responses */}
                                                                <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/10">
                                                                    <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-widest text-primary/60">
                                                                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                                                        AI Suggested Responses
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2.5">
                                                                        <Button
                                                                            variant="ghost" size="sm"
                                                                            onClick={() => handleAutoDraft("positive")}
                                                                            disabled={isDrafting}
                                                                            className="h-8.5 rounded-xl text-xs gap-2 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10"
                                                                        >
                                                                            {draftingIntent === "positive" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "👍 Yes / Positive"}
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost" size="sm"
                                                                            onClick={() => handleAutoDraft("decline")}
                                                                            disabled={isDrafting}
                                                                            className="h-8.5 rounded-xl text-xs gap-2 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10"
                                                                        >
                                                                            {draftingIntent === "decline" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "👎 No / Decline"}
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost" size="sm"
                                                                            onClick={() => handleAutoDraft("quick_ack")}
                                                                            disabled={isDrafting}
                                                                            className="h-8.5 rounded-xl text-xs gap-2 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10"
                                                                        >
                                                                            {draftingIntent === "quick_ack" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "⚡️ Quick Ack"}
                                                                        </Button>
                                                                        <div className="w-px h-6 bg-primary/10 self-center" />
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleAutoDraft("full_reply")}
                                                                            disabled={isDrafting}
                                                                            className="h-8.5 rounded-xl text-xs gap-2 font-semibold text-primary hover:bg-primary/5 border border-primary/20"
                                                                        >
                                                                            {draftingIntent === "full_reply" ? (
                                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                            ) : (
                                                                                <Sparkles className="w-3.5 h-3.5" />
                                                                            )}
                                                                            {draftingIntent === "full_reply" ? "Analyzing..." : "Draft Full Reply"}
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* Inline Reply Area */}
                                                                {isInlineReplyOpen && (
                                                                    <div id="inline-reply-box" className="mt-6 p-4 rounded-2xl border border-primary/20 bg-primary/[0.02] shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Avatar className="w-6 h-6 border-none">
                                                                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">AI</AvatarFallback>
                                                                            </Avatar>
                                                                            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Inline AI Draft</span>
                                                                            <div className="ml-auto flex items-center gap-1">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-6 w-6 rounded-md hover:bg-destructive/10 hover:text-destructive"
                                                                                    onClick={() => setIsInlineReplyOpen(false)}
                                                                                >
                                                                                    <X className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                        <textarea
                                                                            className="w-full min-h-[120px] p-3 rounded-xl bg-background border border-border/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 text-sm leading-relaxed resize-none transition-all placeholder:text-muted-foreground/50"
                                                                            value={inlineReplyText}
                                                                            onChange={(e) => setInlineReplyText(e.target.value)}
                                                                            placeholder="Type your reply here..."
                                                                        />
                                                                        <div className="flex items-center justify-between mt-3">
                                                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                                <Sparkles className="w-3 h-3 text-primary/40" />
                                                                                You can edit this AI draft before sending
                                                                            </p>
                                                                            <div className="flex items-center gap-2">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-8 text-xs font-semibold px-4 rounded-lg hover:bg-muted"
                                                                                    onClick={() => setIsInlineReplyOpen(false)}
                                                                                    disabled={isSendingInline}
                                                                                >
                                                                                    Cancel
                                                                                </Button>
                                                                                <Button
                                                                                    variant="default"
                                                                                    size="sm"
                                                                                    className="h-8 text-xs font-bold px-5 rounded-lg gap-2 shadow-sm"
                                                                                    onClick={handleSendInlineReply}
                                                                                    disabled={isSendingInline || !inlineReplyText.trim()}
                                                                                >
                                                                                    {isSendingInline ? (
                                                                                        <>
                                                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                                            Sending...
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Send className="w-3.5 h-3.5" />
                                                                                            Send Reply
                                                                                        </>
                                                                                    )}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5">
                                                <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center shadow-sm mb-6">
                                                    <Mail className="w-10 h-10 opacity-20" />
                                                </div>
                                                <h3 className="text-lg font-medium text-foreground mb-2">Select an email to read</h3>
                                                <p className="max-w-xs text-center leading-relaxed opacity-70">
                                                    Choose an email from the list to view its contents, reply, or manage it.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )
                    }
                </div>
            </main>

            {/* Modals & Panels */}
            {
                settingsOpen && (
                    <SettingsPanel
                        isOpen={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        initialTab={settingsInitialTab}
                        agentId={agentId}
                        userEmail={props.userEmail}
                        emails={emailState.emails}
                        isGmailConnected={isConnected}
                        isSlackConnected={props.isSlackConnected}
                        isJiraConnected={props.isJiraConnected}
                        isNotionConnected={props.isNotionConnected}
                        isCrmConnected={props.isCrmConnected}
                        onConnectSlack={props.onConnectSlack}
                        onConnectJira={props.onConnectJira}
                        onConnectNotion={props.onConnectNotion}
                        onConnectCrm={props.onConnectCrm}
                        onDisconnectJira={props.onDisconnectJira}
                        onDisconnectGmail={props.onDisconnectGmail}
                        onDisconnectNotion={props.onDisconnectNotion}
                        onDisconnectSlack={props.onDisconnectSlack}
                        onDisconnectCrm={props.onDisconnectCrm}
                        onSignOut={() => { }}
                        onRefreshIntegrations={() => emailState.loadCachedEmails()}
                        onFocusRefresh={() => emailState.loadCachedEmails()}
                        rules={ruleState.rules}
                        onRefreshRules={ruleState.fetchRules}
                        isLoadingRules={ruleState.isLoading}
                        onRefreshKnowledge={(refreshFn) => { refreshKnowledgeRef.current = refreshFn; }}
                        jiraProjectKey={agentState.config?.jiraProjectKey}
                        jiraSiteName={agentState.config?.jira?.siteName}
                        onJiraProjectKeyChange={(key) => agentState.updateConfig({ jiraProjectKey: key })}
                        slackChannelId={agentState.config?.slackChannelId}
                        onSlackChannelIdChange={(id) => agentState.updateConfig({ slackChannelId: id })}
                        notionDatabaseId={agentState.config?.notion?.selectedDatabaseId || agentState.config?.notionDatabaseId}
                        onNotionDatabaseIdChange={(id) => agentState.updateConfig({ notion: { ...agentState.config?.notion, selectedDatabaseId: id } })}
                        onStartTutorial={() => tutorialState.setIsOpen(true)}
                    />
                )
            }

            <SyncPreferencesModal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                onConfirm={handleSavePreferences}
                isLoading={agentState.isUpdating}
                initialPreferences={agentState.config?.syncPreferences}
            />

            <ChatSidePanel
                agentId={agentId}
                isOpen={isChatPanelOpen}
                onClose={() => setIsChatPanelOpen(false)}
                onEmailSelect={(id, email) => {
                    if (email) {
                        emailState.addEmails([email]);
                    }
                    setActiveEmailId(id);
                    setIsReadingPaneOpen(true);
                    emailState.fetchEmailDetails(id);
                    // Switch to focus folder if in a different view
                    if (['analytics', 'history', 'attachments', 'spam-rescue'].includes(selectedFolder)) {
                        setSelectedFolder('focus');
                    }
                }}
                onNavigate={handleChatNavigate}
                onPreferenceUpdate={handleChatPreferenceUpdate}
                onContextChange={handleChatContextChange}
                onDataRefresh={handleChatDataRefresh}
                isGmailConnected={isConnected}
                isSlackConnected={props.isSlackConnected}
                isJiraConnected={props.isJiraConnected}
                activeContext={chatContext}
            />

            <TutorialOverlay
                isOpen={tutorialState.isOpen}
                steps={tutorialSteps}
                onClose={() => tutorialState.completeTutorial()}
                onComplete={() => tutorialState.completeTutorial()}
            />

            {
                isComposeOpen && (
                    <ComposeDialog
                        open={isComposeOpen}
                        onOpenChange={setIsComposeOpen}
                        agentId={agentId}
                        {...composeData}
                    />
                )
            }

            <NotionPageDialog
                open={isNotionDialogOpen}
                onOpenChange={setIsNotionDialogOpen}
                agentId={agentId}
                initialTitle={notionInitialData.title}
                initialContent={notionInitialData.content}
            />

            <div id="tutorial-welcome" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
    );
}
