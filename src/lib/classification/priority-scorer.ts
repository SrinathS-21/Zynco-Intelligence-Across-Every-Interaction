/**
 * Priority Scorer
 * Multi-factor scoring system for email prioritization
 */

export interface PriorityResult {
    score: number;           // 0-100 priority score
    level: 'critical' | 'high' | 'medium' | 'low';
    factors: PriorityFactor[];
    extractedDates: ExtractedDate[];
    monetaryAmounts: string[];
    isUrgent: boolean;
    suggestedAction?: string;
}

export interface PriorityFactor {
    name: string;
    weight: number;
    matched: boolean;
    details?: string;
}

export interface ExtractedDate {
    text: string;
    type: 'deadline' | 'event' | 'expiry' | 'general';
    isUrgent: boolean;
}

// Urgency keywords that boost priority
const URGENCY_KEYWORDS = {
    critical: ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'time-sensitive'],
    high: ['deadline', 'due today', 'due tomorrow', 'expires', 'last chance', 'final notice', 'action required'],
    medium: ['reminder', 'follow up', 'waiting for', 'pending', 'please respond'],
};

// Important sender patterns
const IMPORTANT_SENDER_PATTERNS = [
    /ceo@/i, /cfo@/i, /cto@/i,
    /founder@/i, /director@/i,
    /hr@/i, /payroll@/i, /finance@/i,
    /@bank/i, /@gov\./i,
];

// Financial/Security keywords
const FINANCIAL_KEYWORDS = ['invoice', 'payment', 'bill', 'due', 'amount', 'balance', 'transaction', 'credit', 'debit'];
const SECURITY_KEYWORDS = ['password', 'otp', 'verification', 'login', 'security', 'suspicious', 'alert', '2fa', 'authentication'];

// Date extraction patterns
const DATE_PATTERNS = [
    { regex: /\b(today|tonight)\b/i, type: 'deadline' as const, urgent: true },
    { regex: /\b(tomorrow)\b/i, type: 'deadline' as const, urgent: true },
    { regex: /\bby\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+\w+\s+\d{2,4})\b/i, type: 'deadline' as const, urgent: false },
    { regex: /\bdue\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4}|\w+\s+\d{1,2})\b/i, type: 'deadline' as const, urgent: false },
    { regex: /\bexpires?\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4}|\w+\s+\d{1,2})\b/i, type: 'expiry' as const, urgent: true },
    { regex: /\bmeeting\s+(on\s+)?(\d{1,2}[\/\-]\d{1,2}|\w+day)\b/i, type: 'event' as const, urgent: false },
    { regex: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g, type: 'general' as const, urgent: false },
];

// Monetary patterns
const MONETARY_PATTERNS = [
    /\$[\d,]+\.?\d*/g,
    /₹[\d,]+\.?\d*/g,
    /€[\d,]+\.?\d*/g,
    /£[\d,]+\.?\d*/g,
    /USD\s*[\d,]+\.?\d*/gi,
    /INR\s*[\d,]+\.?\d*/gi,
];

/**
 * Calculate priority score for an email
 */
export function calculatePriorityScore(
    email: {
        subject: string;
        from: string;
        body: string;
        snippet?: string;
        category?: string;
        labels?: string[];
        isRead?: boolean;
    },
    options?: {
        userImportantSenders?: string[];
    }
): PriorityResult {
    const content = `${email.subject} ${email.body || email.snippet || ''}`.toLowerCase();
    const factors: PriorityFactor[] = [];
    let score = 50; // Base score

    // Factor 1: Category-based scoring
    const categoryScore = getCategoryScore(email.category || '');
    if (categoryScore.boost !== 0) {
        factors.push({
            name: 'Category',
            weight: categoryScore.boost,
            matched: true,
            details: categoryScore.reason
        });
        score += categoryScore.boost;
    }

    // Factor 2: Urgency keywords
    const urgencyResult = checkUrgencyKeywords(content);
    if (urgencyResult.boost > 0) {
        factors.push({
            name: 'Urgency Keywords',
            weight: urgencyResult.boost,
            matched: true,
            details: urgencyResult.matched.join(', ')
        });
        score += urgencyResult.boost;
    }

    // Factor 3: Important sender
    const senderImportance = checkSenderImportance(email.from, options?.userImportantSenders);
    if (senderImportance.boost > 0) {
        factors.push({
            name: 'Sender Importance',
            weight: senderImportance.boost,
            matched: true,
            details: senderImportance.reason
        });
        score += senderImportance.boost;
    }

    // Factor 4: Financial content
    if (FINANCIAL_KEYWORDS.some(kw => content.includes(kw))) {
        factors.push({
            name: 'Financial Content',
            weight: 10,
            matched: true
        });
        score += 10;
    }

    // Factor 5: Security content
    if (SECURITY_KEYWORDS.some(kw => content.includes(kw))) {
        factors.push({
            name: 'Security Alert',
            weight: 15,
            matched: true
        });
        score += 15;
    }

    // Factor 6: Unread boost
    if (!email.isRead) {
        factors.push({
            name: 'Unread',
            weight: 5,
            matched: true
        });
        score += 5;
    }

    // Extract dates
    const extractedDates = extractDates(content);
    const hasUrgentDate = extractedDates.some(d => d.isUrgent);
    if (hasUrgentDate) {
        factors.push({
            name: 'Urgent Date',
            weight: 15,
            matched: true,
            details: extractedDates.find(d => d.isUrgent)?.text
        });
        score += 15;
    }

    // Extract monetary amounts
    const monetaryAmounts = extractMonetaryAmounts(content);
    if (monetaryAmounts.length > 0) {
        factors.push({
            name: 'Contains Amount',
            weight: 5,
            matched: true,
            details: monetaryAmounts[0]
        });
        score += 5;
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine level
    const level = score >= 80 ? 'critical'
        : score >= 60 ? 'high'
            : score >= 40 ? 'medium'
                : 'low';

    // Suggest action
    const suggestedAction = getSuggestedAction(email.category || '', factors, extractedDates);

    return {
        score,
        level,
        factors,
        extractedDates,
        monetaryAmounts,
        isUrgent: hasUrgentDate || urgencyResult.boost >= 15,
        suggestedAction
    };
}

function getCategoryScore(category: string): { boost: number; reason: string } {
    switch (category.toLowerCase()) {
        case 'requires_action':
            return { boost: 20, reason: 'Action Required' };
        case 'important':
            return { boost: 15, reason: 'Important' };
        case 'personal':
            return { boost: 10, reason: 'Personal' };
        case 'transactional':
            return { boost: 5, reason: 'Transactional' };
        case 'newsletters':
        case 'promotional':
            return { boost: -10, reason: 'Low Priority Category' };
        case 'automated':
            return { boost: -15, reason: 'Automated' };
        default:
            return { boost: 0, reason: '' };
    }
}

function checkUrgencyKeywords(content: string): { boost: number; matched: string[] } {
    const matched: string[] = [];

    for (const kw of URGENCY_KEYWORDS.critical) {
        if (content.includes(kw)) {
            matched.push(kw);
        }
    }
    if (matched.length > 0) return { boost: 20, matched };

    for (const kw of URGENCY_KEYWORDS.high) {
        if (content.includes(kw)) {
            matched.push(kw);
        }
    }
    if (matched.length > 0) return { boost: 12, matched };

    for (const kw of URGENCY_KEYWORDS.medium) {
        if (content.includes(kw)) {
            matched.push(kw);
        }
    }
    if (matched.length > 0) return { boost: 6, matched };

    return { boost: 0, matched: [] };
}

function checkSenderImportance(from: string, userImportantSenders?: string[]): { boost: number; reason: string } {
    // Check user's important senders
    if (userImportantSenders?.some(s => from.toLowerCase().includes(s.toLowerCase()))) {
        return { boost: 15, reason: 'Your VIP sender' };
    }

    // Check system patterns
    for (const pattern of IMPORTANT_SENDER_PATTERNS) {
        if (pattern.test(from)) {
            return { boost: 12, reason: 'Important role sender' };
        }
    }

    return { boost: 0, reason: '' };
}

function extractDates(content: string): ExtractedDate[] {
    const dates: ExtractedDate[] = [];

    for (const pattern of DATE_PATTERNS) {
        const matches = content.match(pattern.regex);
        if (matches) {
            for (const match of matches.slice(0, 2)) { // Max 2 per pattern
                dates.push({
                    text: match.trim(),
                    type: pattern.type,
                    isUrgent: pattern.urgent
                });
            }
        }
    }

    return dates.slice(0, 3); // Max 3 dates
}

function extractMonetaryAmounts(content: string): string[] {
    const amounts: string[] = [];

    for (const pattern of MONETARY_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
            amounts.push(...matches);
        }
    }

    return [...new Set(amounts)].slice(0, 3); // Unique, max 3
}

function getSuggestedAction(category: string, factors: PriorityFactor[], dates: ExtractedDate[]): string | undefined {
    if (factors.some(f => f.name === 'Security Alert')) {
        return 'Review security alert';
    }
    if (dates.some(d => d.type === 'deadline' && d.isUrgent)) {
        return 'Has urgent deadline';
    }
    if (category === 'requires_action') {
        return 'Respond or take action';
    }
    if (factors.some(f => f.name === 'Financial Content')) {
        return 'Review financial details';
    }
    return undefined;
}

/**
 * Get priority level color classes
 */
export function getPriorityStyles(level: PriorityResult['level']) {
    switch (level) {
        case 'critical':
            return {
                bg: 'bg-red-500/10',
                text: 'text-red-600 dark:text-red-400',
                border: 'border-red-500/30',
                badge: 'bg-red-500 text-white',
            };
        case 'high':
            return {
                bg: 'bg-orange-500/10',
                text: 'text-orange-600 dark:text-orange-400',
                border: 'border-orange-500/30',
                badge: 'bg-orange-500 text-white',
            };
        case 'medium':
            return {
                bg: 'bg-yellow-500/10',
                text: 'text-yellow-600 dark:text-yellow-400',
                border: 'border-yellow-500/30',
                badge: 'bg-yellow-500 text-black',
            };
        case 'low':
            return {
                bg: 'bg-gray-500/10',
                text: 'text-gray-600 dark:text-gray-400',
                border: 'border-gray-500/30',
                badge: 'bg-gray-400 text-white',
            };
    }
}
