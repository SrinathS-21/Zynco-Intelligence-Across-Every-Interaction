"use client";

import { useState, useEffect } from "react";
import { X, Mail, MessageSquare, CheckCircle, ExternalLink, LogOut, ChevronRight, RefreshCw, AlertCircle, Zap, Settings2, Loader2, Brain, LayoutGrid, Plug, Tag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { KnowledgeBaseSettings } from "./KnowledgeBaseSettings";
import { LabelManager } from "./LabelManager";
import { LabelSuggestionsPanel } from "./LabelSuggestionsPanel";
import { AutomationRulesManager } from "./AutomationRulesManager";
import { BrainSettingsManager } from "./BrainSettingsManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface JiraProject {
    key: string;
    name: string;
    avatarUrl?: string;
    projectTypeKey?: string;
}

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    agentId?: string;
    userEmail?: string;
    userName?: string;
    isGmailConnected: boolean;
    isSlackConnected?: boolean;
    isJiraConnected?: boolean;
    isNotionConnected?: boolean;
    isCrmConnected?: boolean;
    onConnectSlack?: () => void;
    onConnectJira?: () => void;
    onConnectNotion?: () => void;
    onConnectCrm?: () => void;
    onDisconnectGmail?: () => void;
    onDisconnectJira?: () => void;
    onDisconnectNotion?: () => void;
    onDisconnectSlack?: () => void;
    onDisconnectCrm?: () => void;
    onSignOut?: () => void;
    onRefreshIntegrations?: () => void;
    integrationsError?: boolean;
    // Automation settings
    jiraProjectKey?: string;
    onJiraProjectKeyChange?: (key: string) => void;
    notionDatabaseId?: string;
    onNotionDatabaseIdChange?: (id: string) => void;
    slackChannelId?: string;
    onSlackChannelIdChange?: (id: string) => void;
    initialTab?: 'general' | 'brain' | 'integrations' | 'labels';
    emails?: any[];
    onStartTutorial?: () => void;
    onFocusRefresh?: () => void;
    rules?: any[];
    onRefreshRules?: () => void;
    isLoadingRules?: boolean;
    onRefreshKnowledge?: (refreshFn: () => void) => void;
    jiraSiteName?: string;
}

export function SettingsPanel({
    isOpen,
    onClose,
    agentId,
    userEmail,
    userName,
    isGmailConnected,
    isSlackConnected = false,
    isJiraConnected = false,
    isNotionConnected = false,
    isCrmConnected = false,
    onConnectSlack,
    onConnectJira,
    onConnectNotion,
    onConnectCrm,
    onDisconnectGmail,
    onDisconnectJira,
    onDisconnectNotion,
    onDisconnectSlack,
    onDisconnectCrm,
    onSignOut,
    onRefreshIntegrations,
    integrationsError = false,
    jiraProjectKey,
    onJiraProjectKeyChange,
    notionDatabaseId,
    onNotionDatabaseIdChange,
    slackChannelId,
    onSlackChannelIdChange,
    initialTab = 'general',
    emails = [],
    onStartTutorial,
    onFocusRefresh,
    rules,
    onRefreshRules,
    isLoadingRules,
    onRefreshKnowledge,
    jiraSiteName,
}: SettingsPanelProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const displayName = userName || userEmail?.split('@')[0] || 'User';
    const [activeTab, setActiveTab] = useState<'general' | 'brain' | 'integrations' | 'labels'>(initialTab);

    // Jira projects state
    const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [projectsError, setProjectsError] = useState<string | null>(null);

    // Notion databases state
    const [notionDatabases, setNotionDatabases] = useState<Array<{ id: string; title: string; icon: string | null; url: string }>>([]);
    const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
    const [databasesError, setDatabasesError] = useState<string | null>(null);

    // Slack channels state
    const [slackChannels, setSlackChannels] = useState<Array<{ id: string; name: string }>>([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(false);
    const [channelsError, setChannelsError] = useState<string | null>(null);

    // Sync active tab with initialTab prop for tutorial navigation
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // Fetch Jira projects when panel opens and Jira is connected
    useEffect(() => {
        if (isOpen && isJiraConnected && agentId && jiraProjects.length === 0) {
            fetchJiraProjects();
        }
    }, [isOpen, isJiraConnected, agentId]);

    // Fetch Notion databases when panel opens and Notion is connected
    useEffect(() => {
        if (isOpen && isNotionConnected && agentId) {
            fetchNotionDatabases();
        }
    }, [isOpen, isNotionConnected, agentId]);

    // Fetch Slack channels when panel opens and Slack is connected
    useEffect(() => {
        if (isOpen && isSlackConnected && agentId) {
            fetchSlackChannels();
        }
    }, [isOpen, isSlackConnected, agentId]);

    const fetchJiraProjects = async () => {
        if (!agentId) return;

        setIsLoadingProjects(true);
        setProjectsError(null);

        try {
            const projects = await queryClient.fetchQuery(
                trpc.standaloneAgents.getJiraProjects.queryOptions({ id: agentId })
            );
            setJiraProjects(projects);
        } catch (err: any) {
            setProjectsError(err.message || 'Failed to connect to Jira');
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const fetchNotionDatabases = async () => {
        if (!agentId) return;

        setIsLoadingDatabases(true);
        setDatabasesError(null);

        try {
            const databases = await queryClient.fetchQuery(
                trpc.standaloneAgents.getNotionDatabases.queryOptions({ id: agentId })
            );
            setNotionDatabases(databases);
        } catch (err: any) {
            setDatabasesError(err.message || 'Failed to load databases');
        } finally {
            setIsLoadingDatabases(false);
        }
    };

    const fetchSlackChannels = async () => {
        if (!agentId) return;

        setIsLoadingChannels(true);
        setChannelsError(null);

        try {
            const channels = await queryClient.fetchQuery(
                trpc.standaloneAgents.getSlackChannels.queryOptions({ id: agentId })
            );
            setSlackChannels(channels);
        } catch (err: any) {
            setChannelsError(err.message || 'Failed to load channels');
        } finally {
            setIsLoadingChannels(false);
        }
    };

    const handleJiraProjectChange = async (key: string) => {
        if (!agentId) return;
        onJiraProjectKeyChange?.(key);
        toast.success(`Jira project set to ${key}`);
    };

    const handleSlackChannelChange = async (channelId: string) => {
        if (!agentId) return;
        onSlackChannelIdChange?.(channelId);
        const channelName = slackChannels.find(c => c.id === channelId)?.name;
        toast.success(`Slack notifications set to #${channelName || channelId}`);
    };

    const handleDatabaseChange = async (databaseId: string) => {
        if (!agentId) return;
        onNotionDatabaseIdChange?.(databaseId);
        toast.success("Notion database selection saved");
    };

    return (
        <>
            {/* Backdrop with blur */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Centered Modal */}
            <div
                className={cn(
                    "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] bg-card dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-2xl shadow-2xl z-[101] transition-all duration-300 ease-out flex flex-col overflow-hidden",
                    isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                )}
            >
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-5 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="w-5 h-5" />
                    </Button>
                </header>


                {/* Tab Navigation */}
                <div className="px-6 mt-6">
                    <div className="flex items-center p-1.5 bg-muted/40 dark:bg-zinc-800/50 backdrop-blur-md rounded-xl border border-border/50 shadow-inner">
                        {[
                            { id: 'general', label: 'General', icon: LayoutGrid },
                            { id: 'brain', label: 'Brain', icon: Brain },
                            { id: 'integrations', label: 'Integrations', icon: Plug },
                            { id: 'labels', label: 'Labels', icon: Tag },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                id={`tutorial-tab-${tab.id}`}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2.5 py-2 text-[11px] font-bold rounded-lg transition-all duration-300 relative",
                                    activeTab === tab.id
                                        ? "bg-background text-primary shadow-sm ring-1 ring-border/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                                )}
                            >
                                <tab.icon className={cn(
                                    "w-3.5 h-3.5 transition-transform duration-300",
                                    activeTab === tab.id ? "scale-110" : "group-hover:scale-110"
                                )} />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'brain' && (
                        <div id="tutorial-brain-content" className="p-6">
                            <BrainSettingsManager
                                agentId={agentId || ""}
                                onPersonalized={onFocusRefresh}
                            />
                            <div className="border-t pt-8 mt-10">
                                <KnowledgeBaseSettings onRefresh={onRefreshKnowledge} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'labels' && (
                        <div id="tutorial-labels-content" className="p-6 space-y-8">
                            <LabelManager agentId={agentId || ""} userEmail={userEmail || ""} emails={emails} />
                            <div className="border-t pt-8">
                                <LabelSuggestionsPanel agentId={agentId || ""} onLabelCreated={() => { }} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <>
                            {/* User Profile */}
                            <div className="px-6 py-5 border-b border-border">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12 border-2 border-border">
                                        <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-primary-foreground text-lg font-medium">
                                            {displayName[0].toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-foreground truncate">{displayName}</p>
                                        <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Email Connection */}
                            <div className="px-6 py-5 border-b border-border">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                                    Email Connection
                                </h3>

                                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                                    <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center flex-shrink-0">
                                        <Image src="/logos/gmail.svg" alt="Gmail" width={24} height={24} className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-semibold text-foreground">Gmail</span>
                                            {isGmailConnected && (
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Connected
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                                    </div>
                                    {isGmailConnected && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={onDisconnectGmail}
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            title="Disconnect Gmail"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                                            </svg>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Tutorial Section */}
                            <div className="px-6 py-5 border-b border-border">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Help & Guidance
                                </h3>
                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                                    <div>
                                        <p className="font-semibold text-foreground text-sm">Interactive Tutorial</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            New to Spinabot? Take a guided tour to learn how to use the AI features.
                                        </p>
                                    </div>
                                    <Button
                                        id="tutorial-start-button"
                                        onClick={onStartTutorial}
                                        className="w-full gap-2 text-xs h-9 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                                        variant="outline"
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5" />
                                        Start Guided Tour
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'integrations' && (
                        <>

                            {/* Custom Automation Rules */}
                            <div className="px-6 py-5 border-b border-border">
                                <AutomationRulesManager
                                    agentId={agentId || ''}
                                    isJiraConnected={isJiraConnected}
                                    isNotionConnected={isNotionConnected}
                                    isSlackConnected={isSlackConnected}
                                    isCrmConnected={isCrmConnected}
                                    jiraProjectKey={jiraProjectKey}
                                    jiraProjects={jiraProjects}
                                    slackChannelId={slackChannelId}
                                    slackChannels={slackChannels}
                                    onConnectJira={onConnectJira}
                                    onConnectNotion={onConnectNotion}
                                    onConnectSlack={onConnectSlack}
                                    onConnectCrm={onConnectCrm}
                                    rules={rules}
                                    onRefresh={onRefreshRules}
                                    isLoadingRules={isLoadingRules}
                                />
                            </div>

                            {/* Tool Integrations */}
                            <div className="px-6 py-10 pb-16">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Tool Integrations
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={onRefreshIntegrations}
                                        className="h-6 w-6"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </Button>
                                </div>

                                {integrationsError && (
                                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        Failed to load tool connections
                                    </div>
                                )}

                                <div className="space-y-10">
                                    {/* Slack */}
                                    <div id="tutorial-integration-slack" className={cn(
                                        "flex flex-col gap-4 p-4 rounded-xl border transition-colors",
                                        isSlackConnected
                                            ? "bg-muted/50 border-border"
                                            : "bg-muted/30 border-border hover:bg-muted/50"
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center flex-shrink-0">
                                                <Image src="/logos/slack.svg" alt="Slack" width={24} height={24} className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-semibold text-foreground">Slack</span>
                                                    {isSlackConnected && (
                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            Connected
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Send email notifications and updates to Slack channels
                                                </p>
                                            </div>
                                            {isSlackConnected ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={onDisconnectSlack}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    title="Disconnect Slack"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                                                    </svg>
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="link"
                                                    onClick={onConnectSlack}
                                                    className="text-primary gap-1 p-0 h-auto font-medium"
                                                >
                                                    Connect
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>

                                        {/* Slack Channel Selector */}
                                        {isSlackConnected && (
                                            <div className="pt-3 border-t border-border space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Notification Channel</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={fetchSlackChannels}
                                                        disabled={isLoadingChannels}
                                                        className="h-5 w-5"
                                                    >
                                                        <RefreshCw className={cn("w-3 h-3", isLoadingChannels && "animate-spin")} />
                                                    </Button>
                                                </div>

                                                {isLoadingChannels ? (
                                                    <div className="flex items-center justify-center py-3 text-xs text-muted-foreground gap-2">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Loading channels...
                                                    </div>
                                                ) : channelsError ? (
                                                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                                        {channelsError}
                                                    </div>
                                                ) : slackChannels.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground text-center py-2">
                                                        No public channels found.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <select
                                                            value={slackChannelId || ""}
                                                            onChange={(e) => handleSlackChannelChange(e.target.value)}
                                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        >
                                                            <option value="">Choose a channel...</option>
                                                            {slackChannels.map((ch) => (
                                                                <option key={ch.id} value={ch.id}>
                                                                    # {ch.name}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {slackChannelId && (
                                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                                                ✓ Notifications will be sent to <strong>#{slackChannels.find(c => c.id === slackChannelId)?.name}</strong>
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Jira */}
                                    <div id="tutorial-integration-jira" className={cn(
                                        "flex flex-col gap-4 p-4 rounded-xl border transition-colors",
                                        isJiraConnected
                                            ? "bg-muted/50 border-border"
                                            : "bg-muted/30 border-border hover:bg-muted/50"
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center flex-shrink-0">
                                                <Image src="/logos/jira.svg" alt="Jira" width={24} height={24} className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-semibold text-foreground">Jira</span>
                                                    {isJiraConnected && (
                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            Connected
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Create tasks and tickets from emails automatically
                                                </p>
                                                {isJiraConnected && jiraSiteName && (
                                                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                        Site: <span className="text-foreground/70">{jiraSiteName}</span>
                                                    </p>
                                                )}
                                            </div>
                                            {isJiraConnected ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={onDisconnectJira}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    title="Disconnect Jira"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                                                    </svg>
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="link"
                                                    onClick={onConnectJira}
                                                    className="text-primary gap-1 p-0 h-auto font-medium"
                                                >
                                                    Connect
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>

                                        {/* Jira Project Selector */}
                                        {isJiraConnected && (
                                            <div className="pt-3 border-t border-border space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Target Project</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={fetchJiraProjects}
                                                        disabled={isLoadingProjects}
                                                        className="h-5 w-5"
                                                    >
                                                        <RefreshCw className={cn("w-3 h-3", isLoadingProjects && "animate-spin")} />
                                                    </Button>
                                                </div>

                                                {isLoadingProjects ? (
                                                    <div className="flex items-center justify-center py-3 text-xs text-muted-foreground gap-2">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Loading projects...
                                                    </div>
                                                ) : projectsError ? (
                                                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                                        {projectsError}
                                                    </div>
                                                ) : jiraProjects.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground text-center py-2">
                                                        No projects found.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <select
                                                            value={jiraProjectKey || ""}
                                                            onChange={(e) => handleJiraProjectChange(e.target.value)}
                                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                                                        >
                                                            <option value="">Choose a project...</option>
                                                            {jiraProjects.map((project) => (
                                                                <option key={project.key} value={project.key} className="py-2">
                                                                    {project.name} ({project.key})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {jiraProjectKey && (
                                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                                                ✓ Emails will be synced to <strong>{jiraProjectKey}</strong>
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Notion */}
                                    <div id="tutorial-integration-notion" className={cn(
                                        "flex flex-col gap-4 p-4 rounded-xl border transition-colors",
                                        isNotionConnected
                                            ? "bg-muted/50 border-border"
                                            : "bg-muted/30 border-border hover:bg-muted/50"
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center flex-shrink-0">
                                                <Image src="/logos/notion.svg" alt="Notion" width={24} height={24} className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-semibold text-foreground">Notion</span>
                                                    {isNotionConnected && (
                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            Connected
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Save emails and create pages in Notion
                                                </p>
                                            </div>
                                            {isNotionConnected ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={onDisconnectNotion}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    title="Disconnect Notion"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                                                    </svg>
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="link"
                                                    onClick={onConnectNotion}
                                                    className="text-primary gap-1 p-0 h-auto font-medium"
                                                >
                                                    Connect
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            )}

                                        </div>

                                        {/* Database Selector - show when connected */}
                                        {isNotionConnected && (
                                            <div className="pt-3 border-t border-border space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Select Database</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={fetchNotionDatabases}
                                                        disabled={isLoadingDatabases}
                                                        className="h-5 w-5"
                                                    >
                                                        <RefreshCw className={cn("w-3 h-3", isLoadingDatabases && "animate-spin")} />
                                                    </Button>
                                                </div>

                                                {isLoadingDatabases ? (
                                                    <div className="flex items-center justify-center py-3 text-xs text-muted-foreground gap-2">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Loading databases...
                                                    </div>
                                                ) : databasesError ? (
                                                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                                        {databasesError}
                                                    </div>
                                                ) : notionDatabases.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground text-center py-2">
                                                        No databases found. Share databases with Spinabot in Notion.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <select
                                                            value={notionDatabaseId || ""}
                                                            onChange={(e) => handleDatabaseChange(e.target.value)}
                                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        >
                                                            <option value="">Choose a database...</option>
                                                            {notionDatabases.map((db) => (
                                                                <option key={db.id} value={db.id}>
                                                                    {db.icon ? `${db.icon} ` : ''}{db.title}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {notionDatabaseId && (
                                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                                                ✓ Emails will be saved to <strong>{notionDatabases.find(db => db.id === notionDatabaseId)?.title}</strong>
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* MS Dynamics CRM */}
                                    <div className={cn(
                                        "flex items-center gap-4 p-4 rounded-xl border transition-colors",
                                        isCrmConnected
                                            ? "bg-muted/50 border-border"
                                            : "bg-muted/30 border-border hover:bg-muted/50"
                                    )}>
                                        <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center flex-shrink-0">
                                            <span className="text-lg">📦</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-semibold text-foreground">Dynamics CRM</span>
                                                {isCrmConnected && (
                                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Connected
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Auto-create sales orders from order emails via AI
                                            </p>
                                        </div>
                                        {isCrmConnected ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={onDisconnectCrm}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                title="Disconnect CRM"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                                                </svg>
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="link"
                                                onClick={onConnectCrm}
                                                className="text-primary gap-1 p-0 h-auto font-medium"
                                            >
                                                Connect
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* View All Integrations */}
                                <Button
                                    variant="outline"
                                    className="w-full mt-4 gap-2"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    View all integrations
                                </Button>
                            </div>
                        </>
                    )}
                </div>

            </div>
        </>
    );
}

