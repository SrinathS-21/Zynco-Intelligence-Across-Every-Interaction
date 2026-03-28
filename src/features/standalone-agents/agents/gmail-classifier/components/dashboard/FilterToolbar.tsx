"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
    Filter,
    ArrowUpDown,
    X,
    Calendar,
    User,
    Tag,
    AlertCircle,
    ChevronDown,
    Search,
} from "lucide-react";

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

interface FilterToolbarProps {
    emails: any[];
    filters: FilterState;
    sort: SortState;
    onFiltersChange: (filters: FilterState) => void;
    onSortChange: (sort: SortState) => void;
    onClearFilters: () => void;
}

const PRIORITY_OPTIONS = [
    { value: "critical", label: "Critical", color: "bg-red-500" },
    { value: "high", label: "High", color: "bg-orange-500" },
    { value: "medium", label: "Medium", color: "bg-yellow-500" },
    { value: "low", label: "Low", color: "bg-gray-400" },
];

const DATE_OPTIONS = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
];

const SORT_OPTIONS = [
    { field: "date", direction: "desc", label: "Newest First" },
    { field: "date", direction: "asc", label: "Oldest First" },
    { field: "priority", direction: "desc", label: "Priority (High → Low)" },
    { field: "sender", direction: "asc", label: "Sender (A-Z)" },
];

export function FilterToolbar({
    emails,
    filters,
    sort,
    onFiltersChange,
    onSortChange,
    onClearFilters,
}: FilterToolbarProps) {
    const [senderSearch, setSenderSearch] = useState("");

    // Extract unique senders from emails
    const uniqueSenders = useMemo(() => {
        const senders = new Map<string, number>();
        emails.forEach((email) => {
            const sender = email.from?.replace(/<.*>/, "").trim() || email.from;
            senders.set(sender, (senders.get(sender) || 0) + 1);
        });
        return Array.from(senders.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
    }, [emails]);

    // Filter senders by search
    const filteredSenders = useMemo(() => {
        if (!senderSearch) return uniqueSenders;
        return uniqueSenders.filter(([sender]) =>
            sender.toLowerCase().includes(senderSearch.toLowerCase())
        );
    }, [uniqueSenders, senderSearch]);

    // Count active filters
    const activeFilterCount =
        (filters?.categories?.length || 0) +
        (filters?.priorities?.length || 0) +
        (filters?.senders?.length || 0) +
        (filters?.dateRange !== "all" ? 1 : 0) +
        (filters?.readStatus !== "all" ? 1 : 0) +
        (filters?.hasAttachment !== null && filters?.hasAttachment !== undefined ? 1 : 0);

    const togglePriority = (priority: string) => {
        const priorities = filters?.priorities || [];
        const newPriorities = priorities.includes(priority)
            ? priorities.filter((p) => p !== priority)
            : [...priorities, priority];
        onFiltersChange({ ...filters, priorities: newPriorities });
    };

    const toggleSender = (sender: string) => {
        const senders = filters?.senders || [];
        const newSenders = senders.includes(sender)
            ? senders.filter((s) => s !== sender)
            : [...senders, sender];
        onFiltersChange({ ...filters, senders: newSenders });
    };

    const setDateRange = (range: FilterState["dateRange"]) => {
        onFiltersChange({ ...filters, dateRange: range });
    };

    const setReadStatus = (status: FilterState["readStatus"]) => {
        onFiltersChange({ ...filters, readStatus: status });
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Priority Filter */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant={(filters?.priorities?.length || 0) > 0 ? "default" : "outline"}
                        size="sm"
                        className={cn(
                            "h-8 gap-1.5 text-xs font-medium shadow-sm",
                            (filters?.priorities?.length || 0) > 0
                                ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                                : "hover:bg-accent"
                        )}
                    >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Priority
                        {filters.priorities.length > 0 && (
                            <Badge className="h-4 px-1.5 text-[10px] bg-white/20 text-white border-0">
                                {filters.priorities.length}
                            </Badge>
                        )}
                        <ChevronDown className="w-3 h-3 opacity-70" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuLabel className="text-xs font-semibold">Filter by Priority</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {PRIORITY_OPTIONS.map((option) => (
                        <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={filters.priorities.includes(option.value)}
                            onCheckedChange={() => togglePriority(option.value)}
                            className="gap-2"
                        >
                            <div className="flex items-center gap-2">
                                <div className={cn("w-2.5 h-2.5 rounded-full", option.color)} />
                                <span className="font-medium">{option.label}</span>
                            </div>
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Sender Filter */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={filters.senders.length > 0 ? "default" : "outline"}
                        size="sm"
                        className={cn(
                            "h-8 gap-1.5 text-xs font-medium shadow-sm",
                            filters.senders.length > 0
                                ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                                : "hover:bg-accent"
                        )}
                    >
                        <User className="w-3.5 h-3.5" />
                        Sender
                        {filters.senders.length > 0 && (
                            <Badge className="h-4 px-1.5 text-[10px] bg-white/20 text-white border-0">
                                {filters.senders.length}
                            </Badge>
                        )}
                        <ChevronDown className="w-3 h-3 opacity-70" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-3">
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search senders..."
                                value={senderSearch}
                                onChange={(e) => setSenderSearch(e.target.value)}
                                className="h-9 pl-8 text-sm"
                            />
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-1">
                            {filteredSenders.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">No senders found</p>
                            ) : (
                                filteredSenders.map(([sender, count]) => (
                                    <button
                                        key={sender}
                                        onClick={() => toggleSender(sender)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-md transition-colors",
                                            filters.senders.includes(sender)
                                                ? "bg-blue-500 text-white"
                                                : "hover:bg-accent"
                                        )}
                                    >
                                        <span className="truncate font-medium">{sender}</span>
                                        <Badge
                                            variant={filters.senders.includes(sender) ? "secondary" : "outline"}
                                            className={cn(
                                                "h-5 px-1.5 text-[10px]",
                                                filters.senders.includes(sender) && "bg-white/20 text-white border-0"
                                            )}
                                        >
                                            {count}
                                        </Badge>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Date Range Filter */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant={filters.dateRange !== "all" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                            "h-8 gap-1.5 text-xs font-medium shadow-sm",
                            filters.dateRange !== "all"
                                ? "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"
                                : "hover:bg-accent"
                        )}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        {DATE_OPTIONS.find((d) => d.value === filters.dateRange)?.label || "Date"}
                        <ChevronDown className="w-3 h-3 opacity-70" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                    {DATE_OPTIONS.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onClick={() => setDateRange(option.value as FilterState["dateRange"])}
                            className={cn(
                                "font-medium",
                                filters.dateRange === option.value && "bg-purple-500/10 text-purple-600"
                            )}
                        >
                            {option.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Read Status */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant={filters.readStatus !== "all" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                            "h-8 gap-1.5 text-xs font-medium shadow-sm",
                            filters.readStatus !== "all"
                                ? "bg-green-500 hover:bg-green-600 text-white border-green-500"
                                : "hover:bg-accent"
                        )}
                    >
                        {filters.readStatus === "all" ? "All Emails" : filters.readStatus === "unread" ? "📩 Unread" : "✓ Read"}
                        <ChevronDown className="w-3 h-3 opacity-70" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32">
                    <DropdownMenuItem onClick={() => setReadStatus("all")} className="font-medium">All Emails</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setReadStatus("unread")} className="font-medium">📩 Unread Only</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setReadStatus("read")} className="font-medium">✓ Read Only</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator */}
            <div className="h-6 w-px bg-border mx-1" />

            {/* Sort */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium shadow-sm hover:bg-accent">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {SORT_OPTIONS.find(o => o.field === sort.field && o.direction === sort.direction)?.label || "Sort"}
                        <ChevronDown className="w-3 h-3 opacity-70" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="text-xs font-semibold">Sort By</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SORT_OPTIONS.map((option) => (
                        <DropdownMenuItem
                            key={`${option.field}-${option.direction}`}
                            onClick={() => onSortChange({ field: option.field as SortState["field"], direction: option.direction as SortState["direction"] })}
                            className={cn(
                                "font-medium",
                                sort.field === option.field && sort.direction === option.direction && "bg-primary/10"
                            )}
                        >
                            {option.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={onClearFilters}
                >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Clear All ({activeFilterCount})
                </Button>
            )}
        </div>
    );
}

export const defaultFilters: FilterState = {
    categories: [],
    priorities: [],
    senders: [],
    dateRange: "all",
    readStatus: "all",
    hasAttachment: null,
};

export const defaultSort: SortState = {
    field: "date",
    direction: "desc",
};
