"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Loader2,
    AlertCircle,
    TrendingUp,
    Inbox,
    CheckCircle,
    Clock,
    AlertTriangle,
    Bell,
    Target,
    Lightbulb
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";

interface DigestInsights {
    repliedEmails: string[];
    pendingEmails: Array<{ id: string; urgency: string; reason: string }>;
    importantEmails: Array<{ id: string; reason: string }>;
    forgottenEmails: Array<{ id: string; context: string }>;
}

interface DigestData {
    date: string;
    totalEmails: number;
    repliedTo: number;
    pendingReply: number;
    important: number;
    forgotten: number;
    productivityScore: number;
    insights: DigestInsights;
    recommendations: string[];
    isCached?: boolean;
    cachedAt?: string;
    rateLimited?: boolean;
}

interface DailyDigestProps {
    agentId: string;
    isConnected: boolean;
    onEmailClick?: (emailId: string) => void;
}

export function DailyDigest({ agentId, isConnected, onEmailClick }: DailyDigestProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [digest, setDigest] = useState<DigestData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMainCollapsed, setIsMainCollapsed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDigest = async (force: boolean = false) => {
        if (!isConnected) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getDailyDigest.queryOptions({
                    id: agentId,
                    forceRefresh: force
                })
            );
            setDigest(data as any);
        } catch (error: any) {
            console.error("DailyDigest fetch error:", error);
            setError(error.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (agentId && isConnected) {
            fetchDigest();
        }
    }, [agentId, isConnected]);

    if (isLoading) {
        return (
            <Card className="p-6 mb-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Analyzing your emails...</span>
                </div>
            </Card>
        );
    }

    if (error) {
        const isRateLimit = error.includes("429") || error.toLowerCase().includes("rate limit") || error.toLowerCase().includes("busy");
        return (
            <Card className="p-6 mb-4 border-destructive/50 bg-destructive/5">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <div className="flex-1">
                        <p className="text-sm font-medium">
                            {isRateLimit ? "AI is catching its breath" : "Failed to load daily digest"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {isRateLimit ? "The AI service is currently busy. Showing what we can, try again in a bit." : error}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => fetchDigest(true)}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </Card>
        );
    }

    if (!digest) return null;

    // Don't show if no emails
    if (digest.totalEmails === 0) {
        return null;
    }

    return (
        <Card className="p-6 mb-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Daily Digest</h3>
                        <p className="text-xs text-muted-foreground">
                            {new Date(digest.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                            {digest.cachedAt && (
                                <span className="opacity-60 ml-2">
                                    • Updated {new Date(digest.cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {digest.isCached && (
                        <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/50 hidden sm:block">
                            {digest.rateLimited ? "AI Busy - Using Cache" : "Cached Result"}
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchDigest(true)}
                        className="h-8"
                        title="Force refresh analysis"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-4 bg-border/50 mx-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsMainCollapsed(!isMainCollapsed)}
                        className="h-8 w-8 p-0"
                        title={isMainCollapsed ? "Expand Digest" : "Collapse Digest"}
                    >
                        {isMainCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            <AnimatePresence>
                {!isMainCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 pt-2">
                            <StatCard icon={<Inbox className="w-5 h-5" />} label="Received" value={digest.totalEmails} />
                            <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Replied" value={digest.repliedTo} color="text-green-600" />
                            <StatCard icon={<Clock className="w-5 h-5" />} label="Pending" value={digest.pendingReply} color="text-orange-600" />
                            <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Important" value={digest.important} color="text-red-600" />
                            <StatCard icon={<Bell className="w-5 h-5" />} label="Forgotten" value={digest.forgotten} color="text-purple-600" />
                        </div>

                        {/* Productivity Score */}
                        <div className="mb-4 p-3 bg-background/50 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-medium">Productivity Score</span>
                                </div>
                                <Badge
                                    variant={digest.productivityScore >= 7 ? "default" : digest.productivityScore >= 4 ? "secondary" : "destructive"}
                                    className="text-sm px-3"
                                >
                                    {digest.productivityScore}/10
                                </Badge>
                            </div>
                            <div className="mt-2 w-full bg-muted rounded-full h-2">
                                <div
                                    className={cn(
                                        "h-2 rounded-full transition-all",
                                        digest.productivityScore >= 7 ? "bg-green-500" :
                                            digest.productivityScore >= 4 ? "bg-orange-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${digest.productivityScore * 10}%` }}
                                />
                            </div>
                        </div>

                        {/* Recommendations */}
                        {digest.recommendations.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-primary" />
                                    <span>Top Priority Actions:</span>
                                </h4>
                                <ul className="space-y-2">
                                    {digest.recommendations.slice(0, 3).map((rec: string, i: number) => (
                                        <li
                                            key={i}
                                            className="text-sm text-muted-foreground flex items-start gap-2 p-2 rounded-md bg-background/50 hover:bg-background/80 transition-colors"
                                        >
                                            <span className="text-primary font-bold">{i + 1}.</span>
                                            <span className="flex-1">{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Expand/Collapse Button for Details */}
                        {(digest.insights.pendingEmails.length > 0 ||
                            digest.insights.importantEmails.length > 0 ||
                            digest.insights.forgottenEmails.length > 0) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="w-full"
                                >
                                    {isExpanded ? (
                                        <>
                                            <ChevronUp className="w-4 h-4 mr-2" />
                                            Hide Details
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-4 h-4 mr-2" />
                                            View Details
                                        </>
                                    )}
                                </Button>
                            )}

                        {/* Expanded Details */}
                        {isExpanded && (
                            <div className="mt-4 space-y-3 pt-4 border-t border-border/50">
                                {/* Details content omitted for brevity, same as before */}
                                {digest.insights.pendingEmails.length > 0 && (
                                    <DetailSection
                                        icon={<Clock className="w-4 h-4 text-orange-500" />}
                                        title="Pending Reply"
                                        count={digest.insights.pendingEmails.length}
                                    >
                                        {digest.insights.pendingEmails.slice(0, 5).map((item, i) => (
                                            <DetailItem
                                                key={i}
                                                onClick={() => onEmailClick?.(item.id)}
                                                urgency={item.urgency}
                                            >
                                                <p className="text-sm font-medium">{item.reason}</p>
                                                <Badge
                                                    variant={item.urgency === 'high' ? 'destructive' : item.urgency === 'medium' ? 'default' : 'secondary'}
                                                    className="text-xs"
                                                >
                                                    {item.urgency}
                                                </Badge>
                                            </DetailItem>
                                        ))}
                                    </DetailSection>
                                )}

                                {digest.insights.importantEmails.length > 0 && (
                                    <DetailSection
                                        icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
                                        title="Important Unread"
                                        count={digest.insights.importantEmails.length}
                                    >
                                        {digest.insights.importantEmails.slice(0, 5).map((item, i) => (
                                            <DetailItem
                                                key={i}
                                                onClick={() => onEmailClick?.(item.id)}
                                            >
                                                <p className="text-sm">{item.reason}</p>
                                            </DetailItem>
                                        ))}
                                    </DetailSection>
                                )}

                                {digest.insights.forgottenEmails.length > 0 && (
                                    <DetailSection
                                        icon={<Bell className="w-4 h-4 text-purple-500" />}
                                        title="Forgotten Follow-ups"
                                        count={digest.insights.forgottenEmails.length}
                                    >
                                        {digest.insights.forgottenEmails.slice(0, 5).map((item, i) => (
                                            <DetailItem
                                                key={i}
                                                onClick={() => onEmailClick?.(item.id)}
                                            >
                                                <p className="text-sm">{item.context}</p>
                                            </DetailItem>
                                        ))}
                                    </DetailSection>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
    return (
        <div className="p-3 bg-background/50 rounded-lg text-center hover:bg-background/80 transition-colors">
            <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>
            <div className={cn("text-2xl font-bold", color)}>{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

function DetailSection({ icon, title, count, children }: { icon?: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
    return (
        <div className="bg-background/50 rounded-lg p-3">
            <h5 className="text-sm font-medium mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {icon}
                    <span>{title}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{count}</Badge>
            </h5>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
}

function DetailItem({
    children,
    onClick,
    urgency
}: {
    children: React.ReactNode;
    onClick?: () => void;
    urgency?: string;
}) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "p-2 rounded-md bg-background border border-border/50 transition-all",
                onClick && "cursor-pointer hover:border-primary/50 hover:bg-accent"
            )}
        >
            <div className="flex items-start justify-between gap-2">
                {children}
            </div>
        </div>
    );
}
