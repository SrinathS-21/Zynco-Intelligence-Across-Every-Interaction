import { prisma } from '@/lib/db';

async function seed() {
    console.log('Seeding WhatsApp data...');
    const contacts = [
        { id: '919944559392@c.us', name: 'Sandiya Sasi' },
        { id: '917013164451@c.us', name: 'Vimal' },
        { id: '918880001112@c.us', name: 'Srinath S' }
    ];

    for (const c of contacts) {
        await prisma.unifiedMessage.create({
            data: {
                userId: 'default',
                platform: 'whatsapp',
                contactId: c.id,
                contactName: c.name,
                content: `Sample incoming message from ${c.name}`,
                direction: 'INBOUND',
                timestamp: new Date(Date.now() - Math.random() * 1000000)
            }
        });
    }
    console.log('Seeding complete!');
}

seed().catch(console.error);
