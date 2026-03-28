"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LabelSuggestion } from "@/lib/label-learning/types";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface LabelSuggestionsPanelProps {
    agentId: string;
    onLabelCreated?: () => void;
}

export function LabelSuggestionsPanel({ agentId, onLabelCreated }: LabelSuggestionsPanelProps) {
    const [suggestions, setSuggestions] = useState<LabelSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState<string | null>(null);
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const createLabelMutation = useMutation(trpc.standaloneAgents.createLabel.mutationOptions());
    const suggestLabelsMutation = useMutation(trpc.standaloneAgents.suggestLabels.mutationOptions());

    const getSuggestions = async () => {
        setIsLoading(true);
        try {
            const data = await suggestLabelsMutation.mutateAsync({
                id: agentId,
            });

            setSuggestions((data as any).suggestions || []);

            if ((data as any).suggestions.length === 0) {
                toast.error("Not enough emails to generate suggestions yet");
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const createLabelFromSuggestion = async (suggestion: LabelSuggestion) => {
        setIsCreating(suggestion.name);
        try {
            await createLabelMutation.mutateAsync({
                id: agentId,
                name: suggestion.name,
                color: "#3B82F6",
                userContext: suggestion.description,
                emailIds: suggestion.sampleEmails.map(e => e.id),
            });

            // Remove from suggestions
            setSuggestions(suggestions.filter(s => s.name !== suggestion.name));

            toast.success(`"${suggestion.name}" is ready to use`);

            onLabelCreated?.();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsCreating(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="text-lg font-semibold">AI Label Suggestions</h3>
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={getSuggestions}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4 mr-1" />
                            Get Suggestions
                        </>
                    )}
                </Button>
            </div>

            {suggestions.length === 0 && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click "Get Suggestions" to analyze your emails</p>
                    <p className="text-xs mt-1">AI will suggest useful labels based on patterns</p>
                </div>
            )}

            <div className="space-y-3">
                {suggestions.map((suggestion) => (
                    <Card key={suggestion.name} className="hover:border-purple-500/50 transition-colors">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        {suggestion.name}
                                        <Badge variant="secondary" className="text-xs">
                                            {suggestion.estimatedCount} emails
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="text-sm mt-1">
                                        {suggestion.description}
                                    </CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => createLabelFromSuggestion(suggestion)}
                                    disabled={isCreating === suggestion.name}
                                >
                                    {isCreating === suggestion.name ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-1" />
                                            Create
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Sample emails:</p>
                                {suggestion.sampleEmails.slice(0, 2).map((email, idx) => (
                                    <div
                                        key={idx}
                                        className="text-xs p-2 bg-muted/50 rounded border"
                                    >
                                        <div className="font-medium truncate">{email.subject}</div>
                                        <div className="text-muted-foreground truncate">{email.from}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
