"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileText, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AttachmentPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    attachment: {
        filename: string;
        mimeType: string;
        size: number;
        attachmentId: string;
    };
    emailId: string;
    agentId: string;
}

export function AttachmentPreviewDialog({
    isOpen,
    onClose,
    attachment,
    emailId,
    agentId,
}: AttachmentPreviewDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const normalizedAttachmentId = attachment.attachmentId || (attachment as any).id;
    const downloadUrl = `/api/standalone-agents/gmail-classifier/download-attachment?agentId=${agentId}&emailId=${emailId}&attachmentId=${normalizedAttachmentId}&filename=${encodeURIComponent(attachment.filename)}&mimeType=${encodeURIComponent(attachment.mimeType)}`;

    // Determine if file can be previewed
    const canPreview = () => {
        const type = attachment.mimeType.toLowerCase();
        return (
            type.startsWith("image/") ||
            type === "application/pdf" ||
            type.startsWith("text/") ||
            type.includes("csv")
        );
    };

    const isTextBased = () => {
        const type = attachment.mimeType.toLowerCase();
        return type.startsWith("text/") || type.includes("csv");
    };

    // Load preview when dialog opens
    useEffect(() => {
        if (!isOpen || !canPreview()) {
            setPreviewUrl(null);
            setTextContent(null);
            setError(null);
            return;
        }

        let currentUrl: string | null = null;

        const loadPreview = async () => {
            setIsLoading(true);
            setError(null);
            setTextContent(null);
            setPreviewUrl(null);

            try {
                const response = await fetch(downloadUrl);
                if (!response.ok) throw new Error("Failed to load preview");

                const blob = await response.blob();

                if (isTextBased()) {
                    const text = await blob.text();
                    setTextContent(text);
                } else {
                    currentUrl = URL.createObjectURL(blob);
                    setPreviewUrl(currentUrl);
                }
            } catch (err: any) {
                console.error("Preview error:", err);
                setError(err.message || "Failed to load preview");
            } finally {
                setIsLoading(false);
            }
        };

        loadPreview();

        // Cleanup blob URL on unmount or close
        return () => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, [isOpen, attachment.attachmentId]);

    const handleDownload = () => {
        const downloadUrlWithParam = `${downloadUrl}&download=true`;
        window.open(downloadUrlWithParam, "_blank");
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const renderPreview = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Loading preview...</span>
                </div>
            );
        }

        if (error) {
            return (
                <Card className="p-6 bg-destructive/10 border-destructive/20">
                    <div className="flex items-center gap-3 text-destructive">
                        <AlertCircle className="w-5 h-5" />
                        <div>
                            <div className="font-medium">Preview failed</div>
                            <div className="text-sm">{error}</div>
                        </div>
                    </div>
                </Card>
            );
        }

        if (!previewUrl && !textContent) {
            return (
                <Card className="p-8 bg-muted/30">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <FileText className="w-16 h-16 text-muted-foreground" />
                        <div>
                            <div className="font-medium text-lg mb-1">Preview not available</div>
                            <div className="text-sm text-muted-foreground">
                                This file type cannot be previewed. Click download to view it.
                            </div>
                        </div>
                        <Button onClick={handleDownload} className="mt-2">
                            <Download className="w-4 h-4 mr-2" />
                            Download {attachment.filename}
                        </Button>
                    </div>
                </Card>
            );
        }

        const type = attachment.mimeType.toLowerCase();

        // Image preview
        if (type.startsWith("image/") && previewUrl) {
            return (
                <div className="flex items-center justify-center bg-muted/20 rounded-lg p-4">
                    <img
                        src={previewUrl}
                        alt={attachment.filename}
                        className="max-w-full max-h-[60vh] object-contain rounded"
                    />
                </div>
            );
        }

        // PDF preview
        if (type === "application/pdf" && previewUrl) {
            return (
                <iframe
                    src={previewUrl}
                    sandbox="allow-same-origin"
                    className="w-full h-[60vh] rounded-lg border border-border"
                    title={attachment.filename}
                />
            );
        }

        // Text/CSV preview
        if (isTextBased() && textContent !== null) {
            return (
                <div className="w-full max-h-[60vh] overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-sm whitespace-pre">
                    {textContent || <span className="text-muted-foreground italic">File is empty</span>}
                </div>
            );
        }

        return null;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-xl truncate">
                                {attachment.filename}
                            </DialogTitle>
                            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                                <span>{formatFileSize(attachment.size)}</span>
                                <span>•</span>
                                <span className="truncate">{attachment.mimeType}</span>
                            </div>
                        </div>
                        <Button
                            onClick={handleDownload}
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto mt-4">
                    {renderPreview()}
                </div>
            </DialogContent>
        </Dialog>
    );
}
