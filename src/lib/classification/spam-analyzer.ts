/**
 * Spam Analyzer
 * Analyzes spam emails to identify potentially important ones that were misclassified
 */

export interface SpamAnalysis {
    importanceScore: number; // 1-5 (5 = most important)
    importanceLevel: 'critical' | 'high' | 'medium' | 'low' | 'ignore';
    contextLabels: string[];
    reason: string;
    shouldRescue: boolean;
}

// Known important company domains
const IMPORTANT_DOMAINS = [
    'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'linkedin.com',
    'zoom.us', 'calendly.com', 'slack.com', 'stripe.com', 'paypal.com',
    'github.com', 'atlassian.com', 'notion.so', 'figma.com', 'adobe.com',
    'salesforce.com', 'hubspot.com', 'mailchimp.com', 'sendgrid.com',
    'twilio.com', 'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com',
    'indeed.com', 'glassdoor.com', 'lever.co', 'greenhouse.io', 'workday.com',
    'docusign.com', 'hellosign.com', 'dropbox.com', 'box.com',
    'uber.com', 'lyft.com', 'doordash.com', 'instacart.com',
    'netflix.com', 'spotify.com', 'youtube.com',
    'bank', 'chase.com', 'wellsfargo.com', 'bankofamerica.com', 'citi.com',
];

// Meeting and calendar keywords
const MEETING_KEYWORDS = [
    'meeting', 'invite', 'calendar', 'schedule', 'appointment',
    'zoom', 'teams', 'google meet', 'webex', 'skype',
    'conference', 'call', 'discussion', 'sync', 'standup',
    'interview', 'demo', 'presentation', 'workshop',
];

// Job and career keywords
const JOB_KEYWORDS = [
    'interview', 'job', 'position', 'role', 'opportunity',
    'application', 'candidate', 'resume', 'cv', 'hiring',
    'offer', 'salary', 'employment', 'career', 'recruiter',
    'talent', 'headhunter', 'staffing',
];

// Payment and financial keywords
const PAYMENT_KEYWORDS = [
    'invoice', 'payment', 'receipt', 'order', 'purchase',
    'subscription', 'billing', 'transaction', 'refund',
    'charge', 'statement', 'account', 'balance',
];

// Security and important account keywords
const SECURITY_KEYWORDS = [
    'password', 'security', 'verify', 'confirm', 'authentication',
    'two-factor', '2fa', 'login', 'access', 'reset',
    'suspicious', 'unusual activity',
];

/**
 * Extract domain from email address
 */
function extractDomain(from: string): string {
    const match = from.match(/@([a-zA-Z0-9.-]+)/);
    return match ? match[1].toLowerCase() : '';
}

/**
 * Check if text contains any keywords from a list
 */
function containsKeywords(text: string, keywords: string[]): string[] {
    const lowerText = text.toLowerCase();
    return keywords.filter(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Analyze a spam email for importance
 */
export function analyzeSpamEmail(email: {
    from: string;
    subject: string;
    snippet: string;
    body?: string;
}): SpamAnalysis {
    const domain = extractDomain(email.from);
    const fullText = `${email.subject} ${email.snippet} ${email.body || ''}`;

    let score = 0;
    const contextLabels: string[] = [];
    const reasons: string[] = [];

    // Check for important domains (high signal)
    const isImportantDomain = IMPORTANT_DOMAINS.some(d => domain.includes(d));
    if (isImportantDomain) {
        score += 2;
        contextLabels.push('💼 Known Company');
        reasons.push(`From trusted domain: ${domain}`);
    }

    // Check for meeting keywords (very high signal)
    const meetingMatches = containsKeywords(fullText, MEETING_KEYWORDS);
    if (meetingMatches.length > 0) {
        score += 2;
        contextLabels.push('📅 Meeting Invite');
        reasons.push(`Contains meeting keywords: ${meetingMatches.slice(0, 2).join(', ')}`);
    }

    // Check for job keywords (high signal)
    const jobMatches = containsKeywords(fullText, JOB_KEYWORDS);
    if (jobMatches.length > 0) {
        score += 2;
        contextLabels.push('💼 Job Related');
        reasons.push(`Contains job keywords: ${jobMatches.slice(0, 2).join(', ')}`);
    }

    // Check for payment keywords (medium-high signal)
    const paymentMatches = containsKeywords(fullText, PAYMENT_KEYWORDS);
    if (paymentMatches.length > 0) {
        score += 1.5;
        contextLabels.push('💳 Payment/Invoice');
        reasons.push(`Contains payment keywords: ${paymentMatches.slice(0, 2).join(', ')}`);
    }

    // Check for security keywords (high signal)
    const securityMatches = containsKeywords(fullText, SECURITY_KEYWORDS);
    if (securityMatches.length > 0) {
        score += 1.5;
        contextLabels.push('🔐 Security Alert');
        reasons.push(`Contains security keywords: ${securityMatches.slice(0, 2).join(', ')}`);
    }

    // Check for personal indicators
    if (email.subject.toLowerCase().includes('re:') || email.subject.toLowerCase().includes('fwd:')) {
        score += 1;
        contextLabels.push('💬 Reply/Forward');
        reasons.push('Appears to be part of a conversation');
    }

    // Cap score at 5
    const finalScore = Math.min(Math.round(score), 5);

    // Determine importance level
    let importanceLevel: SpamAnalysis['importanceLevel'];
    if (finalScore >= 4) {
        importanceLevel = 'critical';
    } else if (finalScore >= 3) {
        importanceLevel = 'high';
    } else if (finalScore >= 2) {
        importanceLevel = 'medium';
    } else if (finalScore >= 1) {
        importanceLevel = 'low';
    } else {
        importanceLevel = 'ignore';
    }

    return {
        importanceScore: finalScore,
        importanceLevel,
        contextLabels: contextLabels.slice(0, 3), // Max 3 labels
        reason: reasons.join('. ') || 'No specific importance signals detected',
        shouldRescue: finalScore >= 2,
    };
}

/**
 * Analyze multiple spam emails and return sorted by importance
 */
export function analyzeSpamEmails<T extends { from: string; subject: string; snippet: string; body?: string }>(
    emails: T[]
): Array<T & { spamAnalysis: SpamAnalysis }> {
    const analyzed = emails.map(email => ({
        ...email,
        spamAnalysis: analyzeSpamEmail(email),
    }));

    // Sort by importance score descending
    return analyzed.sort((a, b) => b.spamAnalysis.importanceScore - a.spamAnalysis.importanceScore);
}

/**
 * Get emoji for importance level
 */
export function getImportanceEmoji(level: SpamAnalysis['importanceLevel']): string {
    switch (level) {
        case 'critical': return '🔴';
        case 'high': return '🟠';
        case 'medium': return '🟡';
        case 'low': return '🟢';
        case 'ignore': return '⚪';
    }
}

/**
 * Get color class for importance level
 */
export function getImportanceColor(level: SpamAnalysis['importanceLevel']): string {
    switch (level) {
        case 'critical': return 'text-red-500 bg-red-500/10';
        case 'high': return 'text-orange-500 bg-orange-500/10';
        case 'medium': return 'text-yellow-500 bg-yellow-500/10';
        case 'low': return 'text-green-500 bg-green-500/10';
        case 'ignore': return 'text-gray-400 bg-gray-500/10';
    }
}
