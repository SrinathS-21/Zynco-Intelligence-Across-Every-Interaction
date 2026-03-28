import { fetchWithRetry } from "@/lib/api-utils";

export interface NotionSearchResult {
    id: string;
    title: string;
    type: 'database' | 'page';
    icon?: string;
}

export class NotionClient {
    private accessToken: string;
    private baseUrl = 'https://api.notion.com/v1';

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    private async request(endpoint: string, method: string, body?: any) {
        const response = await fetchWithRetry(`${this.baseUrl}${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Notion API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
    }

    async search(query: string = '', filter?: 'database' | 'page'): Promise<NotionSearchResult[]> {
        const body: any = {
            query,
            sort: {
                direction: 'descending',
                timestamp: 'last_edited_time'
            },
            page_size: 20
        };

        if (filter) {
            body.filter = {
                value: filter,
                property: 'object'
            };
        }

        const response = await this.request('/search', 'POST', body);

        return response.results.map((item: any) => {
            let title = "Untitled";

            if (item.object === 'database' && item.title) {
                title = item.title?.[0]?.plain_text || "Untitled";
            } else if (item.object === 'page' && item.properties) {
                // Robustly find the property of type 'title', regardless of its name (Name, Title, Task, etc.)
                const titleProp = Object.values(item.properties).find((p: any) => p.type === 'title') as any;
                if (titleProp?.title?.[0]?.plain_text) {
                    title = titleProp.title[0].plain_text;
                }
            }

            const icon = item.icon?.emoji || item.icon?.external?.url || item.icon?.file?.url;

            return {
                id: item.id,
                title,
                type: item.object === 'database' ? 'database' : 'page',
                icon
            };
        });
    }

    async getDatabase(databaseId: string) {
        return this.request(`/databases/${databaseId}`, 'GET');
    }

    async createPageWithParentType(title: string, content: string, parentId: string, parentType: 'database' | 'page') {
        const parent = parentType === 'database'
            ? { database_id: parentId }
            : { page_id: parentId };

        const blocks: any[] = [];

        // Split content into blocks
        if (content && content.trim()) {
            // First, try splitting by double newlines (paragraphs)
            let paragraphs = content.split('\n\n').filter(p => p.trim());

            // If no double newlines, split by single newlines
            if (paragraphs.length === 1 && content.includes('\n')) {
                paragraphs = content.split('\n').filter(p => p.trim());
            }

            // If still just one block, use the whole content
            if (paragraphs.length === 0) {
                paragraphs = [content];
            }

            paragraphs.forEach(p => {
                const trimmed = p.trim();
                if (trimmed) {
                    // Notion has a 2000 character limit per rich text block
                    // Split long paragraphs into chunks
                    const chunks = [];
                    for (let i = 0; i < trimmed.length; i += 2000) {
                        chunks.push(trimmed.substring(i, i + 2000));
                    }

                    chunks.forEach(chunk => {
                        blocks.push({
                            object: 'block',
                            type: 'paragraph',
                            paragraph: {
                                rich_text: [{ type: 'text', text: { content: chunk } }]
                            }
                        });
                    });
                }
            });
        }

        // If no blocks created, add at least one empty paragraph
        if (blocks.length === 0) {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ type: 'text', text: { content: '' } }]
                }
            });
        }

        let body: any = {
            parent,
            children: blocks
        };

        if (parentType === 'page') {
            body.properties = {
                title: [
                    {
                        text: {
                            content: title
                        }
                    }
                ]
            };
        } else {
            // Database parent
            // We need to find the property name of type 'title'. It's usually 'Name' or 'Title'
            let titlePropertyName = 'Name';
            try {
                const db = await this.getDatabase(parentId);
                const titleProperty = Object.entries(db.properties).find(([_, prop]: [string, any]) => prop.type === 'title');
                if (titleProperty) {
                    titlePropertyName = titleProperty[0];
                    console.log(`[NotionClient] Using title property: ${titlePropertyName}`);
                }
            } catch (err) {
                console.error('[NotionClient] Error fetching database schema:', err);
                // Fallback to Name
            }

            body.properties = {
                [titlePropertyName]: {
                    title: [
                        {
                            text: {
                                content: title
                            }
                        }
                    ]
                }
            };
        }

        return this.request('/pages', 'POST', body);
    }
}
