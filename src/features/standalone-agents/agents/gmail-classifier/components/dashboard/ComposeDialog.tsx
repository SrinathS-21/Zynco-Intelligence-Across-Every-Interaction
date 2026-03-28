"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, Loader2, X, Minimize2, Maximize2, Paperclip, Sparkles, Trash2 } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";

export interface ComposeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agentId: string;

    // Pre-fill data (for replies/forwards)
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
}

export function ComposeDialog({
    open,
    onOpenChange,
    agentId,
    to: initialTo = "",
    cc: initialCc = "",
    bcc: initialBcc = "",
    subject: initialSubject = "",
    body: initialBody = "",
    threadId,
    inReplyTo,
    references,
}: ComposeDialogProps) {
    // Form state
    const [to, setTo] = useState(initialTo);
    const [cc, setCc] = useState(initialCc);
    const [bcc, setBcc] = useState(initialBcc);
    const [subject, setSubject] = useState(initialSubject);
    const [body, setBody] = useState(initialBody);
    const [currentThreadId, setCurrentThreadId] = useState(threadId);

    // Sync state with props when they change (critical for switching between replies)
    useEffect(() => {
        if (initialTo) setTo(initialTo);
    }, [initialTo]);

    useEffect(() => {
        if (initialSubject) setSubject(initialSubject);
    }, [initialSubject]);

    useEffect(() => {
        if (initialBody) setBody(initialBody);
    }, [initialBody]);

    useEffect(() => {
        setCurrentThreadId(threadId);
    }, [threadId]);

    // UI state
    const [showCc, setShowCc] = useState(!!initialCc);
    const [showBcc, setShowBcc] = useState(!!initialBcc);
    const [isSending, setIsSending] = useState(false);
    const [isDrafting, setIsDrafting] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const handleSend = async () => {
        // Validation
        if (!to.trim()) {
            toast.error("Recipient required", {
                description: "Please enter at least one recipient",
            });
            return;
        }

        if (!subject.trim()) {
            toast.error("Subject required", {
                description: "Please enter a subject",
            });
            return;
        }

        if (!body.trim()) {
            toast.error("Message required", {
                description: "Please enter a message",
            });
            return;
        }

        setIsSending(true);

        try {
            const response = await fetch(`/api/standalone-agents/gmail-classifier/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId,
                    to,
                    cc: cc || undefined,
                    bcc: bcc || undefined,
                    subject,
                    body,
                    threadId,
                    inReplyTo,
                    references,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send email');
            }

            const result = await response.json();

            toast.success("Email sent!");
            onOpenChange(false);
            resetForm();
        } catch (error: any) {
            console.error('Failed to send email:', error);
            toast.error("Failed to send email", {
                description: error.message || "An error occurred while sending your email",
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleAiDraft = async () => {
        if (!currentThreadId && !inReplyTo) {
            toast.info("No context", {
                description: "AI Draft works best when replying to an existing email.",
            });
            return;
        }

        setIsDrafting(true);
        try {
            const response = await fetch(`/api/standalone-agents/gmail-classifier/generate-reply-draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId,
                    emailId: inReplyTo || threadId,
                    intent: 'default',
                }),
            });

            if (!response.ok) throw new Error('Failed to generate draft');
            const data = await response.json();

            if (data.draft) {
                // Prepend draft to content, keeping the quoted text below
                const newBody = `${data.draft}\n\n${body}`;
                setBody(newBody);
                toast.success("AI Draft generated!");
            }
        } catch (error: any) {
            console.error('Failed to generate AI draft:', error);
            toast.error("Generation failed", {
                description: "Couldn't generate AI reply at this time.",
            });
        } finally {
            setIsDrafting(false);
        }
    };

    const [showDiscardAlert, setShowDiscardAlert] = useState(false);

    const handleDiscard = () => {
        if (to || cc || bcc || subject || body) {
            setShowDiscardAlert(true);
        } else {
            onOpenChange(false);
            resetForm();
        }
    };

    const confirmDiscard = () => {
        onOpenChange(false);
        resetForm();
        setShowDiscardAlert(false);
    };

    const resetForm = () => {
        setTo("");
        setCc("");
        setBcc("");
        setSubject("");
        setBody("");
        setShowCc(false);
        setShowBcc(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[600px] flex flex-col p-0">
                {/* Header */}
                <DialogHeader className="px-6 py-5 border-b bg-muted/5 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <DialogTitle className="text-lg font-bold">
                                {inReplyTo ? "Reply Message" : "New Message"}
                            </DialogTitle>
                            {subject && inReplyTo && (
                                <p className="text-[11px] text-muted-foreground truncate max-w-[400px]">
                                    Replying to: {subject.replace(/^Re:\s*/i, '')}
                                </p>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDiscard}
                            className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                            <X className="w-4.5 h-4.5" />
                        </Button>
                    </div>
                </DialogHeader>

                {!isMinimized && (
                    <>
                        {/* Form Fields */}
                        <div className="px-6 py-4 space-y-3 border-b flex-shrink-0">
                            {/* To */}
                            <div className="flex items-center gap-3">
                                <Label className="w-12 text-sm text-muted-foreground">To</Label>
                                <div className="flex-1 flex items-center gap-2">
                                    <Input
                                        value={to}
                                        onChange={(e) => setTo(e.target.value)}
                                        placeholder="recipient@example.com"
                                        className="flex-1"
                                    />
                                    {!showCc && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowCc(true)}
                                            className="text-xs"
                                        >
                                            Cc
                                        </Button>
                                    )}
                                    {!showBcc && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowBcc(true)}
                                            className="text-xs"
                                        >
                                            Bcc
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Cc */}
                            {showCc && (
                                <div className="flex items-center gap-3">
                                    <Label className="w-12 text-sm text-muted-foreground">Cc</Label>
                                    <Input
                                        value={cc}
                                        onChange={(e) => setCc(e.target.value)}
                                        placeholder="cc@example.com"
                                        className="flex-1"
                                    />
                                </div>
                            )}

                            {/* Bcc */}
                            {showBcc && (
                                <div className="flex items-center gap-3">
                                    <Label className="w-12 text-sm text-muted-foreground">Bcc</Label>
                                    <Input
                                        value={bcc}
                                        onChange={(e) => setBcc(e.target.value)}
                                        placeholder="bcc@example.com"
                                        className="flex-1"
                                    />
                                </div>
                            )}

                            {/* Subject */}
                            <div className="flex items-center gap-3">
                                <Label className="w-12 text-sm text-muted-foreground">Subject</Label>
                                <Input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Subject"
                                    className="flex-1"
                                />
                            </div>
                        </div>

                        {/* Rich Text Editor */}
                        <div className="flex-1 overflow-hidden">
                            <RichTextEditor
                                content={body}
                                onChange={setBody}
                                placeholder="Write your message..."
                            />
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-5 border-t bg-muted/5 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={handleSend}
                                    disabled={isSending || isDrafting}
                                    className="h-10 px-8 rounded-full shadow-md transition-all active:scale-95"
                                >
                                    {isSending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Send
                                        </>
                                    )}
                                </Button>

                                {(inReplyTo || threadId) && (
                                    <div className="flex items-center p-1 rounded-full bg-primary/5 border border-primary/10">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleAiDraft}
                                            disabled={isDrafting || isSending}
                                            className="h-8 rounded-full text-[11px] font-bold gap-2 text-primary hover:bg-primary/10"
                                        >
                                            {isDrafting ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-3.5 h-3.5" />
                                            )}
                                            {isDrafting ? "Refining..." : "Refine with AI"}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDiscard}
                                disabled={isSending}
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-medium px-4 h-8 rounded-full"
                            >
                                Discard
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>

            <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete your current draft. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDiscard}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
