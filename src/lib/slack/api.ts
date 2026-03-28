import { fetchWithRetry } from "@/lib/api-utils";

const SLACK_API_URL = 'https://slack.com/api';

interface SlackTokenResponse {
    ok: boolean;
    access_token?: string;
    bot_user_id?: string;
    team?: { name: string; id: string };
    error?: string;
}

interface SlackMessageResponse {
    ok: boolean;
    error?: string;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeSlackCode(code: string): Promise<SlackTokenResponse> {
    const clientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/standalone-agents/gmail-classifier/slack-callback`;

    const formData = new URLSearchParams();
    formData.append('code', code);
    formData.append('client_id', clientId || '');
    formData.append('client_secret', clientSecret || '');
    formData.append('redirect_uri', redirectUri);

    const response = await fetchWithRetry(`${SLACK_API_URL}/oauth.v2.access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    });

    return await response.json();
}

/**
 * Send a message to a Slack channel
 */
export async function sendSlackMessage(
    token: string,
    channelId: string,
    text: string,
    blocks?: any[]
): Promise<SlackMessageResponse> {
    const response = await fetchWithRetry(`${SLACK_API_URL}/chat.postMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            channel: channelId,
            text: text,
            blocks: blocks
        })
    });

    return await response.json();
}

/**
 * Fetch public channels from Slack
 */
export async function fetchSlackChannels(token: string) {
    // Try to fetch both public and private channels
    const response = await fetchWithRetry(`${SLACK_API_URL}/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=1000`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();

    // If it fails with missing_scope (most likely due to private_channel/groups:read), fallback to public ONLY
    if (!data.ok && data.error === 'missing_scope') {
        console.warn("[Slack API] Missing groups:read scope, falling back to public channels only.");
        const fallbackRes = await fetchWithRetry(`${SLACK_API_URL}/conversations.list?types=public_channel&exclude_archived=true&limit=1000`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return await fallbackRes.json();
    }

    return data;
}
