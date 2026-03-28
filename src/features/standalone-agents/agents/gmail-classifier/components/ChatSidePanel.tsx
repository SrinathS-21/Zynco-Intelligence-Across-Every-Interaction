"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
    X,
    Send,
    Sparkles,
    Loader2,
    Mail,
    Search,
    ArrowRight,
    Settings2,
    Zap,
    CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    emails?: any[];
    suggestions?: string[];
    action?: any;
    timestamp: Date;
    isExpanded?: boolean; // Track if email list is expanded
}

interface ActiveContext {
    id: string;
    subject: string;
    content: string;
    from: string;
}

interface ChatSidePanelProps {
    agentId: string;
    isOpen: boolean;
    onClose: () => void;
    onEmailSelect?: (emailId: string, email?: any) => void;
    onNavigate?: (target: string) => void;
    onPreferenceUpdate?: (type: string, content: string) => void;
    isGmailConnected?: boolean;
    isSlackConnected?: boolean;
    isJiraConnected?: boolean;
    activeContext?: ActiveContext | null;
    onContextChange?: (context: ActiveContext | null) => void;
    onDataRefresh?: () => void;
}

export function ChatSidePanel({
    agentId,
    isOpen,
    onClose,
    onEmailSelect,
    onNavigate,
    onPreferenceUpdate,
    onContextChange,
    isGmailConnected = false,
    isSlackConnected = false,
    isJiraConnected = false,
    activeContext,
    onDataRefresh,
}: ChatSidePanelProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Hi! I'm your email assistant. I can help you:\n\n• Find specific emails\n• Summarize your inbox\n• Create automation rules\n• Answer questions about your emails",
            suggestions: [
                "What needs my attention?",
                "Show unread emails",
                "Summarize my inbox",
            ],
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [shouldRender, setShouldRender] = useState(isOpen);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle open/close with animation
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsClosing(false);
        } else if (shouldRender) {
            setIsClosing(true);
            // Fallback timer: Force close after animation duration (300ms) if onAnimationEnd doesn't fire
            const timer = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
            }, 350); // Slightly longer than animation duration to ensure it completes
            return () => clearTimeout(timer);
        }
    }, [isOpen, shouldRender]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: text,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/standalone-agents/gmail-classifier/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // Required for production auth
                body: JSON.stringify({
                    agentId,
                    message: text,
                    context: activeContext ? {
                        type: 'email',
                        subject: activeContext.subject,
                        content: activeContext.content,
                        from: activeContext.from
                    } : { agentId },
                }),
            });

            const raw = await response.text();
            let data: any = {};
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch {
                throw new Error(`Chat API returned invalid JSON (status ${response.status})`);
            }

            if (!response.ok) {
                throw new Error(data?.error || `Chat request failed (${response.status})`);
            }

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.reply || "I couldn't process that request.",
                emails: data.emails,
                suggestions: data.suggestions,
                action: data.actionRequest,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Execute client-side actions if present
            if (data.actionRequest) {
                const { action, params } = data.actionRequest;

                if (action === 'NAVIGATE' && params.target) {
                    onNavigate?.(params.target);
                } else if (action === 'UPDATE_PREFERENCE') {
                    onPreferenceUpdate?.(params.type, params.content);
                }
            }

            // Sync UI if a server-side action was executed successfully
            if (data.actionExecuted?.success) {
                onDataRefresh?.();
            }

        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: "Something went wrong. Please try again.",
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        sendMessage(suggestion);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    if (!shouldRender) return null;

    return (
        <div
            className={cn(
                "w-[400px] h-full border-l dark:border-zinc-800/60 border-border dark:bg-gradient-to-b dark:from-black dark:via-zinc-950 dark:to-black bg-background flex flex-col shrink-0 shadow-xl",
                isClosing
                    ? "animate-out slide-out-to-right duration-300"
                    : "animate-in slide-in-from-right duration-300"
            )}
            onAnimationEnd={() => {
                if (isClosing) {
                    setShouldRender(false);
                    setIsClosing(false);
                }
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Email Assistant</h3>
                        <p className="text-xs text-muted-foreground">Powered by AI</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Settings"
                    >
                        <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onClose}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Context Banner */}
            {activeContext && (
                <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-start gap-2 min-w-0">
                        <div className="mt-0.5 w-1 h-8 bg-blue-500 rounded-full shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider mb-0.5">
                                Current Context
                            </p>
                            <p className="text-xs font-medium truncate text-foreground pr-2">
                                {activeContext.subject}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => {
                            if (onContextChange) {
                                onContextChange(null);
                            }
                        }}
                        title="Clear context"
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            )}


            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => sendMessage("What needs my attention?")}
                >
                    <Zap className="w-3 h-3" />
                    Action Items
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => sendMessage("Summarize my inbox")}
                >
                    Summary
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => sendMessage("Show unread emails")}
                >
                    Unread
                </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex gap-3",
                            message.role === "user" && "flex-row-reverse"
                        )}
                    >
                        {message.role === "assistant" && (
                            <Avatar className="w-7 h-7 shrink-0">
                                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs">
                                    <Sparkles className="w-3.5 h-3.5" />
                                </AvatarFallback>
                            </Avatar>
                        )}
                        <div
                            className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-2.5",
                                message.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "dark:bg-gradient-to-br dark:from-zinc-900 dark:to-neutral-900 dark:border dark:border-zinc-700/40 bg-muted/70 rounded-bl-md"
                            )}
                        >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

                            {/* Email Results - Compact Tags */}
                            {message.emails && message.emails.length > 0 && (() => {
                                const INITIAL_SHOW = 3;
                                const showAll = message.isExpanded;
                                const emailsToShow = showAll ? message.emails : message.emails.slice(0, INITIAL_SHOW);
                                const remainingCount = message.emails.length - INITIAL_SHOW;

                                return (
                                    <div className="mt-3 space-y-1.5">
                                        {emailsToShow.map((email: any) => (
                                            <button
                                                key={email.id}
                                                onClick={() => onEmailSelect?.(email.id, email)}
                                                className="w-full text-left p-2 dark:bg-gradient-to-r dark:from-zinc-900 dark:to-neutral-900 dark:border-zinc-700/40 bg-background/80 rounded-lg hover:bg-primary/5 dark:hover:from-zinc-800 dark:hover:to-neutral-800 transition-all border border-border/50 group hover:border-primary/30"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                        email.priority === "critical" || email.priority === "high"
                                                            ? "bg-red-500"
                                                            : email.isRead ? "bg-gray-300" : "bg-blue-500"
                                                    )} />
                                                    <span className="text-xs font-medium truncate flex-1 group-hover:text-primary transition-colors">
                                                        {email.subject}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[9px] px-1.5 py-0.5 rounded-full shrink-0",
                                                        email.category === "requires_action" ? "bg-red-500/10 text-red-600" :
                                                            email.category === "important" ? "bg-orange-500/10 text-orange-600" :
                                                                email.category === "promotional" ? "bg-green-500/10 text-green-600" :
                                                                    "bg-gray-500/10 text-gray-600"
                                                    )}>
                                                        {email.category?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate pl-3.5">
                                                    {email.from?.replace(/<.*>/, '').trim()}
                                                </p>
                                            </button>
                                        ))}
                                        {remainingCount > 0 && !showAll && (
                                            <button
                                                onClick={() => {
                                                    setMessages(prev => prev.map(m =>
                                                        m.id === message.id ? { ...m, isExpanded: true } : m
                                                    ));
                                                }}
                                                className="w-full text-center py-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                                            >
                                                +{remainingCount} more emails →
                                            </button>
                                        )}
                                        {showAll && message.emails.length > INITIAL_SHOW && (
                                            <button
                                                onClick={() => {
                                                    setMessages(prev => prev.map(m =>
                                                        m.id === message.id ? { ...m, isExpanded: false } : m
                                                    ));
                                                }}
                                                className="w-full text-center py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Show less
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Suggestions */}
                            {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {message.suggestions.map((suggestion, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="text-[11px] px-2.5 py-1 bg-background hover:bg-primary/10 border border-border rounded-full transition-colors flex items-center gap-1 hover:border-primary/30"
                                        >
                                            {suggestion}
                                            <ArrowRight className="w-2.5 h-2.5" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <Avatar className="w-7 h-7 shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs">
                                <Sparkles className="w-3.5 h-3.5" />
                            </AvatarFallback>
                        </Avatar>
                        <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-background">
                <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask about your emails..."
                            className="pr-4 h-10 bg-muted/50 border-border/50 focus:border-primary/50"
                            disabled={isLoading}
                        />
                    </div>
                    <Button
                        size="icon"
                        className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90"
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || isLoading}
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                    AI may make mistakes. Verify important information.
                </p>
            </div>
        </div>
    );
}

export default ChatSidePanel;
