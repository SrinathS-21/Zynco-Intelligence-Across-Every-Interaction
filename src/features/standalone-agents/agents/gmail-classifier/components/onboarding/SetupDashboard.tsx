/**
 * Setup Dashboard - strict No Scroll Fit
 * Reduced height calc and tighter spacing to prevent scroll
 */

"use client";

import { Button } from "@/components/ui/button";
import {
    Mail,
    Wrench,
    Sparkles,
    CheckCircle2,
    Zap,
    LayoutDashboard,
    FileText,
    ArrowUpRight,
    RefreshCcw
} from "lucide-react";

interface SetupDashboardProps {
    userEmail: string;
    connectedTools: string[];
    preferences: {
        organizationType?: string;
        emailVolume?: string;
        primaryRole?: string;
        responseTime?: string;
        primaryPriority?: string;
    };
    onOpenDashboard: () => void;
    onManageTools: () => void;
    onManageKnowledgeBase: () => void;
    onRetakeQuiz: () => void;
}

export function SetupDashboard({
    userEmail,
    connectedTools,
    preferences,
    onOpenDashboard,
    onManageTools,
    onManageKnowledgeBase,
    onRetakeQuiz,
}: SetupDashboardProps) {

    const formatPref = (str?: string) => {
        if (!str) return "Not set";
        return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        // Reduced height to -140px to account for parent padding (py-8 = 64px) and app header
        <div className="w-full max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col p-2 gap-2 relative">

            {/* Header */}
            <div className="flex-none flex justify-between items-end pb-1 border-b border-border/40">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Welcome, {userEmail.split('@')[0]}!</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Setup Overview</p>
                </div>
                <div className="bg-card border border-border shadow-sm rounded-lg p-1.5 px-3 flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">Complete</span>
                    <span className="text-sm font-bold text-foreground">3/3</span>
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-foreground w-full rounded-full" />
                    </div>
                </div>
            </div>

            {/* Row 1: Status Cards */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* Email */}
                <div className="bg-card border border-border shadow-sm rounded-xl p-3 flex flex-col gap-2 transition-shadow hover:shadow-md">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2.5 items-center">
                            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-foreground">
                                <Mail className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold">Email Setup</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-foreground" />
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2 text-xs font-medium text-foreground truncate border border-border/50">
                        {userEmail}
                    </div>
                </div>

                {/* Tools */}
                <div className="bg-card border border-border shadow-sm rounded-xl p-3 flex flex-col gap-2 transition-shadow hover:shadow-md cursor-pointer" onClick={onManageTools}>
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2.5 items-center">
                            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-foreground">
                                <Wrench className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold">Tools</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-foreground" />
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2 flex justify-between items-center text-xs font-medium text-foreground border border-border/50 hover:bg-muted/50 transition-colors">
                        <span>{connectedTools.length > 0 ? connectedTools[0] : "None"}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                </div>

                {/* AI Prefs */}
                <div className="bg-card border border-border shadow-sm rounded-xl p-3 flex flex-col gap-2 transition-shadow hover:shadow-md">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2.5 items-center">
                            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-foreground">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold">Preferences</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-foreground" />
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRetakeQuiz}
                        className="h-[30px] justify-start px-2 bg-muted/30 border border-border/50 text-xs text-muted-foreground hover:text-foreground w-full"
                    >
                        <RefreshCcw className="w-3 h-3 mr-2" />
                        Retake
                    </Button>
                </div>
            </div>

            {/* Row 2: Quick Actions */}
            <div className="flex-none bg-card border border-border shadow-sm rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex gap-2 items-center min-w-[120px] px-1 border-b sm:border-b-0 sm:border-r border-border/50 pb-2 sm:pb-0">
                    <Zap className="w-4 h-4 text-foreground" />
                    <h3 className="text-sm font-semibold">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-2 md:flex gap-2 w-full">
                    <button
                        onClick={onManageKnowledgeBase}
                        className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/30 hover:border-border transition-all"
                    >
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Knowledge Base</span>
                    </button>
                    <button
                        onClick={onManageTools}
                        className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/30 hover:border-border transition-all"
                    >
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Manage Tools</span>
                    </button>
                    <button className="hidden md:flex flex-1 items-center justify-center gap-2 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/30 hover:border-border transition-all opacity-50 cursor-not-allowed">
                        <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Analytics</span>
                    </button>
                </div>
            </div>

            {/* Row 3: Preferences */}
            <div className="flex-none bg-card border border-border shadow-sm rounded-xl p-3 space-y-2">
                <div className="flex gap-2 items-center px-1">
                    <Sparkles className="w-4 h-4 text-foreground" />
                    <h3 className="text-sm font-semibold">Preferences</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                        { l: "Org", v: preferences.organizationType },
                        { l: "Vol", v: preferences.emailVolume },
                        { l: "Role", v: preferences.primaryRole },
                        { l: "Time", v: preferences.responseTime },
                        { l: "Prio", v: preferences.primaryPriority },
                    ].map((pref, i) => (
                        <div key={i} className="bg-muted/30 rounded-lg p-2 border border-border/30 text-center">
                            <p className="text-[10px] uppercase text-muted-foreground/70 mb-0.5 tracking-wider font-semibold">{pref.l}</p>
                            <p className="text-sm font-medium text-foreground truncate">{formatPref(pref.v)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Row 4: Launch Hero - Flexible Height */}
            <div className="flex-1 min-h-0 bg-card rounded-2xl border border-border shadow-sm relative overflow-hidden flex flex-col items-center justify-center p-4">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 to-zinc-900/5 dark:from-white/5 dark:to-transparent" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mb-3 shadow-sm bg-background">
                        <Mail className="w-6 h-6 text-foreground" />
                    </div>

                    <h2 className="text-2xl font-bold text-foreground mb-1">We're Ready To Go!</h2>
                    <p className="text-muted-foreground text-sm max-w-sm text-center mb-4 leading-tight">
                        Your Email classifier is fully configured. Launch your dashboard to see it in action.
                    </p>

                    <Button
                        onClick={onOpenDashboard}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-10 text-sm font-medium rounded-full shadow-lg"
                    >
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Launch Dashboard
                    </Button>
                </div>
            </div>

        </div>
    );
}
