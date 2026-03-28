function getAppUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

// Re-export Spinabot integration registry helpers for Gmail editor compatibility.
export {
  getAllIntegrations,
  getIntegration,
  getToolIntegrations,
  getConnectionStates,
  buildDisconnectPatch,
} from "./integrations/registry";
export type { IntegrationDefinition, IntegrationId, IntegrationType } from "./integrations/types";

export function getJiraAuthUrl(state: string): string {
  const clientId = process.env.JIRA_CLIENT_ID;
  if (!clientId) throw new Error("JIRA_CLIENT_ID missing");

  const redirectUri = `${getAppUrl()}/api/standalone-agents/gmail-classifier/jira-callback`;
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: "read:jira-work write:jira-work offline_access",
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

export async function exchangeJiraCodeForTokens(code: string) {
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: `${getAppUrl()}/api/standalone-agents/gmail-classifier/jira-callback`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Jira token exchange failed: ${await response.text()}`);
  }

  return response.json();
}

export async function getJiraAccessibleResources(accessToken: string) {
  const response = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error("Failed to get Jira resources");
  return response.json() as Promise<Array<{ id: string; name: string; url: string }>>;
}

export async function getJiraProjects(accessToken: string, cloudId: string) {
  const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Failed to list Jira projects");
  return response.json() as Promise<Array<{ id: string; key: string; name: string }>>;
}

export async function createJiraIssue(
  accessToken: string,
  cloudId: string,
  payload: {
    projectKey: string;
    summary: string;
    description: string;
    issueType?: string;
    priority?: "Low" | "Medium" | "High";
  }
) {
  const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: payload.projectKey },
        summary: payload.summary,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: payload.description }],
            },
          ],
        },
        issuetype: { name: payload.issueType || "Task" },
        priority: payload.priority ? { name: payload.priority } : undefined,
      },
    }),
  });

  if (!response.ok) throw new Error(`Failed to create Jira issue: ${await response.text()}`);
  return response.json();
}

export function getNotionAuthUrl(state: string): string {
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) throw new Error("NOTION_CLIENT_ID missing");

  const redirectUri = `${getAppUrl()}/api/standalone-agents/gmail-classifier/notion-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    owner: "user",
    redirect_uri: redirectUri,
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

export async function exchangeNotionCodeForTokens(code: string) {
  const auth = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${getAppUrl()}/api/standalone-agents/gmail-classifier/notion-callback`,
    }),
  });

  if (!response.ok) throw new Error(`Notion token exchange failed: ${await response.text()}`);
  return response.json();
}

export async function notionSearch(accessToken: string, query = "") {
  const response = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      filter: {
        value: "database",
        property: "object",
      },
    }),
  });

  if (!response.ok) throw new Error(`Notion search failed: ${await response.text()}`);
  return response.json();
}

export async function notionCreatePage(accessToken: string, databaseId: string, title: string, body: string) {
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        title: {
          title: [{ text: { content: title } }],
        },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: body } }] },
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Notion create page failed: ${await response.text()}`);
  return response.json();
}

export function getSlackAuthUrl(state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error("SLACK_CLIENT_ID missing");

  const redirectUri = `${getAppUrl()}/api/standalone-agents/gmail-classifier/slack-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "chat:write,channels:read,groups:read,users:read",
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(code: string) {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.SLACK_CLIENT_ID || "",
      client_secret: process.env.SLACK_CLIENT_SECRET || "",
      redirect_uri: `${getAppUrl()}/api/standalone-agents/gmail-classifier/slack-callback`,
    }),
  });

  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "Slack token exchange failed");
  return json;
}

export async function sendSlackMessage(accessToken: string, channel: string, text: string) {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });

  return response.json();
}
