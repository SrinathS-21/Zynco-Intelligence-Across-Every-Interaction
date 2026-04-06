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
            <div className="flex-none flex justify-between items-end pb-1 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Welcome, {userEmail.split('@')[0]}!</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Setup Overview</p>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/35 p-1.5 px-3 shadow-sm">
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
                <div className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white/95 p-3 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2.5 items-center">
                            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-1.5 text-blue-700">
                                <Mail className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold">Email Setup</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-foreground" />
                    </div>
                    <div className="truncate rounded-lg border border-blue-100 bg-blue-50/40 p-2 text-xs font-medium text-slate-800">
                        {userEmail}
                    </div>
                </div>

                {/* Tools */}
                <div className="flex cursor-pointer flex-col gap-2 rounded-xl border border-violet-100 bg-white/95 p-3 shadow-sm transition-shadow hover:shadow-md" onClick={onManageTools}>
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2.5 items-center">
                            <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-1.5 text-violet-700">
                                <Wrench className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold">Tools</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-foreground" />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-violet-100 bg-violet-50/35 p-2 text-xs font-medium text-slate-800 transition-colors hover:bg-violet-50/55">
                        <span>{connectedTools.length > 0 ? connectedTools[0] : "None"}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                </div>

                {/* AI Prefs */}
                <div className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white/95 p-3 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2.5 items-center">
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-1.5 text-emerald-700">
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
                        className="h-7.5 w-full justify-start border border-emerald-100 bg-emerald-50/35 px-2 text-xs text-emerald-700 hover:bg-emerald-50/55 hover:text-emerald-800"
                    >
                        <RefreshCcw className="w-3 h-3 mr-2" />
                        Retake
                    </Button>
                </div>
            </div>

            {/* Row 2: Quick Actions */}
            <div className="flex-none flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm sm:flex-row">
                <div className="flex min-w-30 items-center gap-2 border-b border-border/50 px-1 pb-2 sm:border-r sm:border-b-0 sm:pb-0">
                    <Zap className="w-4 h-4 text-foreground" />
                    <h3 className="text-sm font-semibold">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-2 md:flex gap-2 w-full">
                    <button
                        onClick={onManageKnowledgeBase}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50/55 p-2.5 transition-all hover:bg-slate-100/80 hover:border-slate-300"
                    >
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Knowledge Base</span>
                    </button>
                    <button
                        onClick={onManageTools}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50/55 p-2.5 transition-all hover:bg-slate-100/80 hover:border-slate-300"
                    >
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Manage Tools</span>
                    </button>
                    <button className="hidden md:flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50/55 p-2.5 opacity-50 transition-all hover:bg-slate-100/80 hover:border-slate-300">
                        <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Analytics</span>
                    </button>
                </div>
            </div>

            {/* Row 3: Preferences */}
            <div className="flex-none space-y-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
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
                        <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/55 p-2 text-center">
                            <p className="text-[10px] uppercase text-muted-foreground/70 mb-0.5 tracking-wider font-semibold">{pref.l}</p>
                            <p className="text-sm font-medium text-foreground truncate">{formatPref(pref.v)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Row 4: Launch Hero - Flexible Height */}
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-sm">
                <div className="absolute inset-0 bg-linear-to-br from-blue-50/35 via-transparent to-indigo-50/25" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-slate-50 shadow-sm">
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
