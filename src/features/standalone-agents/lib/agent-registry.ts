/**
 * Central registry for all standalone cognitive agents
 * This file defines all available agents and their metadata
 */

export const AGENT_TYPES = {
  AI_LEAD_GENERATOR: "AI_LEAD_GENERATOR",
  COLD_WRITER: "COLD_WRITER",
  FOLLOWUP_PRO: "FOLLOWUP_PRO",
  CRM_LOGGER: "CRM_LOGGER",
  INSIGHT_BOT: "INSIGHT_BOT",
  GMAIL_CLASSIFIER: "GMAIL_CLASSIFIER",
  LINKEDIN_SCHEDULER: "LINKEDIN_SCHEDULER",
} as const;

export type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];

/**
 * Agent status types
 */
export const AGENT_STATUS = {
  DRAFT: "DRAFT",
  CONFIGURED: "CONFIGURED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
} as const;

export type AgentStatus = typeof AGENT_STATUS[keyof typeof AGENT_STATUS];

/**
 * Agent metadata for marketplace display
 */
export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  status: "live" | "coming-soon";
  icon: string; // Icon name from lucide-react
  tags: string[];
  features: string[];
}

/**
 * Registry of all available agents with their metadata
 */
export const AGENT_REGISTRY: Record<string, AgentMetadata> = {
  [AGENT_TYPES.AI_LEAD_GENERATOR]: {
    id: "ai-lead-generator",
    name: "LeadGenAI",
    description: "Discovers and qualifies leads that match your ICP using AI-enhanced sourcing.",
    status: "live",
    icon: "SparklesIcon",
    tags: ["Lead sourcing", "Qualification", "Auto-routing"],
    features: ["AI-powered lead discovery", "Intelligent qualification", "Auto CRM routing"],
  },
  [AGENT_TYPES.COLD_WRITER]: {
    id: "cold-writer",
    name: "ColdWriter",
    description: "Crafts hyper-personalized cold emails and LinkedIn messages with intent signals.",
    status: "coming-soon",
    icon: "MailIcon",
    tags: ["Personalization", "Outreach", "Copy"],
    features: ["Hyper-personalized copy", "Intent signal detection", "Multi-channel outreach"],
  },
  [AGENT_TYPES.FOLLOWUP_PRO]: {
    id: "followup-pro",
    name: "FollowUpPro",
    description: "Manages follow-ups with timing and tone optimization to lift reply rates.",
    status: "coming-soon",
    icon: "BarChart3Icon",
    tags: ["Follow-ups", "Timing", "Optimization"],
    features: ["Smart timing optimization", "Tone adjustment", "Reply rate boosting"],
  },
  [AGENT_TYPES.CRM_LOGGER]: {
    id: "crm-logger",
    name: "CRMLogger",
    description: "Syncs lead status changes and notes to your CRM and workspace tools.",
    status: "coming-soon",
    icon: "BotIcon",
    tags: ["CRM sync", "Activity logs", "Updates"],
    features: ["Real-time CRM sync", "Activity tracking", "Workspace integration"],
  },
  [AGENT_TYPES.INSIGHT_BOT]: {
    id: "insight-bot",
    name: "InsightBot",
    description: "Delivers weekly business development insights with clean dashboards.",
    status: "coming-soon",
    icon: "Users2Icon",
    tags: ["Analytics", "Dashboards", "Insights"],
    features: ["Weekly insights", "Visual dashboards", "Performance metrics"],
  },
  [AGENT_TYPES.GMAIL_CLASSIFIER]: {
    id: "gmail-classifier",
    name: "EmailClassifier",
    description: "AI-powered email classification with SPL optimization. Automatically categorizes, prioritizes, and routes emails.",
    status: "live",
    icon: "MailIcon",
    tags: ["Classification", "SPL", "Automation", "Gmail"],
    features: ["Gmail category integration", "SPL cost optimization", "Auto Jira tasks", "Smart routing"],
  },
  [AGENT_TYPES.LINKEDIN_SCHEDULER]: {
    id: "linkedin-scheduler",
    name: "PostFlow",
    description: "AI-powered LinkedIn post scheduler. Generate content strategies, schedule posts, and optimize your LinkedIn presence.",
    status: "live",
    icon: "LinkedinIcon",
    tags: ["LinkedIn", "Scheduling", "AI Content", "Social Media"],
    features: ["AI content strategy", "Post scheduling", "Content calendar", "Audience insights"],
  },
};

/**
 * Get all available agents as an array
 */
export function getAllAgents(): AgentMetadata[] {
  return Object.values(AGENT_REGISTRY);
}

/**
 * Get a specific agent by type
 */
export function getAgentMetadata(type: string): AgentMetadata | undefined {
  return AGENT_REGISTRY[type];
}

/**
 * Convert agent ID (kebab-case) to type (UPPER_SNAKE_CASE)
 */
export function agentIdToType(id: string): string {
  return id.toUpperCase().replace(/-/g, "_");
}

/**
 * Convert agent type (UPPER_SNAKE_CASE) to ID (kebab-case)
 */
export function agentTypeToId(type: string): string {
  return type.toLowerCase().replace(/_/g, "-");
}
