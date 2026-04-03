const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const pg = require('pg')

// In Prisma 7, direct database connections require a driver adapter
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Seeding data...')

    // Create specialized doctors
    const doctors = [
        {
            id: 'doc-cardio',
            name: 'Dr. Michael Chen',
            department: 'Cardiology',
            specialization: 'Cardiologist'
        },
        {
            id: 'doc-peds',
            name: 'Dr. Emily White',
            department: 'Pediatrics',
            specialization: 'Pediatrician'
        },
        {
            id: 'doc-gen',
            name: 'Dr. Sarah Johnson',
            department: 'General Medicine',
            specialization: 'General Practitioner'
        },
        {
            id: 'doc-ortho',
            name: 'Dr. Robert Miller',
            department: 'Orthopedics',
            specialization: 'Orthopedic Surgeon'
        },
        {
            id: 'doc-derm',
            name: 'Dr. Lisa Wong',
            department: 'Dermatology',
            specialization: 'Dermatologist'
        }
    ];

    for (const d of doctors) {
        await prisma.doctor.upsert({
            where: { id: d.id },
            update: d,
            create: {
                ...d,
                availability: {
                    monday: '09:00-17:00',
                    tuesday: '09:00-17:00',
                    wednesday: '09:00-17:00',
                    thursday: '09:00-17:00',
                    friday: '09:00-17:00'
                }
            }
        });
        console.log(`Seeded doctor: ${d.name} (${d.department})`);
    }
}

main()
    .catch((e: any) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
