"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    MessageCircle,
    X,
    Send,
    Sparkles,
    Loader2,
    Mail,
    Search,
    ArrowRight,
} from "lucide-react";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    emails?: any[];
    suggestions?: string[];
    timestamp: Date;
}

interface EmailAgentChatProps {
    agentId: string;
    onEmailSelect?: (emailId: string) => void;
}

export function EmailAgentChat({ agentId, onEmailSelect }: EmailAgentChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Hi! I'm your email assistant. Ask me to find emails, summarize your inbox, or take actions like archiving.",
            suggestions: [
                "What needs my attention?",
                "Show unread emails",
                "Emails from Google",
            ],
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
                body: JSON.stringify({
                    message: text,
                    agentId,
                    context: { agentId },
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
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);

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

    return (
        <>
            {/* Floating Chat Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center z-50 group"
                >
                    <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-pulse" />
                </button>
            )}

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/15 rounded-full flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Email Assistant</h3>
                                <p className="text-xs text-muted-foreground">Powered by AI</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="w-4 h-4" />
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
                                        <AvatarFallback className="bg-primary/15 text-primary text-xs">
                                            <Sparkles className="w-3.5 h-3.5" />
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-2xl px-4 py-2.5",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-br-md"
                                            : "bg-muted rounded-bl-md"
                                    )}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                    {/* Email Results */}
                                    {message.emails && message.emails.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {message.emails.slice(0, 3).map((email: any) => (
                                                <button
                                                    key={email.id}
                                                    onClick={() => onEmailSelect?.(email.id)}
                                                    className="w-full text-left p-2 bg-background/50 rounded-lg hover:bg-background transition-colors border border-border/50"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                        <span className="text-xs font-medium truncate">
                                                            {email.subject}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                                        {email.from}
                                                    </p>
                                                </button>
                                            ))}
                                            {message.emails.length > 3 && (
                                                <p className="text-xs text-muted-foreground text-center">
                                                    +{message.emails.length - 3} more
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Suggestions */}
                                    {message.role === "assistant" && message.suggestions && (
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {message.suggestions.map((suggestion, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                    className="text-[11px] px-2.5 py-1 bg-background hover:bg-primary/10 border border-border rounded-full transition-colors flex items-center gap-1"
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
                                    <AvatarFallback className="bg-primary/15 text-primary text-xs">
                                        <Sparkles className="w-3.5 h-3.5" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-border bg-background/50">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Ask about your emails..."
                                    className="pl-9 pr-4 h-10 bg-muted/50 border-0"
                                    disabled={isLoading}
                                />
                            </div>
                            <Button
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || isLoading}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default EmailAgentChat;
