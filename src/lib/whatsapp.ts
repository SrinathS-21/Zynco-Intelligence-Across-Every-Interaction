import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { prisma } from './db';
import { addMinutes, isPast } from 'date-fns';

declare global {
  // eslint-disable-next-line no-var
  var __whatsappClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __whatsappQr: string | undefined;
  // eslint-disable-next-line no-var
  var __whatsappStatus: 'INITIALIZING' | 'READY' | 'QR' | 'DISCONNECTED' | 'AUTHENTICATING';
}

global.__whatsappStatus = global.__whatsappStatus || 'DISCONNECTED';

export const getWhatsAppClient = () => {
    if (global.__whatsappClient) return global.__whatsappClient;

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
                '--disable-gpu'
            ],
        }
    });

    client.on('qr', async (qr) => {
        console.log('WhatsApp QR Received');
        global.__whatsappQr = await qrcode.toDataURL(qr);
        global.__whatsappStatus = 'QR';
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        global.__whatsappStatus = 'READY';
        global.__whatsappQr = undefined;
        
        // Start scheduler when ready
        startScheduler();
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
            console.log(`Saved WhatsApp Message from ${msg.from}`);
        } catch (err) {
            console.error('Failed to save message:', err);
        }
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Authenticated');
        global.__whatsappStatus = 'AUTHENTICATING';
    });

    client.on('auth_failure', (msg) => {
        console.error('WhatsApp Auth failure', msg);
        global.__whatsappStatus = 'DISCONNECTED';
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp Disconnected:', reason);
        global.__whatsappStatus = 'DISCONNECTED';
        global.__whatsappClient = undefined;
        global.__whatsappQr = undefined;
    });

    try {
        client.initialize().catch(err => {
            console.error('Initial initialization failed:', err);
            global.__whatsappStatus = 'DISCONNECTED';
        });
    } catch (err) {
        console.error('WhatsApp bootstrap error:', err);
    }

    global.__whatsappClient = client;
    global.__whatsappStatus = 'INITIALIZING';

    return client;
};

export const resetWhatsApp = async () => {
    if (global.__whatsappClient) {
        try {
            await global.__whatsappClient.destroy();
        } catch (e) {
            console.error('Error destroying client:', e);
        }
        global.__whatsappClient = undefined;
    }
    global.__whatsappStatus = 'DISCONNECTED';
    global.__whatsappQr = undefined;
};

export const getWhatsAppStatus = () => ({
    status: global.__whatsappStatus,
    qr: global.__whatsappQr
});

// Scheduler implementation
let schedulerRunning = false;
const startScheduler = () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    
    console.log('WhatsApp Scheduler Started');
    
    setInterval(async () => {
        if (global.__whatsappStatus !== 'READY' || !global.__whatsappClient) return;
        
        // Use global prisma or fallback to the direct import
        // This avoids issues with closures capturing stale values in some environments
        const currentPrisma = global.__mailAgentPrisma || prisma;
        if (!currentPrisma) {
            console.error('Prisma client not initialized yet for WhatsApp Scheduler');
            return;
        }

        if (!currentPrisma.scheduledMessage) {
            console.error('CRITICAL: ScheduledMessage model NOT found in Prisma client! A dev server RESTART is required.');
            return;
        }

        try {
            const pending = await currentPrisma.scheduledMessage.findMany({
                where: {
                    status: 'PENDING',
                    platform: 'whatsapp',
                    scheduledFor: {
                        lte: new Date() // Past or now
                    }
                },
                take: 5 // Process in small batches
            });
            
            for (const msg of pending) {
                console.log(`Sending scheduled WhatsApp message to ${msg.to}...`);
                try {
                    // msg.to should already be normalized if saved via our API
                    // but we ensure it here just in case
                    const client = global.__whatsappClient;
                    
                    // Already an ID format number@c.us
                    if (msg.to.includes('@')) {
                        await client.sendMessage(msg.to, msg.content);
                    } else {
                        // Try to resolve if it's just a number
                        const cleanNumber = msg.to.replace(/\D/g, '');
                        const numberId = await client.getNumberId(cleanNumber);
                        if (numberId) {
                            await client.sendMessage(numberId._serialized, msg.content);
                        } else {
                            throw new Error('Number not on WhatsApp');
                        }
                    }
                    
                    await currentPrisma.scheduledMessage.update({
                        where: { id: msg.id },
                        data: { status: 'SENT' }
                    });
                    console.log(`Scheduled message ${msg.id} sent successfully!`);
                } catch (err) {
                    console.error(`Failed to send ${msg.id}:`, err);
                    await currentPrisma.scheduledMessage.update({
                        where: { id: msg.id },
                        data: { status: 'FAILED' }
                    });
                }
            }
        } catch (err) {
            console.error('Scheduler error:', err);
        }
    }, 15000); // Check more frequently (15s) for better responsiveness
};
