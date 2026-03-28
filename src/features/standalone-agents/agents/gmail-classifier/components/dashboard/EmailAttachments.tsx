"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    FileText, Image as ImageIcon, FileSpreadsheet,
    File, Archive, Download, Eye
} from "lucide-react";

interface Attachment {
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
}

interface EmailAttachmentsProps {
    attachments: Attachment[];
    onNavigateToAttachments?: () => void;
}

export function EmailAttachments({ attachments, onNavigateToAttachments }: EmailAttachmentsProps) {
    if (!attachments || attachments.length === 0) {
        return null;
    }

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith("image/")) return <ImageIcon className="w-5 h-5" />;
        if (mimeType.includes("pdf")) return <FileText className="w-5 h-5" />;
        if (mimeType.includes("sheet") || mimeType.includes("excel")) return <FileSpreadsheet className="w-5 h-5" />;
        if (mimeType.includes("zip") || mimeType.includes("compressed")) return <Archive className="w-5 h-5" />;
        return <File className="w-5 h-5" />;
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileTypeLabel = (mimeType: string): string => {
        if (mimeType.startsWith("image/")) return "Image";
        if (mimeType.includes("pdf")) return "PDF";
        if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
        if (mimeType.includes("sheet") || mimeType.includes("excel")) return "Spreadsheet";
        if (mimeType.includes("zip") || mimeType.includes("compressed")) return "Archive";
        return "File";
    };

    return (
        <Card className="p-4 mb-4 bg-muted/30 border-muted">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                        {attachments.length} Attachment{attachments.length > 1 ? "s" : ""}
                    </span>
                </div>
                {onNavigateToAttachments && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onNavigateToAttachments}
                        className="text-xs h-7"
                    >
                        <Eye className="w-3 h-3 mr-1" />
                        View All
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-2">
                {attachments.map((attachment, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={onNavigateToAttachments}
                    >
                        <div className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                            {getFileIcon(attachment.mimeType)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                                {attachment.filename}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                    {getFileTypeLabel(attachment.mimeType)}
                                </Badge>
                                <span>{formatFileSize(attachment.size)}</span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement download
                                console.log("Download:", attachment.attachmentId);
                            }}
                        >
                            <Download className="w-3 h-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </Card>
    );
}
