"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Mail, Calendar, Loader2, Clock, Tag, RefreshCw, Inbox, Star, AlertCircle, Send, Hash, Pause, Zap, Timer, AlarmClock, Bookmark, ShoppingBag, CheckCircle, Bell } from "lucide-react";

export interface SyncPreferences {
    syncMode: "count" | "days"; // NEW: toggle between count and days
    emailCount: number;
    dateRange: string; // "1d" | "3d" | "1w" | "2w" | "1m" | "all"
    autoSyncInterval: number; // 0 = off, in minutes
    labels: string[];
    excludePromotions: boolean;
    excludeUpdates: boolean;
}

interface SyncPreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (preferences: SyncPreferences) => void;
    isLoading?: boolean;
    initialPreferences?: Partial<SyncPreferences>;
}

const EMAIL_COUNT_OPTIONS = [
    { value: 25, label: "25", description: "Quick" },
    { value: 50, label: "50", description: "Balanced" },
    { value: 100, label: "100", description: "Full" },
    { value: 250, label: "250", description: "Extended" },
];

const DATE_RANGE_OPTIONS = [
    { value: "1d", label: "1 Day" },
    { value: "3d", label: "3 Days" },
    { value: "1w", label: "1 Week" },
    { value: "2w", label: "2 Weeks" },
    { value: "1m", label: "1 Month" },
    { value: "all", label: "All" },
];

const AUTO_SYNC_OPTIONS = [
    { value: 0, label: "Off", Icon: Pause },
    { value: 5, label: "5 min", Icon: Zap },
    { value: 15, label: "15 min", Icon: RefreshCw },
    { value: 30, label: "30 min", Icon: Timer },
    { value: 60, label: "1 hour", Icon: AlarmClock },
];

const LABEL_OPTIONS = [
    { value: "INBOX", label: "Inbox", icon: Inbox, color: "text-blue-500" },
    { value: "STARRED", label: "Starred", icon: Star, color: "text-yellow-500" },
    { value: "IMPORTANT", label: "Important", icon: AlertCircle, color: "text-red-500" },
    { value: "SENT", label: "Sent", icon: Send, color: "text-green-500" },
    { value: "TAGGED", label: "Tagged", icon: Bookmark, color: "text-purple-500" },
];

export function SyncPreferencesModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
    initialPreferences,
}: SyncPreferencesModalProps) {
    const [syncMode, setSyncMode] = useState<"count" | "days">(initialPreferences?.syncMode || "count");
    const [emailCount, setEmailCount] = useState<number>(initialPreferences?.emailCount || 50);
    const [dateRange, setDateRange] = useState<string>(initialPreferences?.dateRange || "1w");
    const [autoSyncInterval, setAutoSyncInterval] = useState<number>(initialPreferences?.autoSyncInterval || 0);
    const [labels, setLabels] = useState<string[]>(initialPreferences?.labels || ["INBOX"]);
    const [excludePromotions, setExcludePromotions] = useState<boolean>(initialPreferences?.excludePromotions ?? true);
    const [excludeUpdates, setExcludeUpdates] = useState<boolean>(initialPreferences?.excludeUpdates ?? true);

    const handleConfirm = () => {
        onConfirm({ syncMode, emailCount, dateRange, autoSyncInterval, labels, excludePromotions, excludeUpdates });
    };

    const toggleLabel = (label: string) => {
        if (labels.includes(label)) {
            if (labels.length > 1) {
                setLabels(labels.filter(l => l !== label));
            }
        } else {
            setLabels([...labels, label]);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-primary" />
                        Sync Preferences
                    </DialogTitle>
                    <DialogDescription>
                        Configure how your emails are synced and classified.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Sync Mode Toggle */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Sync Method</label>
                        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                            <button
                                onClick={() => setSyncMode("count")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
                                    syncMode === "count"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Hash className="w-4 h-4" />
                                By Count
                            </button>
                            <button
                                onClick={() => setSyncMode("days")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
                                    syncMode === "days"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Calendar className="w-4 h-4" />
                                By Days
                            </button>
                        </div>
                    </div>

                    {/* Conditional: Email Count OR Date Range */}
                    {syncMode === "count" ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                Max Emails to Sync
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {EMAIL_COUNT_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setEmailCount(option.value)}
                                        className={cn(
                                            "flex flex-col items-center p-2.5 rounded-lg border-2 transition-all",
                                            emailCount === option.value
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border bg-card hover:border-muted-foreground/50"
                                        )}
                                    >
                                        <span className="text-lg font-bold">{option.label}</span>
                                        <span className="text-[10px] text-muted-foreground">{option.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                Sync Emails From
                            </label>
                            <div className="grid grid-cols-6 gap-1.5">
                                {DATE_RANGE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setDateRange(option.value)}
                                        className={cn(
                                            "flex flex-col items-center py-2 px-1 rounded-lg border-2 transition-all text-xs",
                                            dateRange === option.value
                                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                                : "border-border bg-card hover:border-muted-foreground/50"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Auto Sync */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            Auto-Sync Interval
                        </label>
                        <div className="grid grid-cols-5 gap-1.5">
                            {AUTO_SYNC_OPTIONS.map((option) => {
                                const OptionIcon = option.Icon;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setAutoSyncInterval(option.value)}
                                        className={cn(
                                            "flex flex-col items-center py-2 px-1 rounded-lg border-2 transition-all",
                                            autoSyncInterval === option.value
                                                ? "border-green-500 bg-green-500/10 text-green-600"
                                                : "border-border bg-card hover:border-muted-foreground/50"
                                        )}
                                    >
                                        <OptionIcon className="w-4 h-4" />
                                        <span className="text-[10px] font-medium mt-1">{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {autoSyncInterval > 0 && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                Emails will sync automatically every {autoSyncInterval} minutes
                            </p>
                        )}
                    </div>

                    {/* Gmail Labels */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Tag className="w-4 h-4 text-muted-foreground" />
                            Gmail Labels to Sync
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {LABEL_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const isSelected = labels.includes(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => toggleLabel(option.value)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all",
                                            isSelected
                                                ? "border-primary bg-primary/10"
                                                : "border-border bg-card hover:border-muted-foreground/50 opacity-60"
                                        )}
                                    >
                                        <Icon className={cn("w-4 h-4", option.color)} />
                                        <span className="text-[10px] font-medium">{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-3">
                                <ShoppingBag className="w-5 h-5 text-amber-600" />
                                <div>
                                    <p className="text-sm font-medium">Skip Promos</p>
                                    <p className="text-xs text-muted-foreground">Omit marketing</p>
                                </div>
                            </div>
                            <Switch
                                checked={excludePromotions}
                                onCheckedChange={setExcludePromotions}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-3">
                                <Bell className="w-5 h-5 text-cyan-600" />
                                <div>
                                    <p className="text-sm font-medium">Skip Updates</p>
                                    <p className="text-xs text-muted-foreground">Omit notifications</p>
                                </div>
                            </div>
                            <Switch
                                checked={excludeUpdates}
                                onCheckedChange={setExcludeUpdates}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={isLoading} className="min-w-[120px]">
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Start Sync
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog >
    );
}

// Helper to convert date range to Gmail query
export function dateRangeToQuery(dateRange: string): string {
    const days: Record<string, number> = {
        "1d": 1,
        "3d": 3,
        "1w": 7,
        "2w": 14,
        "1m": 30,
    };

    const daysAgo = days[dateRange];
    if (!daysAgo) return ""; // "all" - no date filter

    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD

    return `after:${formattedDate}`;
}

