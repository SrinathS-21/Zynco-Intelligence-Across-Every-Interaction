"use client";

import { useState, useEffect, useMemo } from "react";
import {
    AlertTriangle,
    Mail,
    CheckCircle2,
    X,
    Inbox,
    RefreshCw,
    Filter,
    ChevronDown,
    Loader2,
    Shield,
    ExternalLink,
    Sparkles
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    SpamAnalysis,
    analyzeSpamEmails,
    getImportanceEmoji,
    getImportanceColor
} from "@/lib/classification/spam-analyzer";

interface SpamEmail {
    id: string;
    subject: string;
    from: string;
    snippet: string;
    date: string;
    body?: string;
}

interface SpamRescueViewProps {
    agentId: string;
    className?: string;
    onEmailSelect?: (emailId: string) => void;
}

export function SpamRescueView({ agentId, className, onEmailSelect }: SpamRescueViewProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [spamEmails, setSpamEmails] = useState<Array<SpamEmail & { spamAnalysis: SpamAnalysis }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [rescuingId, setRescuingId] = useState<string | null>(null);

    const rescueMutation = useMutation(trpc.standaloneAgents.rescueEmail.mutationOptions());

    // Fetch spam emails
    const fetchSpamEmails = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const emails = await queryClient.fetchQuery(
                trpc.standaloneAgents.getSpam.queryOptions({ id: agentId })
            );

            // Analyze spam emails for importance
            const emailsToAnalyze = (emails || []) as SpamEmail[];
            const analyzed = analyzeSpamEmails(emailsToAnalyze);
            // Filter to only show emails worth rescuing
            const worthRescuing = analyzed.filter(e => e.spamAnalysis.shouldRescue);
            setSpamEmails(worthRescuing);
        } catch (err: any) {
            setError(err.message || "Failed to fetch spam emails");
            console.error("[SpamRescue] Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSpamEmails();
    }, [agentId]);

    // Filter emails based on selected filter
    const filteredEmails = useMemo(() => {
        return spamEmails.filter(email => {
            if (dismissedIds.has(email.id)) return false;
            if (filter === 'all') return true;
            return email.spamAnalysis.importanceLevel === filter;
        });
    }, [spamEmails, filter, dismissedIds]);

    // Rescue email (move to inbox)
    const handleRescue = async (emailId: string) => {
        setRescuingId(emailId);
        try {
            const data = await rescueMutation.mutateAsync({
                id: agentId,
                emailId,
            });

            if (data.success) {
                // Remove from list
                setSpamEmails(prev => prev.filter(e => e.id !== emailId));
            }
        } catch (err: any) {
            console.error("[SpamRescue] Rescue error:", err);
        } finally {
            setRescuingId(null);
        }
    };

    // Dismiss email (don't show again)
    const handleDismiss = (emailId: string) => {
        setDismissedIds(prev => new Set(prev).add(emailId));
    };

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Sender name extraction
    const getSenderName = (from: string) => {
        const match = from.match(/^(.*?)\s*</);
        if (match && match[1]) return match[1].trim();
        return from.split('@')[0];
    };

    const rescueCount = filteredEmails.length;
    const criticalCount = spamEmails.filter(e => e.spamAnalysis.importanceLevel === 'critical').length;

    if (isLoading) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-12", className)}>
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground mt-3">Scanning spam folder...</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Spam Rescue</h2>
                            <p className="text-xs text-muted-foreground">
                                {rescueCount} potentially important emails found in spam
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchSpamEmails}
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </Button>
                </div>

                {/* Alert for critical emails */}
                {criticalCount > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs mb-3">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">{criticalCount} critical email{criticalCount > 1 ? 's' : ''} may need immediate attention!</span>
                    </div>
                )}

                {/* Filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
                            <Filter className="w-3 h-3" />
                            {filter === 'all' ? 'All Importance' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                            <ChevronDown className="w-3 h-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setFilter('all')}>All Importance</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilter('critical')}>🔴 Critical Only</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilter('high')}>🟠 High Only</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilter('medium')}>🟡 Medium Only</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-auto">
                {error ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <Button variant="outline" size="sm" onClick={fetchSpamEmails} className="mt-4">
                            Try Again
                        </Button>
                    </div>
                ) : filteredEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Sparkles className="w-12 h-12 text-emerald-500/50 mb-3" />
                        <p className="text-sm font-medium text-foreground">All Clear!</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            No important emails found in your spam folder.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filteredEmails.map((email) => (
                            <div
                                key={email.id}
                                className="p-4 hover:bg-muted/30 transition-colors group"
                            >
                                {/* Importance Badge Row */}
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                        className={cn(
                                            "text-[10px] px-2 py-0.5",
                                            getImportanceColor(email.spamAnalysis.importanceLevel)
                                        )}
                                    >
                                        {getImportanceEmoji(email.spamAnalysis.importanceLevel)} {email.spamAnalysis.importanceLevel.toUpperCase()}
                                    </Badge>
                                    {email.spamAnalysis.contextLabels.map((label, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px] px-1.5">
                                            {label}
                                        </Badge>
                                    ))}
                                </div>

                                {/* Email Content */}
                                <div
                                    className="cursor-pointer"
                                    onClick={() => onEmailSelect?.(email.id)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {email.subject || '(No Subject)'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                From: {getSenderName(email.from)}
                                            </p>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                            {formatDate(email.date)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {email.snippet}
                                    </p>
                                </div>

                                {/* Reason */}
                                <p className="text-[10px] text-primary/70 mt-2 italic">
                                    💡 {email.spamAnalysis.reason}
                                </p>

                                {/* Actions */}
                                <div className="flex items-center gap-2 mt-3">
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="h-7 text-xs gap-1.5"
                                        onClick={() => handleRescue(email.id)}
                                        disabled={rescuingId === email.id}
                                    >
                                        {rescuingId === email.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Inbox className="w-3 h-3" />
                                        )}
                                        Move to Inbox
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs gap-1.5 text-muted-foreground"
                                        onClick={() => handleDismiss(email.id)}
                                    >
                                        <X className="w-3 h-3" />
                                        Ignore
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
