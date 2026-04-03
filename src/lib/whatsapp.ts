import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { prisma } from './db';
import { addMinutes, isPast } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

declare global {
  // eslint-disable-next-line no-var
  var __whatsappClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __whatsappQr: string | undefined;
  // eslint-disable-next-line no-var
  var __whatsappStatus: 'INITIALIZING' | 'READY' | 'QR' | 'DISCONNECTED' | 'AUTHENTICATING';
  // eslint-disable-next-line no-var
  var __whatsappRule: any | undefined;
  // eslint-disable-next-line no-var
  var __whatsappInitPromise: Promise<any> | undefined;
}

global.__whatsappStatus = global.__whatsappStatus || 'DISCONNECTED';

export const getWhatsAppClient = async () => {
    // 1. Re-use existing connected client
    if (global.__whatsappClient && (global.__whatsappStatus === 'READY' || global.__whatsappStatus === 'QR')) {
        return global.__whatsappClient;
    }

    // 2. Await already running initialization promise
    if (global.__whatsappInitPromise) {
        return global.__whatsappInitPromise;
    }

    // 3. Start a new clean bootstrap
    console.log('🚀 [WHATSAPP] Starting clean bootstrap sequence...');
    global.__whatsappInitPromise = (async () => {
        try {
            const sessionPath = path.join(process.cwd(), '.wwebjs_auth/session-zynco-hub');
            
            // Kernel-level force purge of any orphaned browsers using our profile
            try {
                const killCmd = `ps aux | grep "${sessionPath}" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true`;
                execSync(killCmd);
                
                if (fs.existsSync(sessionPath)) {
                    const files = fs.readdirSync(sessionPath);
                    for (const file of files) {
                        if (file.startsWith('Single')) {
                            try { fs.unlinkSync(path.join(sessionPath, file)); } catch (e) {}
                        }
                    }
                }
            } catch (e) {
                console.warn('Silent cleanup bypass.');
            }

            // Sync OS handles
            await new Promise(resolve => setTimeout(resolve, 3000));

            const client = new Client({
                authStrategy: new LocalAuth({ 
                    clientId: "zynco-hub",
                    dataPath: "./.wwebjs_auth" 
                }),
                puppeteer: {
                    headless: true,
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
                        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    ],
                }
            });

            client.on('qr', async (qr) => {
                console.log('WhatsApp QR Generated');
                global.__whatsappQr = await qrcode.toDataURL(qr);
                global.__whatsappStatus = 'QR';
            });

            client.on('ready', () => {
                console.log('WhatsApp Client Online');
                global.__whatsappStatus = 'READY';
                global.__whatsappQr = undefined;
                startScheduler();
            });

            client.on('authenticated', () => {
                console.log('WhatsApp Authenticated (Mapping to READY)...');
                global.__whatsappStatus = 'READY';
                global.__whatsappQr = undefined;
            });

            client.on('auth_failure', () => {
                console.error('WhatsApp Auth failure');
                resetGlobal();
            });

            client.on('disconnected', () => {
                console.log('WhatsApp Socket Terminated');
                resetGlobal();
            });

            client.on('message', async (msg) => {
                const currentPrisma = global.__mailAgentPrisma || prisma;
                if (!currentPrisma) return;

                try {
                    const contact = await msg.getContact();
                    await currentPrisma.unifiedMessage.create({
                        data: {
                            userId: 'default',
                            platform: 'whatsapp',
                            contactId: msg.from,
                            contactName: contact.pushname || contact.name || msg.from.split('@')[0],
                            content: msg.body,
                            direction: 'INBOUND',
                        }
                    });

                    // --- AI AUTO-RESPONDER ENGINE ---
                    if (global.__whatsappRule) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); 
                        const persona = global.__whatsappRule.persona || 'friendly assistant';
                        const responseText = `*[Zynco AI]* Thanks for reaching out! I'm acting as a ${persona} today.\n\n_Auto-Reply Active._`;
                        await msg.reply(responseText);
                        
                        await currentPrisma.unifiedMessage.create({
                            data: {
                                userId: 'default', platform: 'whatsapp', contactId: msg.from,
                                contactName: contact.pushname || contact.name || msg.from.split('@')[0],
                                content: responseText, direction: 'OUTBOUND',
                            }
                        });
                    }
                } catch (err) { console.error('Message save failed:', err); }
            });

            global.__whatsappStatus = 'INITIALIZING';
            await client.initialize();
            
            global.__whatsappClient = client;
            global.__whatsappInitPromise = undefined; // Clear the init promise once fully booted
            return client;

        } catch (error) {
            console.error('Critical WhatsApp Startup Failure:', error);
            resetGlobal();
            throw error;
        }
    })();

    return global.__whatsappInitPromise;
};

function resetGlobal() {
    global.__whatsappClient = undefined;
    global.__whatsappInitPromise = undefined;
    global.__whatsappStatus = 'DISCONNECTED';
    global.__whatsappQr = undefined;
}

export const getWhatsAppStatus = () => ({
    status: global.__whatsappStatus || 'DISCONNECTED',
    qr: global.__whatsappQr
});

export const resetWhatsApp = async () => {
    if (global.__whatsappClient) {
        try { await global.__whatsappClient.destroy(); } catch (e) {}
    }
    resetGlobal();
};

// Existing Scheduler
let schedulerRunning = false;
const startScheduler = () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    setInterval(async () => {
        if (global.__whatsappStatus !== 'READY' || !global.__whatsappClient) return;
        const currentPrisma = global.__mailAgentPrisma || prisma;
        if (!currentPrisma || !currentPrisma.scheduledMessage) return;
        try {
            const pending = await currentPrisma.scheduledMessage.findMany({
                where: { status: 'PENDING', platform: 'whatsapp', scheduledFor: { lte: new Date() } }
            });
            for (const msg of pending) {
                try {
                    await global.__whatsappClient!.sendMessage(msg.to, msg.content);
                    await currentPrisma.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'SENT' } });
                } catch (err) {
                    await currentPrisma.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'FAILED' } });
                }
            }
        } catch (e) {}
    }, 60000);
};
