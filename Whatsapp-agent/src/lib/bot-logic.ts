import prisma from './prisma';
import { Message as WBMessage, MessageMedia } from 'whatsapp-web.js';
import { syncAppointmentToSheet, createCalendarEvent } from './google-sync';
import { generateAppointmentCard } from './card-generator';

let isProcessing = false;
const messageQueue: WBMessage[] = [];

/**
 * Main entry point for WhatsApp messages
 */
export async function handleWhatsAppMessage(msg: WBMessage) {
    messageQueue.push(msg);
    processQueue();
}

/**
 * Sequential processing of messages to avoid race conditions
 */
async function processQueue() {
    if (isProcessing || messageQueue.length === 0) return;
    isProcessing = true;
    const msg = messageQueue.shift();
    if (msg) {
        try {
            await handleSingleMessage(msg);
        } catch (error) {
            console.error('❌ [BOT LOGIC] Error processing message:', error);
        }
    }
    // Artificial gap between processing
    setTimeout(() => {
        isProcessing = false;
        processQueue();
    }, 1500);
}

// --- Configuration ---

const DEPARTMENTS = [
    { id: '1', name: 'Cardiology', doctorId: 'doc-cardio', doctorName: 'Dr. Michael Chen', specialty: 'Cardiologist' },
    { id: '2', name: 'Pediatrics', doctorId: 'doc-peds', doctorName: 'Dr. Emily White', specialty: 'Pediatrician' },
    { id: '3', name: 'General Medicine', doctorId: 'doc-gen', doctorName: 'Dr. Sarah Johnson', specialty: 'General Practitioner' },
    { id: '4', name: 'Orthopedics', doctorId: 'doc-ortho', doctorName: 'Dr. Robert Miller', specialty: 'Orthopedic Surgeon' },
    { id: '5', name: 'Dermatology', doctorId: 'doc-derm', doctorName: 'Dr. Lisa Wong', specialty: 'Dermatologist' },
];

const GREETING_TEXT = `Hello! Welcome to *SPINaBOT Health* 🏥 ✨

We're dedicated to providing you with the best healthcare experience. I am your digital assistant, ready to help you manage your visits.

*How can I assist you today?*
1️⃣ Book Appointment
2️⃣ Check Availability
3️⃣ Our Specialized Departments
4️⃣ Emergency Support

_Simply reply with the number (1, 2, 3, or 4)._`;

// --- Utility Functions ---

/**
 * Robust Date/Time Parser for rule-based flow
 */
function parseDateTime(input: string) {
    const now = new Date();
    let targetDate = new Date(now);
    let timeStr = "10:00 AM";

    const lower = input.toLowerCase();

    // 1. Date Logic
    if (lower.includes('today')) {
        // targetDate is today
    } else if (lower.includes('tomorrow')) {
        targetDate.setDate(now.getDate() + 1);
    } else if (lower.includes('day after')) {
        targetDate.setDate(now.getDate() + 2);
    } else {
        const dateMatch = input.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
        if (dateMatch) {
            let [_, d, m, y] = dateMatch;
            if (y.length === 2) y = '20' + y;
            const parsedDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
            if (!isNaN(parsedDate.getTime())) {
                targetDate = parsedDate;
            }
        }
    }

    // 2. Time Logic
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/gi;
    const matches = Array.from(input.matchAll(timeRegex));

    if (matches.length > 0) {
        const bestMatch = matches.find(m => m[2] || m[3]) || matches[0];
        let [_, h, min, ampm] = bestMatch;
        let hour = parseInt(h);
        let m = min || "00";
        let suffix = ampm ? ampm.toUpperCase() : (hour >= 9 && hour < 12 ? "AM" : (hour >= 1 && hour < 9 ? "PM" : (hour >= 12 ? "PM" : "AM")));

        if (hour > 12) {
            hour -= 12;
            suffix = "PM";
        }
        if (hour === 0) hour = 12;

        timeStr = `${hour}:${m} ${suffix}`;
    }

    const d = targetDate.getDate().toString().padStart(2, '0');
    const mon = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    const yr = targetDate.getFullYear();

    return {
        formattedDate: `${d}-${mon}-${yr}`,
        formattedTime: timeStr,
        isoDate: targetDate,
        standardized: `${d}-${mon}-${yr}, ${timeStr}`
    };
}

function sanitizeForWhatsApp(text: string): string {
    if (!text || typeof text !== 'string') return 'How can I help you today? 🏥';
    return text
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, '')
        .replace(/\u00AD/g, '')
        .trim();
}

async function sendHumanReply(msg: WBMessage, text: string, mediaPath?: string) {
    const chat = await msg.getChat();
    const safeText = sanitizeForWhatsApp(text);

    // Human-like delays
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
    await chat.sendSeen();
    await chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, 1500 + safeText.length * 15));

    let sentMsg;
    if (mediaPath) {
        try {
            const media = MessageMedia.fromFilePath(mediaPath);
            sentMsg = await chat.sendMessage(media, { caption: safeText });
        } catch (e) {
            sentMsg = await chat.sendMessage(safeText);
        }
    } else {
        sentMsg = await chat.sendMessage(safeText);
    }
    await chat.clearState();
    return sentMsg;
}

// --- Main Handler ---

async function handleSingleMessage(msg: WBMessage) {
    const phoneNumber = msg.from;
    const body = msg.body.trim();
    const lowerBody = body.toLowerCase();

    // 1. Patient lookup/creation
    let patient = await prisma.patient.findUnique({ where: { phoneNumber } });
    if (!patient) {
        patient = await prisma.patient.create({ data: { phoneNumber } });
    }

    // 2. Get or create active conversation
    let conversation = await prisma.conversation.findFirst({
        where: { patientId: patient.id, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' }
    });
    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: { patientId: patient.id, state: 'START' }
        });
    }

    // 3. Record incoming message
    await prisma.message.create({
        data: {
            conversationId: conversation.id,
            patientId: patient.id,
            role: 'user',
            content: body,
            type: 'text'
        }
    });

    const state = conversation.state || 'START';
    const metadata = (conversation.metadata as any) || {};

    // 4. Reset Command
    if (['hi', 'hello', 'menu', 'reset'].includes(lowerBody)) {
        await updateConversation(conversation.id, 'MENU', {});
        await respond(msg, conversation.id, patient.id, GREETING_TEXT);
        return;
    }

    // 5. State Machine
    switch (state) {
        case 'START':
        case 'MENU':
            if (body === '1') {
                const deptList = DEPARTMENTS.map(d => `${d.id}. ${d.name}`).join('\n');
                await updateConversation(conversation.id, 'ASK_DEPT', {});
                await respond(msg, conversation.id, patient.id, `Great! Let's book your appointment.\n\n*Which department do you need?*\n${deptList}\n\n_Reply with the number (1-5)._`);
            } else if (body === '4') {
                await respond(msg, conversation.id, patient.id, "🚨 *EMERGENCY SUPPORT*\n\nPlease call our 24/7 helpline immediately: *+1-800-SPINABOT*\n\nIf this is a life-threatening situation, please head to the nearest emergency room.");
            } else {
                await respond(msg, conversation.id, patient.id, GREETING_TEXT);
            }
            break;

        case 'ASK_DEPT':
            const selectedDept = DEPARTMENTS.find(d => d.id === body);
            if (selectedDept) {
                await updateConversation(conversation.id, 'ASK_NAME', {
                    deptId: selectedDept.id,
                    deptName: selectedDept.name,
                    doctorName: selectedDept.doctorName,
                    doctorSpecialty: selectedDept.specialty,
                    doctorId: selectedDept.doctorId
                });
                await respond(msg, conversation.id, patient.id, `Confirmed: *${selectedDept.name}*.\n\nStep 1: *Please enter your full name.*`);
            } else {
                const deptList = DEPARTMENTS.map(d => `${d.id}. ${d.name}`).join('\n');
                await respond(msg, conversation.id, patient.id, `I didn't recognize that selection.\n\n*Please select a department (1-5):*\n${deptList}`);
            }
            break;

        case 'ASK_NAME':
            if (body.length > 2) {
                await updateConversation(conversation.id, 'ASK_AGE', { ...metadata, patientName: body });
                await respond(msg, conversation.id, patient.id, `Got it, *${body}*.\n\nStep 2: *Please enter your age.*`);
            } else {
                await respond(msg, conversation.id, patient.id, "Please enter a valid full name.");
            }
            break;

        case 'ASK_AGE':
            const age = parseInt(body);
            if (!isNaN(age) && age > 0 && age < 120) {
                await updateConversation(conversation.id, 'ASK_DATE_TIME', { ...metadata, patientAge: body });
                await respond(msg, conversation.id, patient.id, "Step 3: *When would you like to visit?*\n\n_Example: 'Today at 2pm', 'Tomorrow 10:30am', or '25-02-2026, 11:00 AM'_");
            } else {
                await respond(msg, conversation.id, patient.id, "Please enter a valid age (number).");
            }
            break;

        case 'ASK_DATE_TIME':
            const parsed = parseDateTime(body);
            const summary = `*PLEASE CONFIRM YOUR APPOINTMENT DETAILS:*

• *Name:* ${metadata.patientName}
• *Age:* ${metadata.patientAge}
• *Department:* ${metadata.deptName}
• *Doctor:* ${metadata.doctorName} (${metadata.doctorSpecialty})
• *Date:* ${parsed.formattedDate}
• *Time:* ${parsed.formattedTime}

*Is this correct?*
1. Yes, confirm
2. No, restart`;

            await updateConversation(conversation.id, 'CONFIRMATION', {
                ...metadata,
                dateStr: parsed.formattedDate,
                timeStr: parsed.formattedTime,
                fullDateTimeStr: parsed.standardized
            });
            await respond(msg, conversation.id, patient.id, summary);
            break;

        case 'CONFIRMATION':
            if (body === '1') {
                await finalizeBooking(msg, conversation.id, patient.id, metadata);
            } else if (body === '2') {
                await updateConversation(conversation.id, 'MENU', {});
                await respond(msg, conversation.id, patient.id, GREETING_TEXT);
            } else {
                await respond(msg, conversation.id, patient.id, "Please reply with *1* to confirm or *2* to restart.");
            }
            break;

        default:
            await updateConversation(conversation.id, 'MENU', {});
            await respond(msg, conversation.id, patient.id, GREETING_TEXT);
            break;
    }
}

/**
 * Combined function to send reply and record it in DB
 */
async function respond(msg: WBMessage, conversationId: string, patientId: string, text: string, mediaPath?: string) {
    await sendHumanReply(msg, text, mediaPath);
    await prisma.message.create({
        data: {
            conversationId,
            patientId,
            role: 'bot',
            content: text,
            type: mediaPath ? 'image' : 'text',
            metadata: mediaPath ? { path: mediaPath } : {}
        }
    });
}

async function updateConversation(id: string, state: string, metadata: any) {
    await prisma.conversation.update({
        where: { id },
        data: { state, metadata, updatedAt: new Date() }
    });
}

async function finalizeBooking(msg: WBMessage, conversationId: string, patientId: string, data: any) {
    try {
        // 1. Data is already parsed from the ASK_DATE_TIME step
        const [d, m, y] = data.dateStr.split('-');
        const isoDate = new Date(`${y}-${m}-${d}`);
        const timeStr = data.timeStr;

        // 2. Fetch required IDs and verify existence
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { patient: true }
        });

        if (!conversation || !conversation.patient) {
            throw new Error('Conversation or Patient not found');
        }

        // Verify doctor exists, or find a fallback in the same department
        let doctor = await prisma.doctor.findUnique({ where: { id: data.doctorId } });
        if (!doctor) {
            console.warn(`⚠️ [BOT] Doctor ID ${data.doctorId} not found. Attempting fallback...`);
            doctor = await prisma.doctor.findFirst({
                where: { department: { contains: data.deptName, mode: 'insensitive' } }
            });
        }

        if (!doctor) {
            throw new Error(`No doctor found for department: ${data.deptName}`);
        }

        // 3. Save to DB
        const appointment = await prisma.appointment.create({
            data: {
                patientId: patientId,
                doctorId: doctor.id,
                date: isoDate,
                time: timeStr,
                status: 'CONFIRMED'
            }
        });

        const appointmentId = appointment.id.slice(-8).toUpperCase();

        // 4. Sync to Google
        await syncAppointmentToSheet({
            patientName: data.patientName,
            patientAge: data.patientAge,
            department: data.deptName,
            doctorName: data.doctorName,
            doctorSpecialty: doctor.specialization || 'Specialist',
            date: data.dateStr,
            time: timeStr,
            phoneNumber: msg.from,
            appointmentId: appointmentId
        });

        // 5. Generate Card
        const cardPath = await generateAppointmentCard({
            patientName: data.patientName,
            doctorName: data.doctorName,
            date: data.dateStr,
            time: timeStr,
            appointmentId: appointmentId
        });

        // 6. Send confirmation
        const confirmationMsg = `Your appointment has been confirmed! ✨\n\nYour appointment card is generated below. 👇\n\nThank you for choosing *SPINaBOT Health*. We look forward to seeing you!`;
        await respond(msg, conversationId, patientId, confirmationMsg, cardPath);

        // 7. Closing Message
        await respond(msg, conversationId, patientId, "Is there anything else I can help you with today? Feel free to type *Menu* at any time.");

        // 8. Reset conversation
        await updateConversation(conversationId, 'MENU', {});

    } catch (error) {
        console.error('❌ [FINALIZE] Error:', error);
        await respond(msg, conversationId, patientId, "I encountered an error while confirming your appointment. Please try again or contact support.");
    }
}
