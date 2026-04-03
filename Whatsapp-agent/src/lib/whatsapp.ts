import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';

// Support for singleton pattern in Next.js development
declare global {
    var whatsappClient: Client | undefined;
    var whatsappInitPromise: Promise<any> | undefined;
    var qrCodeData: string | null | undefined;
    var connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | undefined;
}

let lastInitAttempt = 0;

/**
 * Initializes the WhatsApp client.
 * Optimized for development speed and reliability.
 */
export const initWhatsApp = async (): Promise<any> => {
    // 1. Return client if ALREADY connected
    if (globalThis.whatsappClient && globalThis.connectionStatus === 'CONNECTED') {
        return globalThis.whatsappClient;
    }

    // 2. Throttle initialization attempts (don't retry more than once every 30 seconds if failed recently)
    const now = Date.now();
    if (globalThis.connectionStatus === 'DISCONNECTED' && (now - lastInitAttempt < 30000)) {
        console.log('🕒 [WHATSAPP] Throttling init attempt (recently failed). Waiting 30s...');
        return null;
    }

    // 3. Re-use existing initialization promise if one is already running
    if (globalThis.whatsappInitPromise) {
        return globalThis.whatsappInitPromise;
    }

    lastInitAttempt = now;
    globalThis.connectionStatus = 'CONNECTING';

    // 4. Start a new initialization
    globalThis.whatsappInitPromise = (async () => {
        try {
            console.log('🚀 [WHATSAPP] Starting initialization (Launching Browser)...');

            const sessionPath = path.join(process.cwd(), '.wwebjs_auth/session-hospital-bot');
            const lockFile = path.join(sessionPath, 'SingletonLock');

            const performCleanup = () => {
                if (fs.existsSync(lockFile)) {
                    console.log('🧹 [WHATSAPP] Found stale lock, attempting deep cleanup...');
                    try {
                        const { execSync } = require('child_process');
                        // More specific kill to avoid killing user's primary browser
                        try {
                            // On Mac/Linux, this kills processes that have the session path in their arguments
                            execSync(`ps aux | grep "${sessionPath}" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true`);
                            console.log('🔫 [WHATSAPP] Killed specific zombie browser processes');
                        } catch (pe) { }

                        if (fs.existsSync(lockFile)) {
                            fs.unlinkSync(lockFile);
                            console.log('🗑️ [WHATSAPP] Successfully unlinked SingletonLock');
                        }
                    } catch (e: any) {
                        console.warn(`⚠️ [WHATSAPP] Lock cleanup warning: ${e.message}`);
                    }
                }
            };

            performCleanup();

            // Give the OS a moment to reclaim handles
            await new Promise(resolve => setTimeout(resolve, 2000));

            const proxyUrl = process.env.WHATSAPP_PROXY_URL;
            const userAgent = process.env.WHATSAPP_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: "hospital-bot",
                    dataPath: path.join(process.cwd(), '.wwebjs_auth')
                }),
                puppeteer: {
                    headless: true,
                    executablePath: process.env.CHROME_PATH || undefined,
                    handleSIGINT: true,
                    handleSIGTERM: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu',
                        '--disable-canvas-aa',
                        '--disable-2d-canvas-clip-aa',
                        '--disable-gl-drawing-for-tests',
                        '--disable-notifications',
                        '--disable-extensions',
                        '--disable-blink-features=AutomationControlled',
                        `--user-agent=${userAgent}`,
                        ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
                    ],
                }
            });

            // ... other events ...
            client.once('qr', (qr) => {
                console.log('📲 [WHATSAPP] QR Code ready');
                qrcode.toDataURL(qr).then(url => { globalThis.qrCodeData = url; });
            });

            client.once('ready', () => {
                console.log('🟢 [WHATSAPP] Bot is fully ONLINE');
                globalThis.connectionStatus = 'CONNECTED';
                globalThis.qrCodeData = null;
            });

            client.on('authenticated', () => {
                console.log('🔓 [WHATSAPP] Authentication Successful');
            });

            client.on('message', async (msg) => {
                try {
                    const { handleWhatsAppMessage } = await import('./bot-logic');
                    await handleWhatsAppMessage(msg);
                } catch (err) {
                    console.error('❌ [WHATSAPP] Error processing message:', err);
                }
            });

            await client.initialize();
            globalThis.whatsappClient = client;
            return client;

        } catch (error: any) {
            console.error('❌ [WHATSAPP] Critical Init Failure:', error.message);

            // Specific check for already running error
            if (error.message.includes('already running') || error.message.includes('userDataDir')) {
                console.log('🔄 [WHATSAPP] Detected specific lock error. Forcing immediate cleanup for next attempt...');
                const sessionPath = path.join(process.cwd(), '.wwebjs_auth/session-hospital-bot');
                const lockFile = path.join(sessionPath, 'SingletonLock');
                if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
                const { execSync } = require('child_process');
                try { execSync(`ps aux | grep "${sessionPath}" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true`); } catch (e) { }
            }

            resetGlobal();
            return null;
        }
    })();

    return globalThis.whatsappInitPromise;
};

function resetGlobal() {
    globalThis.whatsappInitPromise = undefined;
    globalThis.whatsappClient = undefined;
    globalThis.connectionStatus = 'DISCONNECTED';
}

export const getWhatsAppStatus = () => ({
    status: globalThis.connectionStatus || 'DISCONNECTED',
    qr: globalThis.qrCodeData || null
});

export const getWhatsAppClient = () => globalThis.whatsappClient;
