"use client";

import { useState, useMemo } from "react";
import {
    FileText,
    FileSpreadsheet,
    Image as ImageIcon,
    File,
    Archive,
    Presentation,
    Search,
    Filter,
    Download,
    Mail,
    ChevronDown,
    Paperclip
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Attachment {
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
}

interface Email {
    id: string;
    subject: string;
    from: string;
    date: string;
    attachments?: Attachment[];
}

interface AttachmentsViewProps {
    emails: Email[];
    onSelectEmail: (emailId: string) => void;
    className?: string;
}

// File type configuration
type FileType = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'archive' | 'other';

const FILE_TYPE_CONFIG: Record<FileType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    pdf: {
        label: 'PDF',
        icon: <FileText className="w-5 h-5" />,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
    },
    word: {
        label: 'Word',
        icon: <FileText className="w-5 h-5" />,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
    },
    excel: {
        label: 'Excel',
        icon: <FileSpreadsheet className="w-5 h-5" />,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
    },
    powerpoint: {
        label: 'PowerPoint',
        icon: <Presentation className="w-5 h-5" />,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
    },
    image: {
        label: 'Image',
        icon: <ImageIcon className="w-5 h-5" />,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
    },
    archive: {
        label: 'Archive',
        icon: <Archive className="w-5 h-5" />,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
    },
    other: {
        label: 'File',
        icon: <File className="w-5 h-5" />,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
    },
};

// Detect file type from filename or MIME type
function getFileType(filename: string, mimeType: string): FileType {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // PDF
    if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';

    // Word
    if (['doc', 'docx'].includes(ext) || mimeType.includes('word') || mimeType.includes('document')) return 'word';

    // Excel
    if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'excel';

    // PowerPoint
    if (['ppt', 'pptx'].includes(ext) || mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'powerpoint';

    // Image
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || mimeType.startsWith('image/')) return 'image';

    // Archive
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';

    return 'other';
}

// Format file size
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AttachmentsView({ emails, onSelectEmail, className }: AttachmentsViewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<FileType | 'all'>('all');

    // Flatten all attachments from emails with parent email info
    const allAttachments = useMemo(() => {
        const attachments: Array<{
            attachment: Attachment;
            email: Email;
            fileType: FileType;
        }> = [];

        for (const email of emails) {
            if (email.attachments && email.attachments.length > 0) {
                for (const attachment of email.attachments) {
                    attachments.push({
                        attachment,
                        email,
                        fileType: getFileType(attachment.filename, attachment.mimeType),
                    });
                }
            }
        }

        // Sort by date (newest first)
        attachments.sort((a, b) =>
            new Date(b.email.date).getTime() - new Date(a.email.date).getTime()
        );

        return attachments;
    }, [emails]);

    // Apply filters
    const filteredAttachments = useMemo(() => {
        let filtered = allAttachments;

        // Search by filename
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.attachment.filename.toLowerCase().includes(query) ||
                item.email.from.toLowerCase().includes(query) ||
                item.email.subject.toLowerCase().includes(query)
            );
        }

        // Filter by type
        if (typeFilter !== 'all') {
            filtered = filtered.filter(item => item.fileType === typeFilter);
        }

        return filtered;
    }, [allAttachments, searchQuery, typeFilter]);

    // Count by type
    const typeCounts = useMemo(() => {
        const counts: Record<FileType, number> = {
            pdf: 0, word: 0, excel: 0, powerpoint: 0, image: 0, archive: 0, other: 0
        };
        for (const item of allAttachments) {
            counts[item.fileType]++;
        }
        return counts;
    }, [allAttachments]);

    return (
        <div className={cn("flex-1 flex flex-col bg-muted/10", className)}>
            {/* Header */}
            <div className="flex-shrink-0 px-8 py-6 border-b border-border bg-background/50">
                <div className="flex items-center gap-3 mb-2">
                    <Paperclip className="w-6 h-6 text-muted-foreground" />
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Attachments</h2>
                    <Badge variant="secondary" className="text-sm">{allAttachments.length}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">All files received in your emails</p>
            </div>

            {/* Search & Filters */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-background/30">
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by filename, sender..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>

                    {/* Type Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-2">
                                <Filter className="w-4 h-4" />
                                {typeFilter === 'all' ? 'All Types' : FILE_TYPE_CONFIG[typeFilter].label}
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs">File Type</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setTypeFilter('all')}>
                                All Types ({allAttachments.length})
                            </DropdownMenuItem>
                            {Object.entries(FILE_TYPE_CONFIG).map(([type, config]) => (
                                typeCounts[type as FileType] > 0 && (
                                    <DropdownMenuItem
                                        key={type}
                                        onClick={() => setTypeFilter(type as FileType)}
                                        className="gap-2"
                                    >
                                        <span className={config.color}>{config.icon}</span>
                                        {config.label} ({typeCounts[type as FileType]})
                                    </DropdownMenuItem>
                                )
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Attachments Grid */}
            <div className="flex-1 overflow-auto p-6">
                {filteredAttachments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Paperclip className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        {allAttachments.length === 0 ? (
                            <>
                                <p className="text-lg font-medium text-muted-foreground">No attachments found</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Sync your emails to see attachments here
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-medium text-muted-foreground">No matching files</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Try adjusting your search or filters
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredAttachments.map((item, index) => {
                            const config = FILE_TYPE_CONFIG[item.fileType];
                            return (
                                <div
                                    key={`${item.email.id}-${item.attachment.attachmentId}-${index}`}
                                    className="group rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                                    onClick={() => onSelectEmail(item.email.id)}
                                >
                                    {/* File Icon & Type */}
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className={cn(
                                            "flex items-center justify-center w-10 h-10 rounded-lg",
                                            config.bgColor, config.color
                                        )}>
                                            {config.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate" title={item.attachment.filename}>
                                                {item.attachment.filename}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatFileSize(item.attachment.size)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Email Info */}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Mail className="w-3 h-3" />
                                        <span className="truncate flex-1" title={item.email.from}>
                                            {item.email.from.replace(/<.*>/, '').trim()}
                                        </span>
                                        <span className="flex-shrink-0">{formatDate(item.email.date)}</span>
                                    </div>

                                    {/* Email Subject */}
                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-1" title={item.email.subject}>
                                        {item.email.subject}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
