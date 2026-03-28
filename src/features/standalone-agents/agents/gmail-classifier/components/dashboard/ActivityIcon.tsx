"use client";

import {
    Activity,
    Plug,
    Unplug,
    ClipboardList,
    FileText,
    PlusCircle,
    Pencil,
    Trash2,
    Play,
    Brain,
    RefreshCw,
    Tag,
    Zap,
    ShoppingBag,
    Loader2,
    Clock,
    CheckCircle,
    XCircle,
    Filter,
    ChevronDown
} from "lucide-react";
import { ActivityType } from "@/lib/activity-history";

interface ActivityIconProps {
    type: ActivityType | 'loading' | 'clock' | 'success' | 'failed' | 'filter' | 'chevron-down' | 'activity';
    className?: string;
}

export function ActivityIcon({ type, className }: ActivityIconProps) {
    switch (type) {
        case 'connection': return <Plug className={className} />;
        case 'disconnection': return <Unplug className={className} />;
        case 'jira_task': return <ClipboardList className={className} />;
        case 'notion_page': return <FileText className={className} />;
        case 'crm_order': return <ShoppingBag className={className} />;
        case 'rule_created': return <PlusCircle className={className} />;
        case 'rule_updated': return <Pencil className={className} />;
        case 'rule_deleted': return <Trash2 className={className} />;
        case 'rule_executed': return <Play className={className} />;
        case 'knowledge_added': return <Brain className={className} />;
        case 'knowledge_deleted': return <Brain className={className} />;
        case 'email_sync': return <RefreshCw className={className} />;
        case 'email_classified': return <Tag className={className} />;
        case 'automation': return <Zap className={className} />;
        case 'loading': return <Loader2 className={className} />;
        case 'clock': return <Clock className={className} />;
        case 'success': return <CheckCircle className={className} />;
        case 'failed': return <XCircle className={className} />;
        case 'filter': return <Filter className={className} />;
        case 'chevron-down': return <ChevronDown className={className} />;
        case 'activity': return <Activity className={className} />;
        default: return <Activity className={className} />;
    }
}

