import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'google-credentials.json'),
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar'
    ],
});

const sheets = google.sheets({ version: 'v4', auth });
const googleCalendar = google.calendar({ version: 'v3', auth });

/**
 * Syncs an appointment to a Google Sheet.
 */
export async function syncAppointmentToSheet(appointment: {
    patientName: string;
    patientAge: string;
    department: string;
    doctorName: string;
    doctorSpecialty: string;
    date: string;
    time: string;
    phoneNumber: string;
    appointmentId: string;
}) {
    if (!SPREADSHEET_ID) {
        console.warn('⚠️ [GOOGLE] GOOGLE_SHEET_ID is not set. Skipping sheet sync.');
        return;
    }

    try {
        const values = [
            [
                new Date().toISOString(),
                appointment.patientName,
                appointment.patientAge,
                appointment.department,
                appointment.doctorName,
                appointment.doctorSpecialty,
                appointment.date,
                appointment.time,
                appointment.phoneNumber,
                appointment.appointmentId
            ],
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Appointments!A:J', // Updated range for 10 columns
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });

        console.log('✅ [GOOGLE] Appointment synced to Sheets');
    } catch (error: any) {
        console.error('❌ [GOOGLE] Sheet sync error:', error.message);
    }
}

/**
 * Creates an event in Google Calendar.
 */
export async function createCalendarEvent(appointment: any) {
    try {
        // Parse the actual date and time provided
        const [year, month, day] = appointment.date.split('-').map(Number);
        const [hours, minutes] = appointment.time.split(':').map(Number);

        const start = new Date(year, month - 1, day, hours, minutes);
        const end = new Date(start.getTime() + 30 * 60000); // 30 mins duration

        const event = {
            summary: `Appointment: ${appointment.patientName}`,
            description: `Doctor: ${appointment.doctorName}\nDepartment: ${appointment.department}\nAuto-booked via WhatsApp Hospital Bot.`,
            start: {
                dateTime: start.toISOString(),
            },
            end: {
                dateTime: end.toISOString(),
            },
        };

        await googleCalendar.events.insert({
            calendarId: CALENDAR_ID,
            requestBody: event,
        });

        console.log('✅ [GOOGLE] Appointment added to Calendar');
    } catch (error: any) {
        console.error('❌ [GOOGLE] Calendar error:', error.message);
    }
}

/**
 * Checks for availability (Simulated for now, could be expanded)
 */
export async function checkCalendarAvailability(date: string, time: string) {
    // This could search the calendar for conflicts
    return true;
}
