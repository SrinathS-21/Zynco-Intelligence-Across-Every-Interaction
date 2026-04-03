import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

/**
 * Generates a "Canva-like" appointment card image
 */
export async function generateAppointmentCard(details: {
    patientName: string;
    doctorName: string;
    date: string;
    time: string;
    appointmentId: string;
}) {
    const width = 800;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1e3a8a'); // Dark blue
    gradient.addColorStop(1, '#3b82f6'); // Royal blue
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Add some design elements (semi-circles)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(width, height, 200, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 150, 0, Math.PI * 2);
    ctx.fill();

    // 3. Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('APPOINTMENT CONFIRMED', 50, 80);

    // 4. Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 100);
    ctx.lineTo(350, 100);
    ctx.stroke();

    // 5. Patient Details
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Patient Name:', 50, 160);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(details.patientName.toUpperCase(), 50, 195);

    // 6. Doctor Details
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Consulting Doctor:', 50, 260);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(details.doctorName, 50, 295);

    // 7. Time & Date (Right side)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.roundRect(450, 130, 300, 180, 20);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText(details.time, 600, 210);

    ctx.font = '28px sans-serif';
    ctx.fillText(details.date, 600, 255);

    // 8. Footer / ID
    ctx.textAlign = 'left';
    ctx.font = 'italic 18px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Tracking ID: ${details.appointmentId}`, 50, 410);

    ctx.textAlign = 'right';
    ctx.fillText('Brought to you by SPINaBOT Health', 750, 410);

    // Save to temp file
    const buffer = canvas.toBuffer('image/png');
    const fileName = `card-${details.appointmentId}.png`;
    const tempPath = path.join(process.cwd(), 'public', 'cards');

    if (!fs.existsSync(tempPath)) {
        fs.mkdirSync(tempPath, { recursive: true });
    }

    const filePath = path.join(tempPath, fileName);
    fs.writeFileSync(filePath, buffer);

    return filePath;
}
