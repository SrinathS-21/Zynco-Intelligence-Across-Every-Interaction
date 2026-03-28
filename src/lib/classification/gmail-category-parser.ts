// ============================================================================
// GMAIL CATEGORY PARSER
// ============================================================================
// Extracts and maps Gmail's built-in categories to SpinaBOT categories
// This is FREE classification from Gmail's AI - no LLM cost!
// ============================================================================

/**
 * Gmail category labels (from Gmail tabs)
 */
export const GMAIL_CATEGORY_LABELS = {
    PRIMARY: 'CATEGORY_PRIMARY',
    PROMOTIONS: 'CATEGORY_PROMOTIONS',
    SOCIAL: 'CATEGORY_SOCIAL',
    UPDATES: 'CATEGORY_UPDATES',
    FORUMS: 'CATEGORY_FORUMS',
} as const;

/**
 * Result from Gmail category parsing
 */
export interface GmailCategoryResult {
    hasGmailCategory: boolean;
    gmailCategory: string | null;
    mappedCategory: string;
    mappedPriority: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    isImportant: boolean;
    isStarred: boolean;
    userLabels: string[];
    skipLLM: boolean;
    reason: string;
}

/**
 * Gmail category to SpinaBOT category mapping
 */
const GMAIL_TO_SPINABOT_CATEGORY: Record<string, { category: string; priority: 'critical' | 'high' | 'medium' | 'low'; skipLLM: boolean }> = {
    'CATEGORY_PRIMARY': { category: 'personal', priority: 'medium', skipLLM: false }, // May need LLM for priority
    'CATEGORY_PROMOTIONS': { category: 'promotional', priority: 'low', skipLLM: true }, // 100% skip LLM
    'CATEGORY_SOCIAL': { category: 'newsletter', priority: 'low', skipLLM: true }, // 100% skip LLM
    'CATEGORY_UPDATES': { category: 'automated', priority: 'medium', skipLLM: true }, // 100% skip LLM
    'CATEGORY_FORUMS': { category: 'other', priority: 'low', skipLLM: true }, // 100% skip LLM
};

/**
 * User custom label patterns to category mapping
 * Matches common label naming patterns
 */
const USER_LABEL_PATTERNS: Array<{
    pattern: RegExp;
    category: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
}> = [
        // Action required labels
        { pattern: /to.?respond|action.?required|urgent|asap/i, category: 'urgent', priority: 'critical' },
        { pattern: /fyi|for.?your.?info|informational/i, category: 'other', priority: 'low' },
        { pattern: /meeting|calendar|schedule/i, category: 'meeting', priority: 'high' },
        { pattern: /marketing|promo|newsletter/i, category: 'promotional', priority: 'low' },
        { pattern: /notification|alert|update/i, category: 'automated', priority: 'medium' },
        { pattern: /billing|invoice|payment/i, category: 'billing', priority: 'high' },
        { pattern: /support|help|ticket/i, category: 'support', priority: 'medium' },
        { pattern: /comment|discuss|review/i, category: 'other', priority: 'medium' },
    ];

/**
 * Parse Gmail labels and map to SpinaBOT categories
 * @param labels - Array of Gmail label IDs (e.g., ['INBOX', 'CATEGORY_PROMOTIONS', 'UNREAD'])
 * @returns GmailCategoryResult with mapped category and priority
 */
export function parseGmailLabels(labels: string[]): GmailCategoryResult {
    if (!labels || labels.length === 0) {
        return {
            hasGmailCategory: false,
            gmailCategory: null,
            mappedCategory: 'other',
            mappedPriority: 'medium',
            confidence: 0.5,
            isImportant: false,
            isStarred: false,
            userLabels: [],
            skipLLM: false,
            reason: 'No labels available',
        };
    }

    // Check for special labels
    const isImportant = labels.includes('IMPORTANT');
    const isStarred = labels.includes('STARRED');

    // Extract user labels (not system labels)
    const systemLabels = [
        'INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT',
        'CATEGORY_PRIMARY', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'
    ];
    const userLabels = labels.filter(l => !systemLabels.includes(l) && !l.startsWith('Label_'));

    // Find Gmail category label
    let gmailCategory: string | null = null;
    let mappedCategory = 'other';
    let mappedPriority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    let skipLLM = false;
    let confidence = 0.5;
    let reason = 'No Gmail category found';

    for (const label of labels) {
        const mapping = GMAIL_TO_SPINABOT_CATEGORY[label];
        if (mapping) {
            gmailCategory = label;
            mappedCategory = mapping.category;
            mappedPriority = mapping.priority;
            skipLLM = mapping.skipLLM;
            confidence = 0.95; // High confidence from Gmail's AI
            reason = `Gmail category: ${label.replace('CATEGORY_', '')}`;
            break;
        }
    }

    // Check user labels for priority overrides
    for (const userLabel of userLabels) {
        for (const { pattern, category, priority } of USER_LABEL_PATTERNS) {
            if (pattern.test(userLabel)) {
                // User label takes precedence for category
                mappedCategory = category;
                mappedPriority = priority;
                skipLLM = true; // User explicitly labeled it
                confidence = 1.0; // User labels are highest confidence
                reason = `User label: ${userLabel}`;
                break;
            }
        }
    }

    // Important flag increases priority
    if (isImportant && mappedPriority === 'low') {
        mappedPriority = 'medium';
    } else if (isImportant && mappedPriority === 'medium') {
        mappedPriority = 'high';
    }

    // Starred flag increases priority  
    if (isStarred && mappedPriority !== 'critical') {
        mappedPriority = 'high';
    }

    return {
        hasGmailCategory: gmailCategory !== null,
        gmailCategory,
        mappedCategory,
        mappedPriority,
        confidence,
        isImportant,
        isStarred,
        userLabels,
        skipLLM,
        reason,
    };
}

/**
 * Get a human-readable Gmail category name
 */
export function getGmailCategoryName(label: string): string {
    const names: Record<string, string> = {
        'CATEGORY_PRIMARY': 'Primary',
        'CATEGORY_PROMOTIONS': 'Promotions',
        'CATEGORY_SOCIAL': 'Social',
        'CATEGORY_UPDATES': 'Updates',
        'CATEGORY_FORUMS': 'Forums',
    };
    return names[label] || label;
}

/**
 * Check if an email should skip LLM classification based on Gmail labels
 */
export function shouldSkipLLMBasedOnLabels(labels: string[]): boolean {
    const result = parseGmailLabels(labels);
    return result.skipLLM;
}
