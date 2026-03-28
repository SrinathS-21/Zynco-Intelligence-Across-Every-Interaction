import {
    AlertCircle, Star, User, CreditCard, Bell,
    Newspaper, Megaphone, Bot, Layout, Mail,
    Inbox, Send, Archive, Trash2, Clock, CheckCircle2,
    LucideIcon
} from "lucide-react";

export interface CategoryInfo {
    label: string;
    Icon: LucideIcon;
    color: string;
    bgClass: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryInfo> = {
    'requires_action': {
        label: 'Action Required',
        Icon: AlertCircle,
        color: 'rose',
        bgClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-400',
    },
    'important': {
        label: 'Important',
        Icon: Star,
        color: 'orange',
        bgClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/15 dark:text-orange-400',
    },
    'personal': {
        label: 'Personal',
        Icon: User,
        color: 'blue',
        bgClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400',
    },
    'transactional': {
        label: 'Transactional',
        Icon: CreditCard,
        color: 'purple',
        bgClass: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-400',
    },
    'updates': {
        label: 'Updates',
        Icon: Bell,
        color: 'cyan',
        bgClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:bg-cyan-500/15 dark:text-cyan-400',
    },
    'newsletters': {
        label: 'Newsletters',
        Icon: Newspaper,
        color: 'gray',
        bgClass: 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/15 dark:text-gray-400',
    },
    'promotional': {
        label: 'Promotional',
        Icon: Megaphone,
        color: 'emerald',
        bgClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400',
    },
    'automated': {
        label: 'Automated',
        Icon: Bot,
        color: 'slate',
        bgClass: 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:bg-slate-500/15 dark:text-slate-400',
    },
};

export const CATEGORY_TABS = [
    { id: 'all', label: 'All', Icon: null },
    { id: 'requires_action', label: 'Action', Icon: AlertCircle },
    { id: 'important', label: 'Important', Icon: Star },
    { id: 'personal', label: 'Personal', Icon: User },
    { id: 'transactional', label: 'Bills', Icon: CreditCard },
    { id: 'updates', label: 'Updates', Icon: Bell },
    { id: 'newsletters', label: 'News', Icon: Newspaper },
    { id: 'promotional', label: 'Promos', Icon: Megaphone },
];

export const FOLDERS = [
    { id: 'focus', label: 'Focused', Icon: Layout },
    { id: 'inbox', label: 'Inbox', Icon: Inbox },
    { id: 'sent', label: 'Sent', Icon: Send },
    { id: 'archive', label: 'Archive', Icon: Archive },
    { id: 'trash', label: 'Trash', Icon: Trash2 },
    { id: 'reminder', label: 'Reminders', Icon: Clock },
];
