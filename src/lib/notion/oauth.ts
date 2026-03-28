import { fetchWithRetry } from "@/lib/api-utils";

const NOTION_AUTH_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const NOTION_API_BASE = "https://api.notion.com/v1";

/**
 * Generate Notion OAuth authorization URL
 */
export function getNotionAuthUrl(state: string): string {
    const clientId = process.env.NOTION_CLIENT_ID;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/standalone-agents/gmail-classifier/notion-callback`;

    if (!clientId) {
        throw new Error("NOTION_CLIENT_ID not configured");
    }

    const authUrl = new URL(NOTION_AUTH_URL);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("state", state);

    return authUrl.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForTokens(code: string) {
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/standalone-agents/gmail-classifier/notion-callback`;

    if (!clientId || !clientSecret) {
        throw new Error("NOTION_CLIENT_ID and NOTION_CLIENT_SECRET not configured");
    }

    // Notion requires Basic Auth header with client_id:client_secret
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetchWithRetry(NOTION_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${credentials}`,
        },
        body: JSON.stringify({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: redirectUri,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("[Notion OAuth] Token exchange failed:", error);
        throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        workspaceId: data.workspace_id,
        workspaceName: data.workspace_name,
        workspaceIcon: data.workspace_icon,
        botId: data.bot_id,
        owner: data.owner,
        duplicatedTemplateId: data.duplicated_template_id,
    };
}

/**
 * List user's databases that the integration has access to
 */
export async function listDatabases(accessToken: string) {
    const response = await fetchWithRetry(`${NOTION_API_BASE}/search`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
            filter: {
                value: "database",
                property: "object",
            },
            sort: {
                direction: "descending",
                timestamp: "last_edited_time",
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list databases: ${error}`);
    }

    const data = await response.json();

    // Extract database info
    return data.results.map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || "Untitled",
        icon: db.icon?.emoji || db.icon?.external?.url || null,
        url: db.url,
    }));
}

/**
 * Create a page in a Notion database (for saving emails)
 */
export async function createPageInDatabase(
    accessToken: string,
    databaseId: string,
    properties: {
        title: string;
        from: string;
        date: string;
        category: string;
        content: string;
        priority?: string;
    }
) {
    // 1. Fetch database meta to find title property name
    let titlePropertyName = 'Name';
    try {
        const dbResponse = await fetchWithRetry(`${NOTION_API_BASE}/databases/${databaseId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Notion-Version": "2022-06-28",
            },
        });
        if (dbResponse.ok) {
            const dbData = await dbResponse.json();
            const titleProp = Object.entries(dbData.properties).find(([_, prop]: [string, any]) => prop.type === 'title');
            if (titleProp) {
                titlePropertyName = titleProp[0];
            }
        }
    } catch (e) {
        console.error("[Notion OAuth] Failed to fetch database schema, falling back to 'Name'", e);
    }

    const response = await fetchWithRetry(`${NOTION_API_BASE}/pages`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
            parent: { database_id: databaseId },
            properties: {
                [titlePropertyName]: {
                    title: [{ text: { content: properties.title } }],
                },
            },
            children: [
                {
                    object: "block",
                    type: "heading_2",
                    heading_2: {
                        rich_text: [{ type: "text", text: { content: "Email Details" } }],
                    },
                },
                {
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: [{ type: "text", text: { content: `From: ${properties.from}` } }],
                    },
                },
                {
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: [{ type: "text", text: { content: `Date: ${properties.date}` } }],
                    },
                },
                {
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: [{ type: "text", text: { content: `Category: ${properties.category}` } }],
                    },
                },
                {
                    object: "block",
                    type: "divider",
                    divider: {},
                },
                {
                    object: "block",
                    type: "heading_2",
                    heading_2: {
                        rich_text: [{ type: "text", text: { content: "Content" } }],
                    },
                },
                {
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                        rich_text: [{
                            type: "text",
                            text: { content: properties.content.slice(0, 2000) }, // Notion has a 2000 char limit per text block
                        }],
                    },
                },
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create page: ${error}`);
    }

    const data = await response.json();

    return {
        pageId: data.id,
        url: data.url,
    };
}
