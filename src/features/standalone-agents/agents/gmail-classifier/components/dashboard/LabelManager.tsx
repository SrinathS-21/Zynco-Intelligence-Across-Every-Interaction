"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag, Trash2, Search, Check, Edit2, Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import { CustomLabel, CustomRule } from "@/lib/label-learning/types";
import { Separator } from "@/components/ui/separator";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface LabelManagerProps {
    agentId: string;
    userEmail?: string;
    emails?: any[]; // Add emails prop for counting
}

export function LabelManager({ agentId, userEmail, emails = [] }: LabelManagerProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [labels, setLabels] = useState<CustomLabel[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResults, setTestResults] = useState<any[]>([]);

    // Mutations
    const createLabelMutation = useMutation(trpc.standaloneAgents.createLabel.mutationOptions());
    const updateLabelMutation = useMutation(trpc.standaloneAgents.updateLabel.mutationOptions());
    const deleteLabelMutation = useMutation(trpc.standaloneAgents.deleteLabel.mutationOptions());

    // Edit mode
    const [editingLabel, setEditingLabel] = useState<CustomLabel | null>(null);

    // Form state - SIMPLIFIED
    const [newLabelName, setNewLabelName] = useState("");
    const [newLabelColor, setNewLabelColor] = useState("#3B82F6");
    const [description, setDescription] = useState("");

    useEffect(() => {
        if (agentId) {
            fetchLabels();
        }
    }, [agentId]);

    const fetchLabels = async () => {
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getLabels.queryOptions({ id: agentId })
            );
            setLabels((data as any)?.labels || []);
        } catch (error) {
            console.error("Failed to fetch labels:", error);
        }
    };

    const resetForm = () => {
        setNewLabelName("");
        setNewLabelColor("#3B82F6");
        setDescription("");
        setTestResults([]);
        setEditingLabel(null);
    };

    const openEditDialog = (label: CustomLabel) => {
        setEditingLabel(label);
        setNewLabelName(label.name);
        setNewLabelColor(label.color);
        setDescription(label.userContext || "");
        setTestResults([]);
        setIsOpen(true);
    };

    const testLabel = async (labelToTest?: CustomLabel) => {
        const testDescription = labelToTest?.userContext || description;

        if (!testDescription.trim()) {
            toast.error("Please describe what emails should get this label");
            return;
        }

        setIsTesting(true);
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.testLabel.queryOptions({
                    id: agentId,
                    description: testDescription,
                    userEmail,
                })
            );

            setTestResults(data.matches || []);

            if (data.matches.length === 0) {
                toast.info("No matching emails found. Try a different description.");
            } else {
                toast.success(`Found ${data.matches.length} matching email${data.matches.length > 1 ? 's' : ''}!`);
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsTesting(false);
        }
    };

    const createOrUpdateLabel = async () => {
        if (!newLabelName.trim()) {
            toast.error("Please enter a label name");
            return;
        }

        if (!description.trim()) {
            toast.error("Please describe what emails should get this label");
            return;
        }

        if (!agentId) {
            toast.error("Agent ID required. Please refresh the page.");
            return;
        }

        setIsLoading(true);
        try {
            if (editingLabel) {
                // UPDATE existing label
                const data = await updateLabelMutation.mutateAsync({
                    id: agentId,
                    labelId: editingLabel.id,
                    updates: {
                        name: newLabelName,
                        color: newLabelColor,
                        userContext: description,
                    }
                });

                if (data.success) {
                    setLabels(labels.map(l => l.id === editingLabel.id ? data.label : l));
                    toast.success(`"${data.label.name}" updated!`);
                }
            } else {
                // CREATE new label
                // SMART PATTERN EXTRACTION - Same logic as test API
                const customRules: CustomRule[] = [];
                const lowerDesc = description.toLowerCase();

                // 1. Extract email addresses from description
                const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
                const extractedEmails = description.match(emailRegex) || [];

                // 2. Detect "from" patterns - emails FROM a specific address
                if (extractedEmails.length > 0) {
                    for (const email of extractedEmails) {
                        if (lowerDesc.includes(`from ${email.toLowerCase()}`) ||
                            lowerDesc.includes(`from email ${email.toLowerCase()}`)) {
                            customRules.push({
                                id: `rule_from_${Date.now()}_${email}`,
                                type: 'from_contains',
                                description: `From ${email}`,
                                value: email,
                                weight: 1.0,
                                enabled: true,
                                createdAt: new Date().toISOString(),
                            });
                        }
                    }
                }

                // 3. Detect "to myself" patterns
                if (lowerDesc.includes("to myself") || lowerDesc.includes("to me") || lowerDesc.includes("send to me")) {
                    customRules.push({
                        id: `rule_to_myself_${Date.now()}`,
                        type: 'sender_equals_recipient',
                        description: "Emails to myself",
                        weight: 1.0,
                        enabled: true,
                        createdAt: new Date().toISOString(),
                    });
                }

                // 4. Detect "I send" patterns
                if ((lowerDesc.includes("i send") || lowerDesc.includes("i sent") || lowerDesc.includes("from me")) &&
                    !lowerDesc.includes("to myself")) {
                    customRules.push({
                        id: `rule_from_me_${Date.now()}`,
                        type: 'sender_is_me',
                        description: "Emails I sent",
                        weight: 1.0,
                        enabled: true,
                        createdAt: new Date().toISOString(),
                    });
                }

                // 5. Detect domain patterns
                const domains = [...new Set(extractedEmails.map(e => e.split('@')[1]))];
                if (domains.length > 0 && (lowerDesc.includes("from") || lowerDesc.includes("company"))) {
                    for (const domain of domains) {
                        customRules.push({
                            id: `rule_domain_${Date.now()}_${domain}`,
                            type: 'domain_match',
                            description: `From @${domain}`,
                            value: domain,
                            weight: 0.9,
                            enabled: true,
                            createdAt: new Date().toISOString(),
                        });
                    }
                }

                const data = await createLabelMutation.mutateAsync({
                    id: agentId,
                    name: newLabelName,
                    color: newLabelColor,
                    userContext: description,
                    customRules: customRules.length > 0 ? customRules : undefined,
                    autoApply: true,
                    confidenceThreshold: 0.6,
                    useLLMFallback: true,
                });

                if (data.success) {
                    setLabels([...labels, data.label]);
                    toast.success(`"${data.label.name}" created! It will automatically label matching emails.`);
                }
            }

            resetForm();
            setIsOpen(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteLabel = async (labelId: string) => {
        try {
            await deleteLabelMutation.mutateAsync({
                id: agentId,
                labelId,
            });

            setLabels(labels.filter((l) => l.id !== labelId));
            toast.success("Label deleted");
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">My Labels</h3>
                </div>

                <Dialog open={isOpen} onOpenChange={(open) => {
                    setIsOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button id="tutorial-label-create" size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Create Label
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingLabel ? "Edit Label" : "Create a New Label"}</DialogTitle>
                            <DialogDescription>
                                {editingLabel
                                    ? "Update your label details and test how it matches emails."
                                    : "Name your label and describe what emails should get it. We'll handle the rest automatically."
                                }
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {/* Label Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">Label Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Personal, Work, Receipts"
                                    value={newLabelName}
                                    onChange={(e) => setNewLabelName(e.target.value)}
                                />
                            </div>

                            {/* Color */}
                            <div className="space-y-2">
                                <Label htmlFor="color">Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="color"
                                        type="color"
                                        value={newLabelColor}
                                        onChange={(e) => setNewLabelColor(e.target.value)}
                                        className="w-20 h-10"
                                    />
                                    <div
                                        className="flex-1 rounded-md border px-3 py-2 text-sm font-medium"
                                        style={{ backgroundColor: newLabelColor, color: "#fff" }}
                                    >
                                        {newLabelName || "Preview"}
                                    </div>
                                </div>
                            </div>

                            {/* Description - THE MAIN INPUT */}
                            <div className="space-y-2">
                                <Label htmlFor="description">What emails should get this label?</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe in plain English...

Examples:
• Emails I send to myself as reminders
• Receipts and invoices from online purchases
• Newsletters from tech companies
• Messages from my team about project updates"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    className="text-sm"
                                />
                            </div>

                            {/* Test Button */}
                            <div className="space-y-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => testLabel()}
                                    disabled={isTesting || !description.trim()}
                                    className="w-full"
                                >
                                    <Search className="w-4 h-4 mr-2" />
                                    {isTesting ? "Searching..." : "Preview Matching Emails"}
                                </Button>
                                <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-blue-900 dark:text-blue-100">
                                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium">How auto-labeling works:</p>
                                        <ul className="mt-1 space-y-0.5 text-blue-800 dark:text-blue-200">
                                            <li>• <strong>New emails</strong> matching this pattern will be auto-labeled</li>
                                            <li>• <strong>Existing emails</strong> shown in preview won't be labeled automatically</li>
                                            <li>• You can manually apply this label to any email</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Test Results */}
                            {testResults.length > 0 && (
                                <div className="space-y-3 border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-green-900 dark:text-green-100">
                                            <Check className="w-5 h-5 text-green-600" />
                                            Found {testResults.length} matching email{testResults.length > 1 ? 's' : ''}!
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                            Preview
                                        </Badge>
                                    </div>
                                    <Separator className="bg-green-200 dark:bg-green-800" />
                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                        {testResults.slice(0, 10).map((email, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-green-200 dark:border-green-800 hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-sm truncate text-foreground">
                                                            {email.subject || '(No subject)'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            From: {email.from}
                                                        </div>
                                                    </div>
                                                    {email.confidence && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs shrink-0"
                                                        >
                                                            {email.confidence}% match
                                                        </Badge>
                                                    )}
                                                </div>
                                                {email.snippet && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 pl-2 border-l-2 border-green-300 dark:border-green-700">
                                                        {email.snippet}
                                                    </p>
                                                )}
                                                {email.reasons && (
                                                    <div className="mt-2 flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                                                        <Sparkles className="w-3 h-3" />
                                                        <span>Matched: {email.reasons}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {testResults.length > 10 && (
                                            <div className="text-xs text-center py-2 text-muted-foreground bg-white dark:bg-gray-900 rounded border border-dashed">
                                                + {testResults.length - 10} more emails match this pattern
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={createOrUpdateLabel} disabled={isLoading}>
                                {isLoading ? (editingLabel ? "Updating..." : "Creating...") : (editingLabel ? "Update Label" : "Create Label")}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Labels List */}
            <div className="space-y-2">
                {labels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Tag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">No labels yet</p>
                        <p className="text-xs mt-1">Create your first label to get started</p>
                    </div>
                ) : (
                    labels.map((label, idx) => (
                        <div
                            key={label.id}
                            id={idx === 0 ? "tutorial-label-item-0" : undefined}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors group"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <Badge
                                        style={{
                                            backgroundColor: label.color,
                                            color: "#fff",
                                        }}
                                        className="font-medium"
                                    >
                                        {label.name}
                                    </Badge>
                                    <div className="text-xs text-muted-foreground">
                                        {emails.filter((e: any) => e.customLabels?.includes(label.id)).length} email{emails.filter((e: any) => e.customLabels?.includes(label.id)).length !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                {label.userContext && (
                                    <p className="text-xs text-muted-foreground truncate">
                                        {label.userContext}
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-1 ml-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => testLabel(label)}
                                    className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Preview matching emails"
                                >
                                    <Search className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(label)}
                                    className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Edit label"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteLabel(label.id)}
                                    className="text-muted-foreground hover:text-destructive"
                                    title="Delete label"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
