export type ActivityType =
  | "connection"
  | "sync"
  | "jira_task"
  | "notion_page"
  | "automation"
  | "spam_rescue";

export type SocialChannel = "instagram" | "linkedin" | "twitter";

export interface SocialConnectionState {
  accountId?: string;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  status?: "connected" | "disconnected";
}

export interface DashboardMetricsSnapshot {
  connectedChannels: number;
  totalChannels: number;
  connections: {
    gmail: boolean;
    instagram: boolean;
    linkedin: boolean;
    twitter: boolean;
    jira: boolean;
  };
  activity: {
    totalUpdates: number;
    failedUpdates: number;
    pendingUpdates: number;
    outboundRate: number;
    outboundCount: number;
    inboundCount: number;
  };
  email: {
    totalEmails: number;
    unreadEmails: number;
    highPriorityEmails: number;
  };
  social: {
    instagramRecipients: number;
    linkedinRecipients: number;
    twitterRecipients: number;
  };
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  type: ActivityType;
  action: string;
  details: string;
  status: "success" | "failed" | "pending";
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface RuleCondition {
  field: "subject" | "from" | "body" | "category" | "priority";
  operator: "contains" | "equals" | "not_equals";
  value: string;
}

export interface RuleAction {
  type: "create_jira_task" | "save_to_notion" | "send_slack_message";
  config: Record<string, string>;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditionOperator?: "AND" | "OR";
  conditions: RuleCondition[];
  action: RuleAction;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentConfig {
  gmailEmail?: string;
  gmailProfileName?: string;
  gmailProfilePicture?: string;
  emailProvider?: "gmail" | "outlook" | "zoho" | null;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  syncPreferences?: Record<string, unknown>;
  corrections?: unknown[];
  automationRules?: AutomationRule[];
  activityLogs?: ActivityLog[];
  automationProcessedIds?: string[];
  connectedTools?: string[];
  jira?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    cloudId?: string;
    siteUrl?: string;
    siteName?: string;
  };
  notion?: {
    accessToken: string;
    workspaceId?: string;
    workspaceName?: string;
    workspaceIcon?: string | null;
    selectedDatabaseId?: string | null;
    databases?: Array<{ id: string; title: string; icon: string | null; url: string }>;
  };
  slack?: {
    accessToken: string;
    teamName?: string;
    teamId?: string;
    defaultChannelId?: string;
  };
  jiraProjectKey?: string;
  autoCreateJiraTasks?: boolean;
  socialConnections?: Partial<Record<SocialChannel, SocialConnectionState>>;
  directMessageRecipients?: Partial<Record<SocialChannel, string[]>>;
  socialOnboardingCompleted?: boolean;
}

export interface StoredEmail {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  snippet: string;
  body?: string;
  date: string;
  labels?: string[];
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  priorityScore?: number;
  read?: boolean;
  isRead?: boolean;
  attachments?: Array<{ filename: string; mimeType: string; size?: number }>;
}

export interface AgentData {
  gmailConnected?: boolean;
  connectedAt?: string;
  gmailEmail?: string;
  emails?: StoredEmail[];
  lastSync?: string;
  stats?: {
    total: number;
    classified: number;
    gmailLabelsSuppressed: number;
    senderRulesSuppressed: number;
    llmCalled: number;
    categories: Record<string, number>;
    newInLastSync?: number;
  };
  dashboardMetrics?: DashboardMetricsSnapshot;
}
