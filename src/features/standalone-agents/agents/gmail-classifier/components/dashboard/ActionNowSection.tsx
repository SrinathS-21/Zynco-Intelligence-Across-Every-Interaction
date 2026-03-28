/**
 * Action Now Section
 * Displays top priority emails that need immediate attention
 * Uses muted, monochromatic color scheme
 */

"use client";

import { useMemo } from "react";
import {
    AlertCircle,
    ArrowRight,
    Calendar,
    DollarSign,
    Zap,
    Sparkles,
    Loader2,
    RefreshCw,
    MessageSquareQuote,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";

interface Email {
    id: string;
    subject: string;
    from: string;
    snippet?: string;
    date: string;
    category: string;
    priority: string;
    smartScore?: number;
    smartLevel?: 'critical' | 'high' | 'medium' | 'low';
    isUrgent?: boolean;
    extractedDates?: { text: string; type: string; isUrgent: boolean }[];
    monetaryAmounts?: string[];
    suggestedAction?: string;
    isRead?: boolean;
    suggestedDraft?: string;
    focusCategory?: string;
    focusReason?: string;
}

interface ActionNowSectionProps {
    agentId: string;
    isConnected: boolean;
    onSelectEmail: (id: string) => void;
    onReplyWithDraft: (email: Email, draft: string) => void;
    className?: string;
}

export function ActionNowSection({ agentId, isConnected, onSelectEmail, onReplyWithDraft, className }: ActionNowSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [actionEmails, setActionEmails] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const fetchFocusData = async (force = false) => {
        if (!agentId || !isConnected) return;
        setIsLoading(true);
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getFocusEmails.queryOptions({
                    id: agentId,
                    forceRefresh: force
                })
            );

            // Only take top urgent/time-sensitive emails for this section
            const focused = ((data as any).allEmails || [])
                .filter((e: Email) => e.focusCategory === 'urgent' || e.focusCategory === 'time-sensitive')
                .slice(0, 3);

            setActionEmails(focused);
        } catch (error) {
            console.error("[ActionNow] Error fetching:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchFocusData();
        }
    }, [agentId, isConnected]);

    if (!isLoading && actionEmails.length === 0) {
        return null;
    }

    return (
        <div id="tutorial-action-now" className={cn("px-4 py-2 border-b border-border bg-muted/20", className)}>
            <div
                className="flex items-center gap-2 cursor-pointer group/header py-1"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-primary" />
                </div>
                <div className="flex-1">
                    <h3 className="text-[13px] font-bold text-foreground/90 flex items-center gap-2">
                        Action Needed
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded-full font-medium">
                            {actionEmails.length}
                        </span>
                    </h3>
                </div>
                <div className="flex items-center gap-3">
                    {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); fetchFocusData(true); }}
                            className="opacity-0 group-hover/header:opacity-100 transition-opacity"
                            title="Refresh cognitive analysis"
                        >
                            <RefreshCw className="w-3 h-3 text-muted-foreground hover:text-primary transition-colors" />
                        </button>
                    )}
                    <div className="text-muted-foreground group-hover/header:text-primary transition-colors">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="mt-3 grid grid-cols-1 gap-2 animate-in slide-in-from-top-2 duration-300">
                    {actionEmails.map((email, index) => (
                        <ActionEmailCard
                            id={index === 0 ? "tutorial-action-card-0" : undefined}
                            key={email.id}
                            email={email}
                            onSelect={() => onSelectEmail(email.id)}
                            onReply={() => email.suggestedDraft && onReplyWithDraft(email, email.suggestedDraft)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function ActionEmailCard({
    email,
    onSelect,
    onReply,
    id
}: {
    email: Email;
    onSelect: () => void;
    onReply: () => void;
    id?: string;
}) {
    const senderName = email.from.match(/^([^<]+)/)?.[1]?.trim() || email.from.split('@')[0];

    return (
        <div id={id} className="w-full group">
            <button
                onClick={onSelect}
                className={cn(
                    "w-full p-2.5 rounded-xl border text-left transition-all",
                    "bg-card hover:bg-accent border-border hover:border-primary/20",
                    "shadow-sm hover:shadow-md h-full flex flex-col gap-2"
                )}
            >
                <div className="flex items-start gap-3">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0",
                        email.focusCategory === 'urgent' ? "bg-orange-500 text-white" : "bg-blue-500 text-white"
                    )}>
                        {email.smartScore || 90}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-xs text-foreground truncate">{senderName}</span>
                            {email.focusCategory === 'urgent' && (
                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-orange-500/10 text-orange-600 border-orange-200 uppercase">
                                    urgent
                                </Badge>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate font-medium">{email.subject}</p>
                    </div>
                </div>

                {email.suggestedDraft && (
                    <div className="mt-1 p-2 rounded-lg bg-primary/5 border border-primary/10 relative overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold text-primary">
                            <Sparkles className="w-3 h-3" />
                            AI Suggested Draft
                        </div>
                        <p className="text-[10px] text-muted-foreground italic line-clamp-2 leading-relaxed">
                            "{email.suggestedDraft}"
                        </p>
                    </div>
                )}

                {!email.suggestedDraft && email.focusReason && (
                    <p className="text-[10px] text-muted-foreground italic">
                        <Sparkles className="w-2.5 h-2.5 inline mr-1 text-primary/50" />
                        {email.focusReason}
                    </p>
                )}
            </button>

            {email.suggestedDraft && (
                <div className="mt-2 flex gap-2">
                    <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-[10px] flex-1 bg-primary hover:bg-primary/90"
                        onClick={(e) => {
                            e.stopPropagation();
                            onReply();
                        }}
                    >
                        <MessageSquareQuote className="w-3 h-3 mr-1.5" />
                        Review Draft
                    </Button>
                </div>
            )}
        </div>
    );
}

/**
 * Smart Score Badge - Monochromatic design
 */
export function SmartScoreBadge({
    score,
    level,
    size = 'default'
}: {
    score: number;
    level: 'critical' | 'high' | 'medium' | 'low';
    size?: 'small' | 'default';
}) {
    // Monochromatic - use opacity to indicate priority
    const opacity = level === 'critical' ? 'bg-foreground text-background'
        : level === 'high' ? 'bg-foreground/80 text-background'
            : level === 'medium' ? 'bg-foreground/40 text-foreground'
                : 'bg-muted text-muted-foreground';

    return (
        <div className={cn(
            "rounded-lg flex items-center justify-center font-bold flex-shrink-0",
            opacity,
            size === 'small' ? 'w-6 h-6 text-[10px]' : 'w-9 h-9 text-xs'
        )}>
            {score}
        </div>
    );
}

/**
 * Minimal Insight Tags
 */
export function InsightTags({ email }: { email: Email }) {
    if (!email.extractedDates?.length && !email.monetaryAmounts?.length) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            {email.extractedDates && email.extractedDates.slice(0, 1).map((date, i) => (
                <span key={i} className="inline-flex items-center gap-0.5">
                    <Calendar className="w-2.5 h-2.5" />
                    {date.text}
                </span>
            ))}
            {email.monetaryAmounts && email.monetaryAmounts.slice(0, 1).map((amt, i) => (
                <span key={i} className="inline-flex items-center gap-0.5">
                    <DollarSign className="w-2.5 h-2.5" />
                    {amt}
                </span>
            ))}
        </div>
    );
}
