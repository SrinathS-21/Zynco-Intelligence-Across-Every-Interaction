/**
 * Automation Rules Manager
 * UI component for managing automation rules in Settings
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Plus,
    Trash2,
    Pencil,
    Zap,
    ChevronRight,
    Settings2,
    Loader2,
    AlertCircle,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AutomationRule, RuleField, RuleOperator, RuleActionType } from "@/lib/automation/types";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface AutomationRulesManagerProps {
    agentId: string;
    isJiraConnected: boolean;
    isNotionConnected: boolean;
    isSlackConnected?: boolean;
    isCrmConnected?: boolean;
    jiraProjectKey?: string;
    jiraProjects?: any[];
    slackChannelId?: string;
    slackChannels?: any[];
    onConnectJira?: () => void;
    onConnectNotion?: () => void;
    onConnectSlack?: () => void;
    onConnectCrm?: () => void;
    rules?: AutomationRule[];
    onRefresh?: () => void;
    isLoadingRules?: boolean;
}

const FIELD_OPTIONS: { value: RuleField; label: string }[] = [
    { value: 'category', label: 'Category' },
    { value: 'subject', label: 'Subject' },
    { value: 'body', label: 'Email Body' },
    { value: 'sender', label: 'Sender' },
    { value: 'priority', label: 'Priority' },
];

const OPERATOR_OPTIONS: { value: RuleOperator; label: string }[] = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
];

const CATEGORY_VALUES = [
    { value: 'requires_action', label: 'Action Required' },
    { value: 'important', label: 'Important' },
    { value: 'personal', label: 'Personal' },
    { value: 'transactional', label: 'Transactional' },
    { value: 'updates', label: 'Updates' },
    { value: 'newsletters', label: 'Newsletters' },
    { value: 'promotional', label: 'Promotional' },
    { value: 'automated', label: 'Automated' },
];

export function AutomationRulesManager({
    agentId,
    isJiraConnected,
    isNotionConnected,
    isSlackConnected = false,
    isCrmConnected = false,
    jiraProjectKey,
    jiraProjects,
    slackChannelId,
    slackChannels,
    onConnectJira,
    onConnectNotion,
    onConnectSlack,
    onConnectCrm,
    rules: propRules,
    onRefresh,
    isLoadingRules,
}: AutomationRulesManagerProps) {
    const [internalRules, setInternalRules] = useState<AutomationRule[]>([]);
    const rules = propRules || internalRules;
    const [isLoading, setIsLoading] = useState(!propRules);

    const isDataLoading = propRules ? (isLoadingRules ?? false) : isLoading;
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

    // Notion databases state
    const [notionDatabases, setNotionDatabases] = useState<Array<{ id: string; title: string; icon: string | null; url: string }>>([]);
    const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);

    // Jira projects state (internal fallback)
    const [internalJiraProjects, setInternalJiraProjects] = useState<any[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);

    // Slack channels state (internal fallback)
    const [internalSlackChannels, setInternalSlackChannels] = useState<any[]>([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // New rule form state
    const [newRule, setNewRule] = useState({
        name: '',
        conditionField: 'category' as RuleField,
        conditionOperator: 'equals' as RuleOperator,
        conditionValue: '',
        actionType: 'create_jira_task' as RuleActionType,
        slackChannelId: '',
        notionDatabaseId: '',
        jiraProjectKey: '',
    });

    const updateRuleMutation = useMutation(trpc.standaloneAgents.updateRule.mutationOptions());
    const deleteRuleMutation = useMutation(trpc.standaloneAgents.deleteRule.mutationOptions());
    const createRuleMutation = useMutation(trpc.standaloneAgents.createRule.mutationOptions());

    // Fetch rules on mount if not provided by props
    useEffect(() => {
        if (!propRules) {
            fetchRules();
        } else {
            setIsLoading(false);
        }
    }, [agentId, propRules]);

    // Fetch Notion databases when Notion is connected
    useEffect(() => {
        if (isNotionConnected && agentId) {
            fetchNotionDatabases();
        }
    }, [isNotionConnected, agentId]);

    // Fetch Jira projects when Jira is connected
    useEffect(() => {
        if (isJiraConnected && agentId && (!jiraProjects || jiraProjects.length === 0)) {
            fetchJiraProjects();
        }
    }, [isJiraConnected, agentId, jiraProjects]);

    // Fetch Slack channels when Slack is connected
    useEffect(() => {
        if (isSlackConnected && agentId && (!slackChannels || slackChannels.length === 0)) {
            fetchSlackChannels();
        }
    }, [isSlackConnected, agentId, slackChannels]);

    const fetchRules = async () => {
        setIsLoading(true);
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getRules.queryOptions({ id: agentId })
            );
            setInternalRules(data.rules || []);
        } catch (error) {
            console.error('Failed to fetch rules:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchJiraProjects = async () => {
        if (!agentId) return;
        setIsLoadingProjects(true);
        try {
            const projects = await queryClient.fetchQuery(
                trpc.standaloneAgents.getJiraProjects.queryOptions({ id: agentId })
            );
            setInternalJiraProjects(projects || []);
        } catch (error) {
            console.error('Failed to fetch Jira projects:', error);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const fetchSlackChannels = async () => {
        if (!agentId) return;
        setIsLoadingChannels(true);
        try {
            const channels = await queryClient.fetchQuery(
                trpc.standaloneAgents.getSlackChannels.queryOptions({ id: agentId })
            );
            setInternalSlackChannels(channels || []);
        } catch (error) {
            console.error('Failed to fetch Slack channels:', error);
        } finally {
            setIsLoadingChannels(false);
        }
    };

    const fetchNotionDatabases = async () => {
        setIsLoadingDatabases(true);
        try {
            const databases = await queryClient.fetchQuery(
                trpc.standaloneAgents.getNotionDatabases.queryOptions({ id: agentId })
            );
            setNotionDatabases(databases || []);
        } catch (error) {
            console.error('Failed to fetch Notion databases:', error);
        } finally {
            setIsLoadingDatabases(false);
        }
    };

    const toggleRule = async (ruleId: string, enabled: boolean) => {
        try {
            await updateRuleMutation.mutateAsync({
                id: agentId,
                ruleId,
                updates: { enabled },
            });

            toast.success(`Rule ${enabled ? 'enabled' : 'disabled'}`);
            if (onRefresh) {
                onRefresh();
            } else {
                setInternalRules(prev =>
                    prev.map(r => r.id === ruleId ? { ...r, enabled } : r)
                );
            }
        } catch (error) {
            toast.error('Failed to update rule');
        }
    };

    const deleteRule = async (ruleId: string) => {
        try {
            await deleteRuleMutation.mutateAsync({
                id: agentId,
                ruleId,
            });

            toast.success('Rule deleted');
            if (onRefresh) {
                onRefresh();
            } else {
                setInternalRules(prev => prev.filter(r => r.id !== ruleId));
            }
        } catch (error) {
            toast.error('Failed to delete rule');
        }
    };

    const editRule = (rule: AutomationRule) => {
        setEditingRuleId(rule.id);
        setNewRule({
            name: rule.name,
            conditionField: rule.conditions[0]?.field || 'category',
            conditionOperator: rule.conditions[0]?.operator || 'equals',
            conditionValue: rule.conditions[0]?.value || '',
            actionType: rule.action.type,
            slackChannelId: rule.action.config?.slackChannelId || '',
            notionDatabaseId: rule.action.config?.databaseId || '',
            jiraProjectKey: rule.action.config?.projectKey || '',
        });
        setShowCreateForm(true);
    };

    const createRule = async () => {
        if (!newRule.name || !newRule.conditionValue) {
            toast.error('Please fill in all fields');
            return;
        }

        // Validate Integration Settings
        if (newRule.actionType === 'create_jira_task') {
            if (!isJiraConnected) {
                toast.error('Please connect your Jira account first');
                return;
            }
            if (!newRule.jiraProjectKey && !jiraProjectKey) {
                toast.error('Please select a Jira Project');
                return;
            }
        }

        if (newRule.actionType === 'send_slack_message') {
            if (!isSlackConnected) {
                toast.error('Please connect Slack first');
                return;
            }
            if (!newRule.slackChannelId) {
                toast.error('Please enter or select a Slack channel ID');
                return;
            }
        }

        if (newRule.actionType === 'save_to_notion') {
            if (!isNotionConnected) {
                toast.error('Please connect Notion first');
                return;
            }
            if (!newRule.notionDatabaseId) {
                toast.error('Please select a Notion database');
                return;
            }
        }

        setIsCreating(true);
        try {
            const ruleData = {
                name: newRule.name,
                enabled: true,
                conditions: [{
                    field: newRule.conditionField,
                    operator: newRule.conditionOperator,
                    value: newRule.conditionValue,
                }],
                conditionOperator: 'AND' as const,
                action: {
                    type: newRule.actionType,
                    config: {
                        projectKey: newRule.actionType === 'create_jira_task' ? (newRule.jiraProjectKey || jiraProjectKey) : undefined,
                        databaseId: newRule.actionType === 'save_to_notion' ? newRule.notionDatabaseId : undefined,
                        slackChannelId: newRule.actionType === 'send_slack_message' ? newRule.slackChannelId : undefined,
                        notifyUser: true,
                    }
                }
            };

            if (editingRuleId) {
                await updateRuleMutation.mutateAsync({
                    id: agentId,
                    ruleId: editingRuleId,
                    updates: ruleData,
                });
                toast.success('Rule updated');
            } else {
                await createRuleMutation.mutateAsync({
                    id: agentId,
                    rule: ruleData,
                });
                toast.success('Rule created');
            }

            setShowCreateForm(false);
            setEditingRuleId(null);
            setNewRule({
                name: '',
                conditionField: 'category',
                conditionOperator: 'equals',
                conditionValue: '',
                actionType: 'create_jira_task',
                slackChannelId: '',
                notionDatabaseId: '',
                jiraProjectKey: '',
            });

            if (onRefresh) {
                onRefresh();
            } else {
                fetchRules();
            }
        } catch (error) {
            toast.error(editingRuleId ? 'Failed to update rule' : 'Failed to create rule');
        } finally {
            setIsCreating(false);
        }
    };

    const getActionLabel = (type: RuleActionType) => {
        switch (type) {
            case 'create_jira_task': return 'Create Jira Task';
            case 'save_to_notion': return 'Save to Notion';
            case 'send_slack_message': return 'Send Slack Message';
            case 'create_crm_order': return 'Create CRM Order';
            default: return type;
        }
    };

    const getActionColor = (type: RuleActionType) => {
        switch (type) {
            case 'create_jira_task': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
            case 'save_to_notion': return 'bg-gray-500/10 text-gray-700 border-gray-500/30';
            case 'send_slack_message': return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
            case 'create_crm_order': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
            default: return 'bg-muted';
        }
    };

    if (isDataLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Automation Rules
                </h4>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="gap-1 h-7 text-xs"
                >
                    <Plus className="w-3 h-3" />
                    New Rule
                </Button>
            </div>

            {/* Create Rule Form */}
            {showCreateForm && (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4 max-h-[600px] overflow-y-auto">
                    <h5 className="font-medium text-sm">{editingRuleId ? 'Edit Rule' : 'Create New Rule'}</h5>

                    {/* Rule Name */}
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Rule Name</label>
                        <input
                            type="text"
                            value={newRule.name}
                            onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Action emails to Jira"
                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    {/* Condition */}
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">IF email...</label>
                        <div className="flex gap-2 flex-wrap">
                            <select
                                value={newRule.conditionField}
                                onChange={(e) => setNewRule(prev => ({ ...prev, conditionField: e.target.value as RuleField }))}
                                className="px-3 py-2 text-sm bg-background border border-border rounded-lg"
                            >
                                {FIELD_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <select
                                value={newRule.conditionOperator}
                                onChange={(e) => setNewRule(prev => ({ ...prev, conditionOperator: e.target.value as RuleOperator }))}
                                className="px-3 py-2 text-sm bg-background border border-border rounded-lg"
                            >
                                {OPERATOR_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            {newRule.conditionField === 'category' ? (
                                <select
                                    value={newRule.conditionValue}
                                    onChange={(e) => setNewRule(prev => ({ ...prev, conditionValue: e.target.value }))}
                                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg"
                                >
                                    <option value="">Select category...</option>
                                    {CATEGORY_VALUES.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={newRule.conditionValue}
                                    onChange={(e) => setNewRule(prev => ({ ...prev, conditionValue: e.target.value }))}
                                    placeholder="Enter value..."
                                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg"
                                />
                            )}
                        </div>
                    </div>

                    {/* Action */}
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">THEN...</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setNewRule(prev => ({ ...prev, actionType: 'create_jira_task' }))}
                                disabled={!isJiraConnected}
                                className={cn(
                                    "flex-1 p-3 rounded-lg border text-sm font-medium transition-all",
                                    newRule.actionType === 'create_jira_task'
                                        ? "border-blue-500 bg-blue-500/10 text-blue-600"
                                        : "border-border hover:border-blue-500/50",
                                    !isJiraConnected && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                🎫 Create Jira Task
                                {!isJiraConnected && (
                                    <span className="block text-xs text-muted-foreground mt-1">Connect Jira first</span>
                                )}
                            </button>
                            <button
                                onClick={() => setNewRule(prev => ({ ...prev, actionType: 'save_to_notion' }))}
                                disabled={!isNotionConnected}
                                className={cn(
                                    "flex-1 p-3 rounded-lg border text-sm font-medium transition-all",
                                    newRule.actionType === 'save_to_notion'
                                        ? "border-gray-500 bg-gray-500/10 text-gray-700"
                                        : "border-border hover:border-gray-500/50",
                                    !isNotionConnected && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                📝 Save to Notion
                                {!isNotionConnected && (
                                    <span className="block text-xs text-muted-foreground mt-1">Connect Notion first</span>
                                )}
                            </button>
                            <button
                                onClick={() => setNewRule(prev => ({ ...prev, actionType: 'send_slack_message' }))}
                                disabled={!isSlackConnected}
                                className={cn(
                                    "flex-1 p-3 rounded-lg border text-sm font-medium transition-all",
                                    newRule.actionType === 'send_slack_message'
                                        ? "border-purple-500 bg-purple-500/10 text-purple-600"
                                        : "border-border hover:border-purple-500/50",
                                    !isSlackConnected && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                💬 Send Slack Message
                                {!isSlackConnected && (
                                    <span className="block text-xs text-muted-foreground mt-1">Connect Slack first</span>
                                )}
                            </button>
                            <button
                                onClick={() => setNewRule(prev => ({ ...prev, actionType: 'create_crm_order' }))}
                                disabled={!isCrmConnected}
                                className={cn(
                                    "flex-1 p-3 rounded-lg border text-sm font-medium transition-all",
                                    newRule.actionType === 'create_crm_order'
                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                                        : "border-border hover:border-emerald-500/50",
                                    !isCrmConnected && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                📦 Create CRM Order
                                {!isCrmConnected && (
                                    <span className="block text-xs text-muted-foreground mt-1">Connect CRM first</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Slack Channel ID Input (only show if Slack is selected) */}
                    {newRule.actionType === 'send_slack_message' && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-muted-foreground">Slack Channel</label>
                                <button
                                    onClick={fetchSlackChannels}
                                    disabled={isLoadingChannels}
                                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                >
                                    {isLoadingChannels ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
                                    Refresh
                                </button>
                            </div>
                            {(isSlackConnected && ((slackChannels && slackChannels.length > 0) || internalSlackChannels.length > 0)) ? (
                                <>
                                    <select
                                        value={newRule.slackChannelId || slackChannelId || ""}
                                        onChange={(e) => setNewRule(prev => ({ ...prev, slackChannelId: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="">Choose a channel...</option>
                                        {(slackChannels && slackChannels.length > 0 ? slackChannels : internalSlackChannels).map((ch: any) => (
                                            <option key={ch.id} value={ch.id}>
                                                # {ch.name}
                                            </option>
                                        ))}
                                    </select>
                                    {(newRule.slackChannelId || slackChannelId) && (
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                                            ✓ Notifications will be sent to <strong>#{(slackChannels || internalSlackChannels).find(c => c.id === (newRule.slackChannelId || slackChannelId))?.name || (newRule.slackChannelId || slackChannelId)}</strong>
                                        </p>
                                    )}
                                </>
                            ) : (
                                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                    {isSlackConnected
                                        ? isLoadingChannels ? "Loading channels..." : "No Slack channels found. Try refreshing or check your connection."
                                        : "Please connect Slack in the Integrations tab first."}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Jira Project Selector (only show if Jira is selected) */}
                    {newRule.actionType === 'create_jira_task' && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-muted-foreground">Jira Project</label>
                                <button
                                    onClick={fetchJiraProjects}
                                    disabled={isLoadingProjects}
                                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                >
                                    {isLoadingProjects ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
                                    Refresh
                                </button>
                            </div>
                            {(isJiraConnected && ((jiraProjects && jiraProjects.length > 0) || internalJiraProjects.length > 0)) ? (
                                <>
                                    <select
                                        value={newRule.jiraProjectKey || jiraProjectKey || ""}
                                        onChange={(e) => setNewRule(prev => ({ ...prev, jiraProjectKey: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="">Choose a project...</option>
                                        {(jiraProjects && jiraProjects.length > 0 ? jiraProjects : internalJiraProjects).map((p: any) => (
                                            <option key={p.key} value={p.key}>
                                                {p.name} ({p.key})
                                            </option>
                                        ))}
                                    </select>
                                    {(newRule.jiraProjectKey || jiraProjectKey) && (
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                                            ✓ Tasks will be created in <strong>{newRule.jiraProjectKey || jiraProjectKey}</strong>
                                        </p>
                                    )}
                                </>
                            ) : (
                                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                    {isJiraConnected
                                        ? isLoadingProjects ? "Loading projects..." : "No Jira projects found. Try refreshing or check your connection."
                                        : "Please connect Jira in the Integrations tab first."}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notion Database Selector (only show if Notion is selected) */}
                    {newRule.actionType === 'save_to_notion' && (
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Notion Database</label>
                            {isLoadingDatabases ? (
                                <div className="flex items-center justify-center py-3 text-xs text-muted-foreground gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Loading databases...
                                </div>
                            ) : notionDatabases.length === 0 ? (
                                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                    No databases found. Share databases with Spinabot in Notion.
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={newRule.notionDatabaseId}
                                        onChange={(e) => setNewRule(prev => ({ ...prev, notionDatabaseId: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="">Choose a database...</option>
                                        {notionDatabases.map((db) => (
                                            <option key={db.id} value={db.id}>
                                                {db.icon ? `${db.icon} ` : ''}{db.title}
                                            </option>
                                        ))}
                                    </select>
                                    {newRule.notionDatabaseId && (
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                                            ✓ Emails will be saved to <strong>{notionDatabases.find(db => db.id === newRule.notionDatabaseId)?.title}</strong>
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCreateForm(false)}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={createRule}
                            disabled={isCreating || !newRule.name || !newRule.conditionValue}
                            className="flex-1 gap-2"
                        >
                            {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            {editingRuleId ? 'Update Rule' : 'Create Rule'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Rules List */}
            {rules.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                    <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No automation rules yet</p>
                    <p className="text-xs mt-1">Create a rule to automatically process emails</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {rules.map((rule) => (
                        <div
                            key={rule.id}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                rule.enabled
                                    ? "bg-muted/50 border-border"
                                    : "bg-muted/20 border-dashed border-muted-foreground/30 opacity-60"
                            )}
                        >
                            <Switch
                                checked={rule.enabled}
                                onCheckedChange={(enabled) => toggleRule(rule.id, enabled)}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{rule.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {rule.conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(', ')}
                                </p>
                            </div>
                            <Badge variant="outline" className={cn("text-[10px]", getActionColor(rule.action.type))}>
                                {getActionLabel(rule.action.type)}
                            </Badge>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => editRule(rule)}
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteRule(rule.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Info */}
            {rules.some(r => r.enabled) && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Rules run automatically when new emails are synced
                </p>
            )}
        </div>
    );
}
