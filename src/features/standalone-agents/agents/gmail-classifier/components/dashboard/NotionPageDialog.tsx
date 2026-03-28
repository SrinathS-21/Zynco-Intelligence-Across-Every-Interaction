
"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Search, FileIcon, DatabaseIcon, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface NotionPageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agentId: string;
    initialTitle: string;
    initialContent: string;
}

interface NotionResource {
    id: string;
    title: string;
    type: "database" | "page";
    icon?: string;
}

export function NotionPageDialog({
    open,
    onOpenChange,
    agentId,
    initialTitle,
    initialContent,
}: NotionPageDialogProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [title, setTitle] = useState(initialTitle);
    const [content, setContent] = useState(initialContent);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const searchMutation = useMutation(trpc.standaloneAgents.searchNotion.mutationOptions());
    const createPageMutation = useMutation(trpc.standaloneAgents.createNotionPage.mutationOptions());

    // Parent Search State
    const [openCombobox, setOpenCombobox] = useState(false);
    const [selectedParent, setSelectedParent] = useState<NotionResource | null>(null);
    const [searchResults, setSearchResults] = useState<NotionResource[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Reset state when dialog opens with new data
    useEffect(() => {
        if (open) {
            // Reset form state with new email data
            setTitle(initialTitle || '');
            setContent(initialContent || '');
            setIsSubmitting(false);
            setOpenCombobox(false);
            setSearchResults([]);
            // selectedParent will be set by fetchAndSelectDefaultDatabase
        }
    }, [open, initialTitle, initialContent]);

    // Fetch and auto-select default database when dialog opens
    useEffect(() => {
        if (open) {
            fetchAndSelectDefaultDatabase();
        }
    }, [open]);

    // Initial search when combobox opens
    useEffect(() => {
        if (openCombobox && searchResults.length === 0) {
            handleSearch("");
        }
    }, [openCombobox]);

    const fetchAndSelectDefaultDatabase = async () => {
        try {
            // Fetch agent config to get selected database
            const agentData = await queryClient.fetchQuery(
                trpc.standaloneAgents.get.queryOptions({ id: agentId })
            );

            if (agentData) {
                const selectedDatabaseId = (agentData.config as any)?.notion?.selectedDatabaseId;
                const databases = (agentData.config as any)?.notion?.databases || [];

                if (selectedDatabaseId && databases.length > 0) {
                    const defaultDb = databases.find((db: any) => db.id === selectedDatabaseId);
                    if (defaultDb) {
                        setSelectedParent({
                            id: defaultDb.id,
                            title: defaultDb.title,
                            type: "database",
                            icon: defaultDb.icon,
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch default database:", error);
        }
    };

    const handleSearch = async (query: string) => {
        setIsSearching(true);
        try {
            const results = await searchMutation.mutateAsync({
                id: agentId,
                query,
            });
            if (results) {
                setSearchResults(results as any);
            }
        } catch (error) {
            console.error("Failed to search notion:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleCreate = async () => {
        if (!selectedParent) {
            toast.error("Please select a parent page or database");
            return;
        }
        if (!title) {
            toast.error("Please enter a page title");
            return;
        }

        setIsSubmitting(true);
        try {
            const data = await createPageMutation.mutateAsync({
                id: agentId,
                title,
                content,
                parentId: selectedParent.id,
                parentType: selectedParent.type,
            });

            if (data.success) {
                toast.success("Notion page created successfully!");
                onOpenChange(false);
            }
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create Notion Page</DialogTitle>
                    <DialogDescription>
                        Create a new page in your connected Notion workspace.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="parent">Location (Parent)</Label>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between"
                                >
                                    {selectedParent ? (
                                        <div className="flex items-center gap-2 truncate">
                                            {selectedParent.type === 'database' ? <DatabaseIcon className="w-4 h-4 text-blue-500" /> : <FileIcon className="w-4 h-4 text-gray-500" />}
                                            {selectedParent.title}
                                        </div>
                                    ) : (
                                        "Select parent page or database..."
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[450px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <CommandInput
                                        placeholder="Search Notion..."
                                        onValueChange={(val) => {
                                            // Debounce manually or simple implementation
                                            handleSearch(val);
                                        }}
                                    />
                                    <CommandList>
                                        {isSearching ? (
                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                                                Searching...
                                            </div>
                                        ) : (
                                            <>
                                                <CommandEmpty>
                                                    <div className="p-4 text-center">
                                                        <p className="text-sm font-medium">No results found.</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Tip: Make sure you have shared pages/databases with the "Email Classifier" integration in Notion.
                                                        </p>
                                                    </div>
                                                </CommandEmpty>
                                                <CommandGroup heading="Results">
                                                    {searchResults.map((item) => (
                                                        <CommandItem
                                                            key={item.id}
                                                            value={item.id} // value matches id
                                                            onSelect={() => {
                                                                setSelectedParent(item);
                                                                setOpenCombobox(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedParent?.id === item.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {item.type === 'database' ? <DatabaseIcon className="mr-2 h-4 w-4 text-blue-500" /> : <FileIcon className="mr-2 h-4 w-4 text-gray-500" />}
                                                            <span className="truncate">{item.title}</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </>
                                        )}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="title">Page Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Page title"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="content">Content</Label>
                        <Textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Page content..."
                            className="h-32"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Page
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
