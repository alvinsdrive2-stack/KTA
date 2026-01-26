import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Truncating jabatan_kerja table...')

  // Count before
  const countBefore = await prisma.jabatanKerja.count()
  console.log(`📊 Current row count: ${countBefore}`)

  // Delete all data
  await prisma.jabatanKerja.deleteMany({})

  // Count after
  const countAfter = await prisma.jabatanKerja.count()
  console.log(`✅ Deleted ${countBefore - countAfter} rows`)
  console.log(`📊 New row count: ${countAfter}`)
  console.log('\n✨ Table is now empty!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
