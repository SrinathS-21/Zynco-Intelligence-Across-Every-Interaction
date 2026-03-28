"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Target,
    Zap,
    Clock,
    Bell,
    CheckCircle,
    RefreshCw,
    Loader2,
    AlertCircle,
    Sparkles,
    Mail,
    ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";

interface FocusEmail {
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    isRead: boolean;
    focusScore: number;
    focusCategory: 'urgent' | 'time-sensitive' | 'follow-up' | 'important' | 'low-priority';
    focusReason: string;
}

interface FocusData {
    total: number;
    focused: number;
    handled: number;
    categories: {
        urgent: { count: number; emails: FocusEmail[] };
        timeSensitive: { count: number; emails: FocusEmail[] };
        followUp: { count: number; emails: FocusEmail[] };
        important: { count: number; emails: FocusEmail[] };
    };
    allEmails: FocusEmail[];
}

interface FocusViewProps {
    agentId: string;
    onEmailClick?: (emailId: string) => void;
    onViewAllMail?: () => void;
}

export function FocusView({ agentId, onEmailClick, onViewAllMail }: FocusViewProps) {
    const [focusData, setFocusData] = useState<FocusData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const fetchFocusEmails = async (force = false) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getFocusEmails.queryOptions({
                    id: agentId,
                    forceRefresh: force
                })
            );
            setFocusData(data as any);
        } catch (error: any) {
            console.error("Failed to fetch focus emails:", error);
            setError(error.message || "Failed to load focus view");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (agentId) {
            fetchFocusEmails();
        }
    }, [agentId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Analyzing your emails...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="p-6 border-destructive/50 bg-destructive/5">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <div className="flex-1">
                        <p className="text-sm font-medium">Failed to load Focus view</p>
                        <p className="text-xs text-muted-foreground">{error}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => fetchFocusEmails()}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </Card>
        );
    }

    if (!focusData) return null;

    // All caught up state
    if (focusData.focused === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
                    <p className="text-muted-foreground mb-4">
                        No emails need your attention right now.
                    </p>
                    <p className="text-sm text-muted-foreground mb-6">
                        {focusData.handled} emails are handled and organized.
                    </p>
                    <Button variant="outline" onClick={onViewAllMail}>
                        <Mail className="w-4 h-4 mr-2" />
                        View All Mail
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Focus Header */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <Target className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                Focus
                                <Sparkles className="w-5 h-5 text-primary" />
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {focusData.focused} {focusData.focused === 1 ? 'email needs' : 'emails need'} your attention
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => fetchFocusEmails()}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        <Button variant="outline" size="sm" onClick={onViewAllMail}>
                            <Mail className="w-4 h-4 mr-2" />
                            All Mail ({focusData.total})
                        </Button>
                    </div>
                </div>
            </div>

            {/* Urgent Section */}
            {focusData.categories.urgent.count > 0 && (
                <CategorySection
                    icon={<Zap className="w-5 h-5 text-orange-500" />}
                    title="Requires Immediate Action"
                    count={focusData.categories.urgent.count}
                    color="orange"
                    emails={focusData.categories.urgent.emails}
                    onEmailClick={onEmailClick}
                />
            )}

            {/* Time Sensitive Section */}
            {focusData.categories.timeSensitive.count > 0 && (
                <CategorySection
                    icon={<Clock className="w-5 h-5 text-blue-500" />}
                    title="Time Sensitive"
                    count={focusData.categories.timeSensitive.count}
                    color="blue"
                    emails={focusData.categories.timeSensitive.emails}
                    onEmailClick={onEmailClick}
                />
            )}

            {/* Follow-up Section */}
            {focusData.categories.followUp.count > 0 && (
                <CategorySection
                    icon={<Bell className="w-5 h-5 text-purple-500" />}
                    title="Follow-ups Needed"
                    count={focusData.categories.followUp.count}
                    color="purple"
                    emails={focusData.categories.followUp.emails}
                    onEmailClick={onEmailClick}
                />
            )}

            {/* Important Section */}
            {focusData.categories.important.count > 0 && (
                <CategorySection
                    icon={<Sparkles className="w-5 h-5 text-green-500" />}
                    title="Important"
                    count={focusData.categories.important.count}
                    color="green"
                    emails={focusData.categories.important.emails}
                    onEmailClick={onEmailClick}
                />
            )}

            {/* Everything Else Footer */}
            <Card className="p-6 bg-muted/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Everything else handled</p>
                            <p className="text-sm text-muted-foreground">
                                {focusData.handled} emails are organized and don't need immediate attention
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={onViewAllMail}>
                        View All
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </Card>
        </div>
    );
}

interface CategorySectionProps {
    icon: React.ReactNode;
    title: string;
    count: number;
    color: 'orange' | 'blue' | 'purple' | 'green';
    emails: FocusEmail[];
    onEmailClick?: (emailId: string) => void;
}

function CategorySection({ icon, title, count, color, emails, onEmailClick }: CategorySectionProps) {
    const colorClasses = {
        orange: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900',
        blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',
        purple: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900',
        green: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="font-semibold text-lg">{title}</h3>
                <Badge variant="secondary">{count}</Badge>
            </div>
            <div className="space-y-2">
                {emails.map((email) => (
                    <FocusEmailCard
                        key={email.id}
                        email={email}
                        colorClass={colorClasses[color]}
                        onClick={() => onEmailClick?.(email.id)}
                    />
                ))}
            </div>
        </div>
    );
}

interface FocusEmailCardProps {
    email: FocusEmail;
    colorClass: string;
    onClick?: () => void;
}

function FocusEmailCard({ email, colorClass, onClick }: FocusEmailCardProps) {
    const getSenderName = (from: string) => {
        const match = from.match(/^(.+?)\s*</);
        return match ? match[1].trim() : from.split('@')[0];
    };

    return (
        <Card
            className={cn(
                "p-4 cursor-pointer transition-all duration-300 hover:shadow-lg border hover:-translate-y-0.5 active:translate-y-0 hover:border-primary/50",
                colorClass,
                !email.isRead && "font-semibold"
            )}
            onClick={onClick}
        >
            <div className="space-y-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{getSenderName(email.from)}</p>
                        <p className={cn(
                            "text-sm truncate",
                            !email.isRead ? "font-semibold" : "text-muted-foreground"
                        )}>
                            {email.subject}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!email.isRead && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                        <span className="text-xs text-muted-foreground">
                            {new Date(email.date).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                {/* Snippet */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {email.snippet}
                </p>

                {/* Focus Reason */}
                <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground italic">
                        {email.focusReason}
                    </span>
                </div>
            </div>
        </Card>
    );
}
