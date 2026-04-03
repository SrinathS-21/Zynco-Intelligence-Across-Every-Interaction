import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Path to store tokens locally for the POC
// In production, these should be in the database
const TOKEN_PATH = path.join(process.cwd(), '.google_tokens.json');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

export function getGoogleAuthUrl() {
    const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });
}

export async function isGoogleConnected() {
    return fs.existsSync(TOKEN_PATH);
}

export async function saveTokens(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    return tokens;
}

export function loadSavedCredentials() {
    if (fs.existsSync(TOKEN_PATH)) {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        oauth2Client.setCredentials(tokens);
        return oauth2Client;
    }
    return null;
}

export const googleSheets = google.sheets({ version: 'v4', auth: oauth2Client });
export const googleCalendar = google.calendar({ version: 'v3', auth: oauth2Client });
