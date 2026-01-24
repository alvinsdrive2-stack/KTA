import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

// Data users dari Supabase
const USERS_DATA = [
  {
    id: 'cmj1psozk00021h3ss13xet1w',
    daerahId: 'cmjh08p6n00061h8ckl91rfqr',
    name: 'Admin Pusat',
    email: 'admin@pusat.com',
    password: '$2y$10$mEbcBeyy1SC26AnkcpxJ3e0kuK.FuXh8M1LI9uyvFSaA5LMr7XvPC',
    role: 'ADMIN' as UserRole,
    isActive: true,
    ktpUrl: null,
    fotoUrl: null,
    createdAt: new Date('2025-12-11 17:31:09.824'),
    updatedAt: new Date('2025-12-11 17:31:09.824'),
  },
  {
    id: 'cmj1psp5800041h3spzab5nlq',
    daerahId: 'cmjh0azqu00091hesxec8zyia',
    name: 'Admin Jakarta',
    email: 'jakarta@daerah.com',
    password: '$2y$10$mEbcBeyy1SC26AnkcpxJ3e0kuK.FuXh8M1LI9uyvFSaA5LMr7XvPC',
    role: 'DAERAH' as UserRole,
    isActive: true,
    ktpUrl: null,
    fotoUrl: null,
    createdAt: new Date('2025-12-11 17:31:10.027'),
    updatedAt: new Date('2025-12-11 17:31:10.027'),
  },
  {
    id: 'cmj1psp9d00061h3s9y2morar',
    daerahId: 'cmjh0azzy000m1hescj3k6zab',
    name: 'Admin Bali',
    email: 'bali@daerah.com',
    password: '$2y$10$mEbcBeyy1SC26AnkcpxJ3e0kuK.FuXh8M1LI9uyvFSaA5LMr7XvPC',
    role: 'DAERAH' as UserRole,
    isActive: true,
    ktpUrl: null,
    fotoUrl: null,
    createdAt: new Date('2025-12-11 17:31:10.177'),
    updatedAt: new Date('2026-01-23 17:31:18.175'),
  },
  {
    id: 'cmkr6v5r6001j1h6sjny2e51x',
    daerahId: 'cmjh0azto000d1hesmskd9g81',
    name: 'Surabaya',
    email: 'admin@admin.com',
    password: '$2b$10$o97ZKSarudpnahLvTFpVGOvBAHtW/im2t7qXjw9OU1GlDhKkjWc0a',
    role: 'DAERAH' as UserRole,
    isActive: true,
    ktpUrl: null,
    fotoUrl: null,
    createdAt: new Date('2026-01-23 18:02:55.071'),
    updatedAt: new Date('2026-01-23 18:02:55.071'),
  },
  {
    id: 'cmkr6zg4w00011h6c4qexdqn5',
    daerahId: null,
    name: 'Alvin Keren',
    email: 'alvians.alvians@yahoo.com',
    password: '$2b$10$yJfZ6h3WQfZ4p.5CBDAFZO2EB/HSfUE8TQIXcIERM4AUgKMicmRbq',
    role: 'KEUANGAN' as UserRole,
    isActive: true,
    ktpUrl: null,
    fotoUrl: null,
    createdAt: new Date('2026-01-23 18:06:15.152'),
    updatedAt: new Date('2026-01-24 14:25:30.962'),
  },
]

async function main() {
  console.log('Seeding users...')

  // Cek daerah dulu
  const daerahs = await prisma.daerah.findMany({
    select: { id: true, kodeDaerah: true, namaDaerah: true },
  })
  console.log('Existing daerahs:', daerahs.map(d => `${d.namaDaerah} (${d.id})`))

  let successCount = 0
  let skippedCount = 0

  for (const user of USERS_DATA) {
    // Cek daerahId exist
    if (user.daerahId) {
      const daerah = await prisma.daerah.findUnique({
        where: { id: user.daerahId },
      })
      if (!daerah) {
        console.log(`SKIP: ${user.email} - daerahId ${user.daerahId} not found`)
        skippedCount++
        continue
      }
    }

    // Cek email sudah exist
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    })

    if (existing) {
      console.log(`SKIP: ${user.email} - already exists`)
      skippedCount++
      continue
    }

    // Insert user dengan ID spesifik
    await prisma.user.create({
      data: user,
    })

    console.log(`CREATED: ${user.email}`)
    successCount++
  }

  console.log(`\nDone! ${successCount} users created, ${skippedCount} skipped`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
