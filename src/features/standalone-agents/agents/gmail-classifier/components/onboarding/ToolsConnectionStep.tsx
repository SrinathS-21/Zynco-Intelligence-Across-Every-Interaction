/**
 * Tools Connection Step - Step 3
 * Exact layout from original design with SpinaBOT theme
 */

"use client";

import { useState, useEffect } from "react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon, WrenchIcon, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

interface ToolsConnectionStepProps {
    userEmail: string;
    connectedTools: string[];
    onToolConnect: (toolId: string) => void;
    onContinue: () => void;
    onBack?: () => void;
}

const tools = [
    {
        id: "jira",
        name: "Jira",
        description: "Project tracking & issues",
        logoSrc: "/logos/jira.svg",
        popular: false,
    },
    {
        id: "asana",
        name: "Asana",
        description: "Work management platform",
        logoSrc: "/logos/asana-logo.svg",
        popular: true,
    },
    {
        id: "slack",
        name: "Slack",
        description: "Team communication & messaging",
        logoSrc: "/logos/slack.svg",
        popular: true,
    },
    {
        id: "notion",
        name: "Notion",
        description: "Notes, docs & project management",
        logoSrc: "/logos/notion.svg",
        popular: false,
    },
];

export function ToolsConnectionStep({
    userEmail,
    connectedTools,
    onToolConnect,
    onContinue,
    onBack,
}: ToolsConnectionStepProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    const getInitials = (email: string) => {
        const name = email.split('@')[0];
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div
            className={`max-w-6xl mx-auto transition-all duration-700 relative ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
        >
            {/* Back Button */}
            {onBack && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="absolute top-0 right-0 text-muted-foreground hover:text-foreground pr-0 hover:bg-transparent"
                >
                    Back to Dashboard
                    <ChevronLeft className="w-4 h-4 ml-1 rotate-180" />
                </Button>
            )}

            {/* User Email Header */}
            <div className="flex items-center justify-center gap-2 mb-8">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-blue-50/60 text-sm font-semibold text-blue-700">
                    {getInitials(userEmail)}
                </div>
                <span className="text-sm text-muted-foreground">{userEmail}</span>
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
            </div>

            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                    Connect Your Tools
                </h1>
                <p className="text-muted-foreground text-lg">
                    Select at least one tool to create tasks from emails
                </p>
            </div>

            {/* Tool Cards - Single Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {tools.map((tool, index) => {
                    const isConnected = connectedTools.includes(tool.id);
                    const isComingSoon = tool.id === "asana";

                    return (
                        <div
                            key={tool.id}
                            className={`relative rounded-2xl border-2 border-slate-200 bg-white/95 p-6 transition-all duration-300 hover:border-blue-200 hover:bg-blue-50/20 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                                }`}
                            style={{
                                transitionDelay: `${index * 100 + 200}ms`,
                            }}
                        >
                            {/* Popular Badge */}
                            {tool.popular && !isComingSoon && (
                                <div className="absolute top-4 right-4">
                                    <div className="flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/35 px-2 py-1 text-xs font-medium text-blue-700">
                                        <span>⭐</span>
                                        <span>Popular</span>
                                    </div>
                                </div>
                            )}

                            {/* Coming Soon Badge */}
                            {isComingSoon && (
                                <div className="absolute top-4 right-4">
                                    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
                                        <span>🚀</span>
                                        <span>Coming Soon</span>
                                    </div>
                                </div>
                            )}

                            {/* Tool Icon */}
                            <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-3xl">
                                {(tool as any).logoSrc ? (
                                    <div className="relative w-full h-full">
                                        <NextImage
                                            src={(tool as any).logoSrc}
                                            alt={tool.name}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                ) : (
                                    (tool as any).icon
                                )}
                            </div>

                            {/* Tool Name */}
                            <h3 className="mb-2 text-xl font-semibold text-slate-900">
                                {tool.name}
                            </h3>

                            {/* Tool Description */}
                            <p className="mb-4 text-sm text-slate-600">
                                {tool.description}
                            </p>

                            {/* Connection Status or Button */}
                            {isConnected ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-green-500">
                                        <CheckCircleIcon className="w-4 h-4" />
                                        <span>Connected to</span>
                                    </div>
                                    {tool.id === "jira" && (
                                        <p className="text-xs text-muted-foreground">vimalsrinivasan1</p>
                                    )}
                                </div>
                            ) : (
                                <Button
                                    onClick={() => {
                                        if (isComingSoon) {
                                            toast.info(`${tool.name} integration will be available soon!`);
                                        } else {
                                            onToolConnect(tool.id);
                                        }
                                    }}
                                    variant={isComingSoon ? "ghost" : "outline"}
                                    className={`w-full ${isComingSoon ? "text-muted-foreground cursor-not-allowed" : ""}`}
                                    size="sm"
                                >
                                    {isComingSoon ? "Coming Soon" : "Click to connect"}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Continue Button and Counter */}
            <div className="text-center space-y-3">
                <Button
                    onClick={onContinue}
                    disabled={connectedTools.length === 0}
                    className="px-8"
                    size="lg"
                >
                    Continue to Knowledge Base →
                </Button>
                <p className="text-sm text-muted-foreground">
                    {connectedTools.length} tool{connectedTools.length !== 1 ? 's' : ''} connected
                </p>
            </div>
        </div>
    );
}
