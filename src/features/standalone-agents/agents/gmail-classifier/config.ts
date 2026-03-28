/**
 * Email Classifier Configuration
 * Following ai-lead-generator pattern
 */

export const GMAIL_CLASSIFIER_CONFIG = {
    name: "Email Classifier",
    description: "AI-powered email classification with SPL optimization",
    type: "GMAIL_CLASSIFIER" as const,
} as const;

// Email categories
export const EMAIL_CATEGORIES = {
    URGENT: "urgent",
    PERSONAL: "personal",
    PROMOTIONAL: "promotional",
    AUTOMATED: "automated",
    NEWSLETTER: "newsletter",
    MEETING: "meeting",
    BILLING: "billing",
    SUPPORT: "support",
    OTHER: "other",
} as const;

// Priority levels
export const PRIORITY_LEVELS = {
    CRITICAL: "critical",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
} as const;

// Category display names
export const CATEGORY_NAMES: Record<string, string> = {
    urgent: "Urgent",
    personal: "Personal",
    promotional: "Promotional",
    automated: "Automated",
    newsletter: "Newsletter",
    meeting: "Meeting",
    billing: "Billing",
    support: "Support",
    other: "Other",
};

// Default email fetch count
export const DEFAULT_EMAIL_COUNT = 25;
