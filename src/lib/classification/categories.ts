// ============================================================================
// SPL CATEGORY DEFINITIONS
// ============================================================================
// Defines all email categories with their keywords, patterns, and rules
// ============================================================================

export interface CategoryDefinition {
    id: string;
    name: string;
    description: string;
    defaultPriority: 'urgent' | 'high' | 'medium' | 'low';

    // Keyword matching
    keywords: {
        primary: string[];      // Strong indicators (weight: 0.9)
        secondary: string[];    // Supporting indicators (weight: 0.6)
        negative: string[];     // Exclude if present (weight: -0.5)
    };

    // Domain patterns
    domainPatterns: RegExp[];

    // Subject line patterns
    subjectPatterns: RegExp[];

    // Examples for semantic matching
    examples: string[];
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
    // ==================== URGENT ====================
    {
        id: 'urgent',
        name: 'Urgent',
        description: 'Time-sensitive matters requiring immediate attention',
        defaultPriority: 'urgent',
        keywords: {
            primary: [
                'urgent', 'asap', 'emergency', 'immediately', 'critical',
                'time-sensitive', 'action required', 'respond immediately',
                'deadline today', 'expires today', 'last chance'
            ],
            secondary: [
                'deadline', 'due soon', 'reminder', 'follow up', 'pending',
                'overdue', 'final notice', 'important'
            ],
            negative: [
                'newsletter', 'unsubscribe', 'promotional', 'sale', 'offer'
            ]
        },
        domainPatterns: [],
        subjectPatterns: [
            /\[URGENT\]/i,
            /\[ACTION REQUIRED\]/i,
            /\[TIME SENSITIVE\]/i,
            /URGENT:/i,
            /ASAP:/i
        ],
        examples: [
            'Please respond ASAP regarding the contract',
            'Urgent: Server is down, need immediate action',
            'Action required: Deadline is tomorrow'
        ]
    },

    // ==================== BILLING ====================
    {
        id: 'billing',
        name: 'Billing & Finance',
        description: 'Invoices, payments, receipts, and financial matters',
        defaultPriority: 'high',
        keywords: {
            primary: [
                'invoice', 'payment', 'bill', 'receipt', 'charge',
                'subscription', 'renewal', 'due amount', 'balance due',
                'payment received', 'payment failed', 'refund'
            ],
            secondary: [
                'amount', 'total', 'price', 'cost', 'fee', 'monthly',
                'annual', 'billing cycle', 'statement', 'account'
            ],
            negative: [
                'win', 'prize', 'lottery', 'congratulations'
            ]
        },
        domainPatterns: [
            /@(paypal|stripe|square|braintree)\.com$/i,
            /@billing\./i,
            /@invoices?\./i,
            /@payments?\./i,
            /bank.*\.com$/i
        ],
        subjectPatterns: [
            /invoice\s*#?\s*\d+/i,
            /receipt\s+(for|from)/i,
            /payment\s+(due|received|confirmed|failed)/i,
            /your\s+(bill|statement)/i,
            /subscription\s+(renewal|expir)/i
        ],
        examples: [
            'Invoice #12345 for your recent purchase',
            'Payment received - Thank you',
            'Your subscription renewal is due'
        ]
    },

    // ==================== MEETING ====================
    {
        id: 'meeting',
        name: 'Meetings & Calendar',
        description: 'Meeting invites, schedule requests, calendar events',
        defaultPriority: 'high',
        keywords: {
            primary: [
                'meeting', 'calendar', 'schedule', 'invite', 'invitation',
                'zoom', 'teams', 'google meet', 'call', 'conference',
                'standup', 'sync', 'one-on-one', '1:1'
            ],
            secondary: [
                'discuss', 'agenda', 'attendee', 'participant', 'rsvp',
                'join', 'dial-in', 'video call', 'appointment'
            ],
            negative: [
                'newsletter', 'webinar replay', 'recording available'
            ]
        },
        domainPatterns: [
            /@calendar\.google\.com$/i,
            /@.*\.outlook\.com$/i,
            /@zoom\.us$/i,
            /@teams\.microsoft\.com$/i
        ],
        subjectPatterns: [
            /meeting\s+(invite|request|scheduled|cancelled)/i,
            /calendar\s+(invite|event)/i,
            /invitation:\s/i,
            /rescheduled?:/i,
            /updated\s+invitation/i
        ],
        examples: [
            'Meeting invite: Weekly standup',
            'Calendar invitation: Project review',
            'Join Zoom meeting: Team sync'
        ]
    },

    // ==================== SUPPORT ====================
    {
        id: 'support',
        name: 'Support & Help',
        description: 'Customer support, help requests, issue reports',
        defaultPriority: 'medium',
        keywords: {
            primary: [
                'help', 'support', 'issue', 'problem', 'not working',
                'error', 'bug', 'fix', 'trouble', 'assistance',
                'ticket', 'case'
            ],
            secondary: [
                'request', 'question', 'inquiry', 'feedback', 'report',
                'resolved', 'solution', 'workaround'
            ],
            negative: [
                'promotional', 'upgrade', 'new feature'
            ]
        },
        domainPatterns: [
            /@support\./i,
            /@help\./i,
            /@helpdesk\./i,
            /@customerservice\./i
        ],
        subjectPatterns: [
            /\[ticket\s*#?\s*\d+\]/i,
            /case\s*#?\s*\d+/i,
            /support\s+request/i,
            /re:\s*(issue|problem|help)/i
        ],
        examples: [
            'Need help with login issue',
            'Support ticket #12345 has been updated',
            'Problem with my order'
        ]
    },

    // ==================== SECURITY ====================
    {
        id: 'security',
        name: 'Security & Account',
        description: 'Password resets, security alerts, account changes',
        defaultPriority: 'high',
        keywords: {
            primary: [
                'password', 'security', 'verify', 'verification',
                'suspicious', 'unauthorized', 'login attempt', 'two-factor',
                '2fa', 'mfa', 'authentication'
            ],
            secondary: [
                'account', 'confirm', 'secure', 'protect', 'alert',
                'access', 'sign-in', 'reset'
            ],
            negative: [
                'promotional', 'upgrade', 'premium'
            ]
        },
        domainPatterns: [
            /@security\./i,
            /@accounts?\./i,
            /@noreply\./i
        ],
        subjectPatterns: [
            /password\s+(reset|changed|expired)/i,
            /security\s+(alert|notice|warning)/i,
            /verify\s+your\s+(account|email|identity)/i,
            /suspicious\s+(login|activity|sign-in)/i,
            /new\s+(device|location)\s+sign-in/i
        ],
        examples: [
            'Reset your password',
            'Security alert: New sign-in detected',
            'Verify your email address'
        ]
    },

    // ==================== NEWSLETTER ====================
    {
        id: 'newsletter',
        name: 'Newsletter & Updates',
        description: 'Newsletters, digests, automated updates',
        defaultPriority: 'low',
        keywords: {
            primary: [
                'newsletter', 'digest', 'weekly update', 'monthly report',
                'roundup', 'highlights', 'this week', 'news update'
            ],
            secondary: [
                'subscribe', 'subscriber', 'edition', 'issue #',
                'curated', 'trending', 'top stories'
            ],
            negative: [
                'urgent', 'action required', 'respond'
            ]
        },
        domainPatterns: [
            /@(mailchimp|sendgrid|hubspot|constantcontact)\.com$/i,
            /@newsletter\./i,
            /@updates?\./i,
            /noreply@/i,
            /no-reply@/i
        ],
        subjectPatterns: [
            /newsletter/i,
            /weekly\s+(digest|update|roundup)/i,
            /monthly\s+(digest|update|report)/i,
            /\[\w+\s+newsletter\]/i,
            /issue\s*#?\s*\d+/i
        ],
        examples: [
            'Your weekly newsletter is here',
            'Monthly digest: Top stories',
            'Tech News Roundup - Issue #42'
        ]
    },

    // ==================== PROMOTIONAL ====================
    {
        id: 'promotional',
        name: 'Promotional & Marketing',
        description: 'Sales, discounts, marketing campaigns',
        defaultPriority: 'low',
        keywords: {
            primary: [
                'sale', 'discount', 'offer', 'deal', 'promo', 'coupon',
                'save', '% off', 'free', 'limited time', 'exclusive',
                'special offer', 'black friday', 'cyber monday'
            ],
            secondary: [
                'shop', 'buy', 'order', 'store', 'collection',
                'new arrival', 'bestseller', 'trending'
            ],
            negative: [
                'invoice', 'receipt', 'payment due', 'account'
            ]
        },
        domainPatterns: [
            /@promo\./i,
            /@marketing\./i,
            /@offers?\./i
        ],
        subjectPatterns: [
            /\d+%\s+off/i,
            /sale\s+(ends|starts)/i,
            /limited\s+time/i,
            /don't\s+miss/i,
            /last\s+chance/i,
            /exclusive\s+(offer|deal)/i
        ],
        examples: [
            '50% off - Sale ends tonight!',
            'Exclusive deal just for you',
            'Limited time offer: Free shipping'
        ]
    },

    // ==================== PERSONAL ====================
    {
        id: 'personal',
        name: 'Personal',
        description: 'Personal emails from contacts, conversations',
        defaultPriority: 'medium',
        keywords: {
            primary: [
                'hey', 'hi there', 'hello', 'hope you', 'how are you',
                'catching up', 'good to hear', 'thanks for', 'thank you'
            ],
            secondary: [
                'talk soon', 'best regards', 'cheers', 'take care',
                'let me know', 'get back to me'
            ],
            negative: [
                'unsubscribe', 'promotional', 'newsletter', 'automated'
            ]
        },
        domainPatterns: [
            /@gmail\.com$/i,
            /@yahoo\.com$/i,
            /@hotmail\.com$/i,
            /@outlook\.com$/i,
            /@icloud\.com$/i
        ],
        subjectPatterns: [
            /^re:\s/i,
            /^fwd?:\s/i,
            /quick\s+question/i,
            /checking\s+in/i
        ],
        examples: [
            'Hey! How have you been?',
            'Re: Catching up',
            'Quick question about the project'
        ]
    },

    // ==================== AUTOMATED ====================
    {
        id: 'automated',
        name: 'Automated Notifications',
        description: 'System notifications, automated alerts',
        defaultPriority: 'low',
        keywords: {
            primary: [
                'notification', 'alert', 'automated', 'system',
                'do not reply', 'no-reply', 'noreply', 'auto-generated'
            ],
            secondary: [
                'update', 'status', 'summary', 'report', 'log'
            ],
            negative: []
        },
        domainPatterns: [
            /^noreply@/i,
            /^no-reply@/i,
            /^notifications?@/i,
            /^alerts?@/i,
            /^system@/i,
            /^automated@/i
        ],
        subjectPatterns: [
            /\[automated\]/i,
            /\[notification\]/i,
            /\[alert\]/i,
            /this\s+is\s+an?\s+automated/i
        ],
        examples: [
            '[Automated] Daily backup complete',
            'System notification: Scheduled maintenance',
            'Alert: New login from Chrome'
        ]
    },

    // ==================== OTHER ====================
    {
        id: 'other',
        name: 'Other',
        description: 'Uncategorized emails',
        defaultPriority: 'medium',
        keywords: {
            primary: [],
            secondary: [],
            negative: []
        },
        domainPatterns: [],
        subjectPatterns: [],
        examples: []
    }
];

// Quick lookup map
export const CATEGORY_MAP = new Map(
    CATEGORY_DEFINITIONS.map(cat => [cat.id, cat])
);

// Get category by ID
export function getCategory(id: string): CategoryDefinition | undefined {
    return CATEGORY_MAP.get(id);
}

// Get all category IDs
export function getCategoryIds(): string[] {
    return CATEGORY_DEFINITIONS.map(cat => cat.id);
}
