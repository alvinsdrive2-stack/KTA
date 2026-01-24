import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Urutan truncate penting karena foreign key
const TABLES_ORDER = [
  'qRScan',
  'approval',
  'bulkPayment',
  'payment',
  'kTADocument',
  'kTARequest',
  'jabatanKerja',
  'subklasifikasi',
  'regionPrice',
  'session',
  'user',
  'daerah',
]

async function main() {
  console.log('Truncating all tables...\n')

  for (const tableName of TABLES_ORDER) {
    try {
      // @ts-ignore - dynamic model access
      await prisma[tableName].deleteMany({})
      console.log(`-> ${tableName}: OK`)
    } catch (error: any) {
      console.error(`-> ${tableName}: ERROR - ${error.message}`)
    }
  }

  console.log('\nDone! All tables truncated.')
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
