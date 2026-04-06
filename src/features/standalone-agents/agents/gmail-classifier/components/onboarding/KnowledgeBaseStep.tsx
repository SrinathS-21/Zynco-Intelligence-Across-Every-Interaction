"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookIcon, SkipForwardIcon, UploadCloudIcon, FileTextIcon, XIcon, CheckIcon, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeBaseStepProps {
    onContinue: (data: { files: File[]; content: string; skipped: boolean }) => void;
    onBack?: () => void;
}

export function KnowledgeBaseStep({ onContinue, onBack }: KnowledgeBaseStepProps) {
    const [mode, setMode] = useState<"upload" | "paste">("upload");
    const [files, setFiles] = useState<File[]>([]);
    const [content, setContent] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // Append new files to existing ones
            const newFiles = Array.from(e.target.files);
            setFiles((prev) => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleContinue = () => {
        if (files.length === 0 && !content.trim()) {
            toast.error("Please add some content or skip this step");
            return;
        }
        // In a real app, we'd upload files here
        onContinue({ files, content, skipped: false });
    };

    const handleSkip = () => {
        onContinue({ files: [], content: "", skipped: true });
    };

    return (
        <div className="max-w-3xl mx-auto text-center relative">

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

            {/* Header */}
            <div className="mb-8 pt-10">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <BookIcon className="w-8 h-8 text-blue-600" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Add Knowledge Base</h1>
                <p className="text-muted-foreground">
                    Upload documents or paste content to help AI understand your context
                </p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center gap-4 mb-8">
                <button
                    onClick={() => setMode("upload")}
                    className={`flex items-center gap-2 rounded-lg px-6 py-3 transition-all ${mode === "upload"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                >
                    <UploadCloudIcon className="w-4 h-4" />
                    Upload Files
                </button>
                <button
                    onClick={() => setMode("paste")}
                    className={`flex items-center gap-2 rounded-lg px-6 py-3 transition-all ${mode === "paste"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                >
                    <FileTextIcon className="w-4 h-4" />
                    Paste Text
                </button>
            </div>

            {/* Content Area */}
            <div className="mb-10 min-h-75 rounded-xl border border-slate-200 bg-white/95 p-6 text-left shadow-sm">
                {mode === "upload" ? (
                    <div className="h-full flex flex-col">
                        <div
                            className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-10 text-center transition-colors hover:bg-slate-50"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                onChange={handleFileChange}
                                accept=".pdf,.doc,.docx,.txt,.md"
                            />
                            <UploadCloudIcon className="w-12 h-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium text-foreground mb-1">
                                Click to upload documents
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Supports PDF, DOCX, TXT (Max 10MB)
                            </p>
                        </div>

                        {/* File List */}
                        {files.length > 0 && (
                            <div className="mt-6 space-y-2">
                                <p className="text-sm font-medium text-muted-foreground mb-2">Attached Files ({files.length})</p>
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
                                                <FileTextIcon className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <span className="text-sm text-foreground truncate">{file.name}</span>
                                            <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full transition-colors"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        <Textarea
                            placeholder="Paste your company policies, guidelines, or any text context here..."
                            className="min-h-75 flex-1 resize-none border-slate-200 bg-slate-50/50 p-4 text-base text-slate-900"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        <p className="text-right text-xs text-muted-foreground mt-2">
                            {content.length} characters
                        </p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-center">
                <Button
                    onClick={handleSkip}
                    variant="outline"
                    className="px-8 py-6 text-base"
                >
                    <SkipForwardIcon className="w-4 h-4 mr-2" />
                    Skip for Now
                </Button>
                <Button
                    onClick={handleContinue}
                    disabled={files.length === 0 && !content.trim()}
                    className="px-12 py-6 text-base font-medium"
                >
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Save & Continue
                </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
                You can manage your knowledge base later from the agent settings
            </p>
        </div>
    );
}
