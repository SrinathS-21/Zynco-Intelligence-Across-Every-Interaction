"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Brain, Loader2, FileText, Tag, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface KnowledgeEntry {
    id: string;
    content: string;
    title: string | null;
    tags: string[];
    createdAt: string;
    type: string;
}

interface KnowledgeBaseSettingsProps {
    onRefresh?: (refreshFn: () => void) => void;
}

export function KnowledgeBaseSettings({ onRefresh }: KnowledgeBaseSettingsProps) {
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // New entry state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newContent, setNewContent] = useState("");
    const [newTitle, setNewTitle] = useState("");
    const [newTags, setNewTags] = useState("");

    useEffect(() => {
        fetchEntries();
        if (onRefresh) {
            onRefresh(fetchEntries);
        }
    }, [onRefresh]);

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/user/knowledge-base");
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries || []);
            }
        } catch (error) {
            toast.error("Failed to load knowledge base");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newContent.trim()) {
            toast.error("Content is required");
            return;
        }

        setIsCreating(true);
        try {
            const tagsArray = newTags.split(",").map(t => t.trim()).filter(Boolean);

            const res = await fetch("/api/user/knowledge-base", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newContent,
                    title: newTitle || undefined,
                    tags: tagsArray,
                    type: "text"
                }),
            });

            if (res.ok) {
                toast.success("Knowledge added to Brain");
                setNewContent("");
                setNewTitle("");
                setNewTags("");
                setShowAddForm(false);
                fetchEntries();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to add knowledge");
            }
        } catch (error) {
            toast.error("Error creating entry");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/user/knowledge-base/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setEntries(entries.filter(e => e.id !== id));
                toast.success("Knowledge removed");
            } else {
                toast.error("Failed to delete entry");
            }
        } catch (error) {
            toast.error("Error deleting entry");
        }
    };

    return (
        <div className="space-y-6 px-6 py-5">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Brain className="w-5 h-5 text-primary" />
                        Identify Knowledge Base
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Teach the agent about your preferences, business rules, and context.
                    </p>
                </div>
                {!showAddForm && (
                    <Button id="tutorial-knowledge-add" onClick={() => setShowAddForm(true)} size="sm" className="gap-2">
                        <Plus className="w-4 h-4" /> Add Knowledge
                    </Button>
                )}
            </div>

            {showAddForm && (
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Content</label>
                        <Textarea
                            placeholder="e.g. 'I do not accept guest posts.' or 'My hourly rate is $150.'"
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            className="bg-background min-h-[100px]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase">Title (Optional)</label>
                            <Input
                                placeholder="Short description"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="bg-background h-9"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase">Tags (Comma separated)</label>
                            <Input
                                placeholder="pricing, rules, personal"
                                value={newTags}
                                onChange={(e) => setNewTags(e.target.value)}
                                className="bg-background h-9"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleCreate} disabled={isCreating}>
                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Save to Brain
                        </Button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                        Loading memory...
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">
                        <Brain className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                        <h4 className="font-medium text-muted-foreground">Brain is empty</h4>
                        <p className="text-sm text-muted-foreground/70 max-w-xs mx-auto mt-1">
                            Add some knowledge to help the agent draft better replies and understand your context.
                        </p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddForm(true)}>
                            Start Teaching
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {entries.map((entry) => (
                            <div key={entry.id} className="group relative bg-muted/20 border border-border rounded-lg p-4 hover:bg-muted/40 transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5 text-primary/70" />
                                            {entry.title && (
                                                <span className="font-medium text-sm text-foreground">{entry.title}</span>
                                            )}
                                            <span className="text-xs text-muted-foreground/70">{new Date(entry.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                                            {entry.content}
                                        </p>

                                        {entry.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {entry.tags.map(tag => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 h-5 bg-background border-border text-muted-foreground">
                                                        <Tag className="w-3 h-3 mr-1 opacity-50" />
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(entry.id)}
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
