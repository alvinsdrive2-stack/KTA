import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking Database Connection\n')
  console.log('='.repeat(80))
  console.log()

  // Check DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL
  console.log(`DATABASE_URL: ${databaseUrl ? databaseUrl.substring(0, 50) + '...' : 'NOT SET!'}\n`)

  if (databaseUrl) {
    if (databaseUrl.includes('localhost')) {
      console.log('⚠️  WARNING: Connecting to LOCAL database!')
      console.log('   This is NOT your Supabase database.\n')
    } else if (databaseUrl.includes('supabase')) {
      console.log('✅ Connecting to SUPABASE database\n')
    } else {
      console.log('⚠️  Connecting to UNKNOWN database\n')
    }
  }

  // Test connection
  try {
    await prisma.$connect()
    console.log('✅ Database connection: SUCCESS\n')
  } catch (error) {
    console.log('❌ Database connection: FAILED')
    console.error(error)
    return
  }

  // Count records
  const daerahCount = await prisma.daerah.count()
  const regionPriceCount = await prisma.regionPrice.count()

  console.log('📊 Record Counts:')
  console.log(`  - Daerah:       ${daerahCount}`)
  console.log(`  - RegionPrice:  ${regionPriceCount}\n`)

  // Get all Daerah
  const daerahList = await prisma.daerah.findMany({
    select: {
      id: true,
      kodeDaerah: true,
      namaDaerah: true,
    },
    orderBy: {
      kodeDaerah: 'asc',
    },
  })

  console.log('📋 All Daerah Records:')
  if (daerahList.length === 0) {
    console.log('  ⚠️  NO RECORDS FOUND!\n')
  } else {
    daerahList.forEach((d, i) => {
      console.log(`  ${i + 1}. ${d.kodeDaerah}: ${d.namaDaerah}`)
      console.log(`     ID: ${d.id}`)
    })
  }

  console.log()

  // Get all unique daerahId from RegionPrice
  const regionPrices = await prisma.regionPrice.findMany({
    select: {
      daerahId: true,
    },
  })

  const uniqueDaerahIds = [...new Set(regionPrices.map(rp => rp.daerahId))]

  console.log('📋 All Unique daerahId in RegionPrice:')
  uniqueDaerahIds.forEach((id, i) => {
    const exists = daerahList.find(d => d.id === id)
    console.log(`  ${i + 1}. ${id} ${exists ? '✅' : '❌ (NOT IN DAERAH TABLE)'}`)
  })

  console.log()
  console.log('='.repeat(80))
  console.log('\n💡 If the data above does NOT match your Supabase:')
  console.log('   1. Check your .env file - DATABASE_URL must point to Supabase')
  console.log('   2. Restart your terminal/editor after changing .env')
  console.log('   3. Run "npm run db:check" again\n')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
