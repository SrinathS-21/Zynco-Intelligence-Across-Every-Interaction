/**
 * Types for Cognitive Email Labeling System
 * Stored in agent config customLabels.
 */

export interface CustomLabel {
    id: string;
    name: string;
    color: string;
    description?: string;
    parentId?: string;
    autoApply: boolean;
    confidence: number;
    patterns: LabelPattern[];
    applications: LabelApplication[];
    createdAt: string;
    updatedAt: string;
    userContext?: string;
    customRules?: CustomRule[];
    confidenceThreshold: number;
    useLLMFallback: boolean;
}

export interface LabelPattern {
    type: "sender_domain" | "sender_email" | "subject_keyword" | "body_keyword" | "structure" | "custom_rule";
    value: string;
    ruleId?: string;
    weight: number;
    examples: string[];
    successRate: number;
}

export interface CustomRule {
    id: string;
    type: "sender_is_me" | "sender_equals_recipient" | "domain_match" | "keyword_match" | "subject_contains" | "from_contains";
    description: string;
    value?: string;
    weight: number;
    enabled: boolean;
    createdAt: string;
}

export interface LabelApplication {
    emailId: string;
    appliedBy: "user" | "auto" | "suggested";
    confidence?: number;
    timestamp: string;
    wasRemoved?: boolean;
}

export interface LabelPrediction {
    label: CustomLabel;
    confidence: number;
    matchedPatterns: LabelPattern[];
    matchedRules?: CustomRule[];
    method?: "pattern" | "llm";
}

export interface LabelSuggestion {
    name: string;
    description: string;
    sampleEmails: {
        id: string;
        subject: string;
        from: string;
    }[];
    estimatedCount: number;
    patterns: LabelPattern[];
}

export interface Email {
    id: string;
    subject: string;
    from: string;
    to?: string;
    snippet?: string;
    body?: string;
    category?: string;
    priority?: string;
    date: string;
    labels?: string[];
}
