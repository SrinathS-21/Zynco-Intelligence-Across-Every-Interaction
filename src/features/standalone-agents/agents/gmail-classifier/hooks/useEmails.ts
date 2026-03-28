"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Email {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    isRead: boolean;
    category: string;
    priority: string;
    confidence: number;
    labels: string[];
    body?: string;
    customLabels?: string[];
    attachments?: any[];
    silenceReason?: string;
}

export interface SyncPreferences {
    syncMode: "count" | "days";
    emailCount: number;
    dateRange: string;
    autoSyncInterval: number;
    labels: string[];
    excludePromotions: boolean;
    excludeUpdates: boolean;
}

export interface FilterState {
    categories: string[];
    priorities: string[];
    senders: string[];
    dateRange: "all" | "today" | "week" | "month" | "custom";
    readStatus: "all" | "unread" | "read";
    hasAttachment: boolean | null;
}

export interface SortState {
    field: "date" | "priority" | "sender" | "category";
    direction: "asc" | "desc";
}

/**
 * Hook to manage email data, syncing, and filtering.
 * Extracted from EmailDashboard.tsx to improve maintainability.
 */
export function useEmails(agentId: string, isConnected: boolean) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const [emails, setEmails] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [stats, setStats] = useState<any>(null);

    const syncMutation = useMutation(trpc.standaloneAgents.syncEmails.mutationOptions());

    // Email details cache
    const [emailDetails, setEmailDetails] = useState<Map<string, any>>(new Map());
    const [loadingEmailId, setLoadingEmailId] = useState<string | null>(null);

    // Filtering & Sorting State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [showStarredOnly, setShowStarredOnly] = useState(false);

    const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
        categories: [],
        priorities: [],
        senders: [],
        dateRange: "all",
        readStatus: "all",
        hasAttachment: null,
    });

    const [sortConfig, setSortConfig] = useState<SortState>({
        field: "date",
        direction: "desc",
    });

    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 25;

    // ─── Data Access ─────────────────────────────────────────────────────────

    const fetchEmailDetails = useCallback(async (emailId: string) => {
        if (emailDetails.has(emailId)) return;

        try {
            setLoadingEmailId(emailId);
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getEmailIdDetails.queryOptions({
                    id: agentId,
                    emailId
                })
            );

            setEmailDetails(prev => new Map(prev).set(emailId, data));
        } catch (error) {
            console.error("[EmailDetails] Error:", error);
            toast.error("Failed to load email content");
        } finally {
            setLoadingEmailId(null);
        }
    }, [agentId, emailDetails, queryClient, trpc.standaloneAgents.getEmailIdDetails]);

    const loadCachedEmails = useCallback(async () => {
        if (!isConnected) return;
        setIsLoading(emails.length === 0);

        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getEmails.queryOptions({ id: agentId })
            );
            const cachedEmails = (data.emails || []).map((e: any) => ({
                ...e,
                category: e.category || 'other',
                priority: e.priority || 'medium',
                confidence: e.confidence || 0.85,
                isRead: e.isRead ?? false,
                body: e.body || e.snippet,
                attachments: (e.attachments || []).map((a: any) => ({
                    ...a,
                    attachmentId: a.attachmentId || a.id || ""
                }))
            }));
            setEmails(cachedEmails);
            setLastSync(data.lastSync);
            setStats(data.stats);
        } catch (error) {
            console.error("Failed to load cached emails:", error);
        } finally {
            setIsLoading(false);
        }
    }, [agentId, isConnected, emails.length, queryClient, trpc.standaloneAgents.getEmails]);

    const syncEmails = useCallback(async (prefs: SyncPreferences, freshSync: boolean = false) => {
        if (!isConnected || isSyncing) return;
        setIsSyncing(true);

        try {
            const data = await syncMutation.mutateAsync({
                id: agentId,
                count: prefs.emailCount,
                dateRange: prefs.dateRange,
                syncMode: prefs.syncMode,
                freshSync,
                excludePromotions: prefs.excludePromotions,
                excludeUpdates: prefs.excludeUpdates,
            });

            const fetchedEmails = (data.emails || []).map((e: any) => ({
                ...e,
                category: e.category || 'other',
                priority: e.priority || 'medium',
                confidence: e.confidence || 0.85,
                isRead: e.isRead ?? false,
                body: e.body || e.snippet,
                attachments: (e.attachments || []).map((a: any) => ({
                    ...a,
                    attachmentId: a.attachmentId || a.id || ""
                })),
            }));

            setEmails(fetchedEmails as any);
            setLastSync(new Date().toISOString());

            const newCount = (data as any).newCount || 0;
            if (newCount > 0) toast.success(`Found ${newCount} new emails!`);
            else toast.success(`Inbox up to date`);
        } catch (error: any) {
            console.error("Failed to sync emails:", error);
            const message = String(error?.message || "Sync failed");
            const isRateLimited = /\b429\b/.test(message) || /rate\s*limit/i.test(message);
            toast.error(
                isRateLimited
                    ? "Gmail is rate limiting sync right now. Please wait a few seconds and try again."
                    : message
            );
        } finally {
            setIsSyncing(false);
        }
    }, [agentId, isConnected, syncMutation, trpc.standaloneAgents.syncEmails]);


    const addEmails = useCallback((newEmails: Email[]) => {
        setEmails(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const uniqueNew = newEmails.filter(e => !existingIds.has(e.id));
            if (uniqueNew.length === 0) return prev;
            return [...uniqueNew, ...prev];
        });
    }, []);

    // ─── Filtering Logic ─────────────────────────────────────────────────────

    const filteredEmails = useMemo(() => {
        let filtered = emails;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                e.subject?.toLowerCase().includes(query) ||
                e.from?.toLowerCase().includes(query) ||
                e.snippet?.toLowerCase().includes(query)
            );
        }

        if (selectedCategory !== 'all') {
            filtered = filtered.filter(e => e.category.toLowerCase() === selectedCategory);
        }

        if (showUnreadOnly) {
            filtered = filtered.filter(e => !e.isRead);
        }

        if (showStarredOnly) {
            filtered = filtered.filter(e =>
                e.labels.includes('STARRED') ||
                e.priority === 'urgent' ||
                ['high', 'important'].includes(e.category)
            );
        }

        if (selectedLabel) {
            filtered = filtered.filter(e => e.customLabels?.includes(selectedLabel));
        }

        // Apply Advanced Filters
        if (advancedFilters.priorities.length > 0) {
            filtered = filtered.filter(e => advancedFilters.priorities.includes(e.priority));
        }

        if (advancedFilters.senders.length > 0) {
            filtered = filtered.filter(e => {
                const sender = e.from?.replace(/<.*>/, "").trim() || e.from;
                return advancedFilters.senders.some(s => sender.toLowerCase().includes(s.toLowerCase()));
            });
        }

        if (advancedFilters.categories.length > 0) {
            filtered = filtered.filter(e => advancedFilters.categories.includes(e.category));
        }

        if (advancedFilters.readStatus !== 'all') {
            filtered = filtered.filter(e => advancedFilters.readStatus === 'read' ? e.isRead : !e.isRead);
        }

        if (advancedFilters.hasAttachment !== null) {
            filtered = filtered.filter(e => {
                const hasItem = (e.attachments?.length || 0) > 0;
                return advancedFilters.hasAttachment ? hasItem : !hasItem;
            });
        }

        if (advancedFilters.dateRange !== 'all') {
            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));

            filtered = filtered.filter(e => {
                const emailDate = new Date(e.date);
                if (advancedFilters.dateRange === 'today') {
                    return emailDate >= startOfDay;
                } else if (advancedFilters.dateRange === 'week') {
                    const weekAgo = new Date(now.setDate(now.getDate() - 7));
                    return emailDate >= weekAgo;
                } else if (advancedFilters.dateRange === 'month') {
                    const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
                    return emailDate >= monthAgo;
                }
                return true;
            });
        }

        // Apply sort
        filtered = [...filtered].sort((a, b) => {
            let comparison = 0;
            if (sortConfig.field === "date") {
                comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
            } else if (sortConfig.field === "priority") {
                const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
                comparison = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            } else if (sortConfig.field === "sender") {
                comparison = (a.from || "").localeCompare(b.from || "");
            }
            return sortConfig.direction === "asc" ? -comparison : comparison;
        });

        return filtered;
    }, [emails, searchQuery, selectedCategory, showUnreadOnly, showStarredOnly, selectedLabel, advancedFilters, sortConfig]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { all: emails.length };
        emails.forEach(email => {
            const cat = email.category.toLowerCase();
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [emails]);

    const totalPages = Math.ceil(filteredEmails.length / pageSize);

    return {
        emails,
        filteredEmails,
        categoryCounts,
        isLoading,
        isSyncing,
        lastSync,
        stats,
        emailDetails,
        loadingEmailId,

        // Search & Filter state
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        selectedLabel,
        setSelectedLabel,
        showUnreadOnly,
        setShowUnreadOnly,
        showStarredOnly,
        setShowStarredOnly,
        sortConfig,
        setSortConfig,
        advancedFilters,
        setAdvancedFilters,
        currentPage,
        setCurrentPage,
        pageSize,
        totalPages,

        // Actions
        loadCachedEmails,
        syncEmails,
        addEmails,
        fetchEmailDetails,
    };
}
