"use client";

import { useState, useEffect } from "react";
// Imports removed to fix bundling error
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ActivityLog, ActivityType, formatActivityTime, getActivityColor } from "@/lib/activity-history";
import { ActivityIcon } from "./ActivityIcon";

interface ActivityHistoryProps {
    agentId: string;
    className?: string;
}

const FILTER_OPTIONS: { value: ActivityType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Activity' },
    { value: 'connection', label: 'Connections' },
    { value: 'jira_task', label: 'Jira Tasks' },
    { value: 'notion_page', label: 'Notion Pages' },
    { value: 'crm_order', label: 'CRM Orders' },
    { value: 'rule_executed', label: 'Rule Executions' },
    { value: 'email_sync', label: 'Email Syncs' },
    { value: 'knowledge_added', label: 'Knowledge Base' },
];

export function ActivityHistory({ agentId, className }: ActivityHistoryProps) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [filter, setFilter] = useState<ActivityType | 'all'>('all');

    const trpc = useTRPC();

    // Fetch activity logs using the working queryOptions pattern
    const { data, isLoading: queryLoading } = useQuery({
        ...trpc.standaloneAgents.getActivityLogs.queryOptions(
            { id: agentId, type: filter === 'all' ? undefined : filter },
        ),
        enabled: !!agentId,
        refetchInterval: 30000,
    });


    useEffect(() => {
        setLogs(Array.isArray(data) ? data : []);
    }, [data]);

    const isLoading = queryLoading && logs.length === 0;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <ActivityIcon type="success" className="w-3 h-3 text-emerald-500" />;
            case 'failed':
                return <ActivityIcon type="failed" className="w-3 h-3 text-red-500" />;
            case 'pending':
                return <ActivityIcon type="loading" className="w-3 h-3 text-yellow-500 animate-spin" />;
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-12", className)}>
                <ActivityIcon type="loading" className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-2">Loading activity...</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                    <ActivityIcon type="activity" className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Activity History</h3>
                    <Badge variant="secondary" className="text-[10px] h-5">{logs.length}</Badge>
                </div>

                {/* Filter Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                            <ActivityIcon type="filter" className="w-3 h-3" />
                            {FILTER_OPTIONS.find(f => f.value === filter)?.label || 'All'}
                            <ActivityIcon type="chevron-down" className="w-3 h-3" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-xs">Filter by Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {FILTER_OPTIONS.map(option => (
                            <DropdownMenuItem
                                key={option.value}
                                onClick={() => setFilter(option.value)}
                                className={cn("text-xs", filter === option.value && "bg-accent")}
                            >
                                {option.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Activity List */}
            <div className="flex-1 overflow-auto">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <ActivityIcon type="activity" className="w-8 h-8 text-muted-foreground/50 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Actions like syncing emails, creating Jira tasks, and connecting tools will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className="px-4 py-3 hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className={cn(
                                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-muted",
                                        getActivityColor(log.type)
                                    )}>
                                        <ActivityIcon type={log.type} className="w-3.5 h-3.5" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {log.action}
                                            </p>
                                            {getStatusIcon(log.status)}
                                        </div>
                                        {log.details && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                {log.details}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <ActivityIcon type="clock" className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground">
                                                {formatActivityTime(log.timestamp)}
                                            </span>
                                            {log.metadata?.tool && (
                                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">
                                                    {log.metadata.tool}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
