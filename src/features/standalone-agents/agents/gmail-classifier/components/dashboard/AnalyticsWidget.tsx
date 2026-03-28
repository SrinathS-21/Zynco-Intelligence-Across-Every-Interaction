"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Activity, AlertCircle, CheckCircle2, TrendingUp, Mail, Clock,
    Users, Zap, Calendar, TrendingDown, Sparkles, Target, Coffee
} from "lucide-react";

interface Email {
    id: string;
    category: string;
    priority: string;
    isRead?: boolean;
    date: string;
    from: string;
    subject?: string;
}

interface AnalyticsWidgetProps {
    emails: Email[];
    stats?: any;
    className?: string;
}

// Colors aligned with category config
const COLORS = {
    requires_action: '#ef4444', // red-500
    important: '#f97316',      // orange-500
    personal: '#3b82f6',       // blue-500
    transactional: '#a855f7',  // purple-500
    updates: '#06b6d4',        // cyan-500
    newsletters: '#64748b',    // slate-500
    promotional: '#10b981',    // emerald-500
    automated: '#94a3b8',      // slate-400
};

// Helper to extract email domain or name
function getEmailSender(from: string): string {
    // Extract name or email
    const match = from.match(/^(.*?)\s*</) || from.match(/^([^@]+)/);
    if (match && match[1]) {
        return match[1].trim().substring(0, 20);
    }
    return from.substring(0, 20);
}

// Get day of week from date
function getDayOfWeek(date: string): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(date).getDay()];
}

// Smart insight generator
function generateInsights(stats: {
    total: number;
    unread: number;
    actionRequired: number;
    highPriority: number;
    noisePercentage: number;
    topSenders: { name: string; count: number }[];
    emailsByDay: { day: string; count: number }[];
    averagePerDay: number;
    importantPercentage: number;
    automations?: {
        jira_task: number;
        notion_page: number;
        slack_message: number;
        crm_order: number;
        total: number;
    };
}): { type: 'tip' | 'warning' | 'success' | 'info'; message: string; icon: typeof Coffee }[] {
    const insights: { type: 'tip' | 'warning' | 'success' | 'info'; message: string; icon: typeof Coffee }[] = [];

    // Unread emails insight
    if (stats.unread > 20) {
        insights.push({
            type: 'warning',
            message: `You have ${stats.unread} unread emails. Consider setting aside 15 mins to clear your inbox.`,
            icon: Mail
        });
    } else if (stats.unread === 0) {
        insights.push({
            type: 'success',
            message: `Inbox zero achieved! Great job staying on top of your emails.`,
            icon: CheckCircle2
        });
    }

    // Action required insight
    if (stats.actionRequired > 0) {
        insights.push({
            type: 'warning',
            message: `${stats.actionRequired} email${stats.actionRequired > 1 ? 's' : ''} need your response. Prioritize these first!`,
            icon: AlertCircle
        });
    }

    // Noise insight
    if (stats.noisePercentage > 40) {
        insights.push({
            type: 'tip',
            message: `${stats.noisePercentage}% of your inbox is newsletters & promos. Consider unsubscribing from some.`,
            icon: TrendingDown
        });
    }

    // Top sender insight
    if (stats.topSenders.length > 0 && stats.topSenders[0].count > 5) {
        insights.push({
            type: 'info',
            message: `"${stats.topSenders[0].name}" sends you the most emails (${stats.topSenders[0].count}). Create a rule?`,
            icon: Users
        });
    }

    // Volume insight
    if (stats.averagePerDay > 20) {
        insights.push({
            type: 'tip',
            message: `You receive ~${Math.round(stats.averagePerDay)} emails/day. Consider batch processing.`,
            icon: Clock
        });
    }

    // Success insight
    if (stats.importantPercentage > 60) {
        insights.push({
            type: 'success',
            message: `${stats.importantPercentage}% of your emails are important. Your filters are working well!`,
            icon: Target
        });
    }

    // Automation insights
    if (stats.automations && stats.automations.total > 0) {
        const auto = stats.automations;
        if (auto.jira_task > 5) {
            insights.push({
                type: 'success',
                message: `SpinaBOT has saved you from manually creating ${auto.jira_task} Jira tasks!`,
                icon: Zap
            });
        }
        if (auto.crm_order > 0) {
            insights.push({
                type: 'info',
                message: `Automation has processed ${auto.crm_order} CRM orders automatically.`,
                icon: Activity
            });
        }
    }

    // Default insight if none
    if (insights.length === 0) {
        insights.push({
            type: 'success',
            message: 'Your inbox looks healthy! Keep up the good work.',
            icon: Sparkles
        });
    }

    return insights.slice(0, 3); // Max 3 insights
}

export function AnalyticsWidget({ emails, stats: automationStats, className }: AnalyticsWidgetProps) {
    const stats = useMemo(() => {
        const total = emails.length;
        if (total === 0) return null;

        let highPriority = 0;
        let actionRequired = 0;
        let unread = 0;
        let importantCount = 0;

        // Category counts for Pie Chart
        const categoryCounts: Record<string, number> = {};
        // Sender counts
        const senderCounts: Record<string, number> = {};
        // Emails by day
        const dayCountsMap: Record<string, number> = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };

        emails.forEach(e => {
            if (e.priority === 'high' || e.priority === 'urgent') highPriority++;
            if (e.category === 'requires_action') actionRequired++;
            if (!e.isRead) unread++;
            if (e.category === 'important' || e.priority === 'high') importantCount++;

            const cat = e.category || 'other';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

            // Track senders
            const sender = getEmailSender(e.from);
            senderCounts[sender] = (senderCounts[sender] || 0) + 1;

            // Track by day
            const day = getDayOfWeek(e.date);
            dayCountsMap[day] = (dayCountsMap[day] || 0) + 1;
        });

        const chartData = Object.entries(categoryCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const topSenders = Object.entries(senderCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const emailsByDay = Object.entries(dayCountsMap)
            .map(([day, count]) => ({ day, count }));

        const promoCount = chartData.find(d => d.name === 'promotional')?.value ?? 0;
        const newsletterCount = chartData.find(d => d.name === 'newsletters')?.value ?? 0;
        const noisePercentage = total > 0 ? Math.round((promoCount + newsletterCount) / total * 100) : 0;
        const importantPercentage = total > 0 ? Math.round(importantCount / total * 100) : 0;

        // Calculate average emails per day (assuming 7 days of data)
        const averagePerDay = total / 7;

        return {
            total,
            highPriority,
            actionRequired,
            unread,
            chartData,
            topSenders,
            emailsByDay,
            noisePercentage,
            importantPercentage,
            averagePerDay,
            automations: automationStats?.automations
        };
    }, [emails, automationStats]);

    if (!stats || stats.total === 0) return null;

    const insights = generateInsights(stats);

    const insightStyles = {
        tip: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
        warning: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
        success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
        info: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    };

    return (
        <div className={cn("space-y-6", className)}>
            {/* Row 1: Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-neutral-900 dark:to-zinc-950 dark:border-zinc-700/40 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Unread</p>
                            <p className="text-2xl font-bold text-foreground">{stats.unread}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-500" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-neutral-900 dark:to-zinc-950 dark:border-zinc-700/40 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Needs Reply</p>
                            <p className="text-2xl font-bold text-red-500">{stats.actionRequired}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-neutral-900 dark:to-zinc-950 dark:border-zinc-700/40 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">High Priority</p>
                            <p className="text-2xl font-bold text-orange-500">{stats.highPriority}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-orange-500" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-neutral-900 dark:to-zinc-950 dark:border-zinc-700/40 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Focus Score</p>
                            <p className="text-2xl font-bold text-emerald-500">{100 - stats.noisePercentage}%</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-emerald-500" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Row 2: Charts & Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-neutral-900 dark:to-zinc-950 dark:border-zinc-700/40 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Categories
                    </h3>
                    <div className="h-[120px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={30}
                                    outerRadius={50}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {stats.chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[entry.name as keyof typeof COLORS] || '#94a3b8'}
                                            strokeWidth={0}
                                        />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {stats.chartData.slice(0, 4).map((entry) => (
                            <Badge key={entry.name} variant="secondary" className="text-[10px] capitalize">
                                <span
                                    className="w-2 h-2 rounded-full mr-1"
                                    style={{ backgroundColor: COLORS[entry.name as keyof typeof COLORS] || '#94a3b8', display: 'inline-block' }}
                                />
                                {entry.name.replace('_', ' ')}
                            </Badge>
                        ))}
                    </div>
                </Card>

                <Card className="p-4 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-neutral-900 dark:to-zinc-950 dark:border-zinc-700/40 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Smart Insights
                    </h3>
                    <div className="space-y-2">
                        {insights.map((insight, index) => {
                            const IconComponent = insight.icon;
                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "p-2 rounded-lg border text-xs leading-relaxed",
                                        insightStyles[insight.type]
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        <IconComponent className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                        <span>{insight.message}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <Card className="p-4 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-neutral-900 dark:to-zinc-950 dark:border-zinc-700/40 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Automation Impact
                    </h3>
                    <div className="space-y-3">
                        {stats.automations ? (
                            <>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        Jira Tasks
                                    </span>
                                    <span className="font-medium">{stats.automations.jira_task}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                        Notion Pages
                                    </span>
                                    <span className="font-medium">{stats.automations.notion_page}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                        Slack Messages
                                    </span>
                                    <span className="font-medium">{stats.automations.slack_message}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        CRM Orders
                                    </span>
                                    <span className="font-medium">{stats.automations.crm_order}</span>
                                </div>
                                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                                    <span className="text-xs font-semibold">Total Actions</span>
                                    <span className="text-sm font-bold text-primary">{stats.automations.total}</span>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                <Coffee className="w-8 h-8 opacity-10 mb-2" />
                                <p className="text-[10px] text-muted-foreground">No automation data yet.<br />Connect tools to see impact.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Row 3: Weekly Activity */}
            <Card className="p-4 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-neutral-900 dark:to-zinc-950 dark:border-zinc-700/40 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Weekly Activity
                    <span className="text-xs font-normal text-muted-foreground ml-auto">
                        ~{Math.round(stats.averagePerDay)} emails/day
                    </span>
                </h3>
                <div className="h-[80px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.emailsByDay} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <XAxis
                                dataKey="day"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                            />
                            <Bar
                                dataKey="count"
                                fill="#3b82f6"
                                radius={[4, 4, 0, 0]}
                            />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
