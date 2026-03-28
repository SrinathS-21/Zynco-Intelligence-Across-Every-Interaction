"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, Save, Info, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface FocusPreferencesProps {
    agentId: string;
    onPersonalized?: () => void;
}

export function FocusPreferences({ agentId, onPersonalized }: FocusPreferencesProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [preferences, setPreferences] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    const updatePreferencesMutation = useMutation(trpc.standaloneAgents.updateFocusPreferences.mutationOptions());

    useEffect(() => {
        fetchPreferences();
    }, [agentId]);

    const fetchPreferences = async () => {
        if (!agentId) return;
        setIsLoading(true);
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getFocusPreferences.queryOptions({ id: agentId })
            );
            if (data) {
                setPreferences(data.preferences || "");
                if (data.updatedAt) setLastSaved(new Date(data.updatedAt).toLocaleTimeString());
            }
        } catch (error) {
            console.error("Failed to load focus preferences:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!agentId) return;
        setIsSaving(true);
        try {
            await updatePreferencesMutation.mutateAsync({
                id: agentId,
                preferences,
            });

            toast.success("Focus Brain personalized!");
            setLastSaved(new Date().toLocaleTimeString());
            onPersonalized?.();
        } catch (error: any) {
            toast.error(error.message || "Failed to save preferences");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-2 opacity-50" />
                <p className="text-sm">Loading Focus Brain...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2 px-1">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-primary" />
                        Personalized Focus Engine
                    </h3>
                    {lastSaved && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            Synced at {lastSaved}
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Describe which emails are most important to you in plain English. The AI will learn your priorities and filter your **Unread** Focus section accordingly.
                </p>
            </div>

            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>
                <div className="relative bg-card border border-border rounded-xl overflow-hidden">
                    <Textarea
                        placeholder="e.g. 'I am currently working on a property deal in London, please prioritize any emails with 'London' or 'Agreement' in the subject. Also, follow up on emails from 'lawyer@firm.com' quickly. Ignore marketing emails and Jira updates unless they mention P0...'"
                        value={preferences}
                        onChange={(e) => setPreferences(e.target.value)}
                        className="min-h-[180px] border-none focus-visible:ring-0 text-sm leading-relaxed p-4 bg-transparent resize-none"
                    />

                    <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Info className="w-3.5 h-3.5" />
                            <span>AI extracted rules will be applied to every sync</span>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            size="sm"
                            className="h-8 rounded-lg gap-2 shadow-sm font-bold"
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                            )}
                            Save & Personalize
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">PRO TIP</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Mention specific **project names**, **clients**, or **domains** to get the best results.
                    </p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] border border-primary/10">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">HOW IT WORKS</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        We extract keywords from your text so we don't need to call the AI for every single email.
                    </p>
                </div>
            </div>
        </div>
    );
}
