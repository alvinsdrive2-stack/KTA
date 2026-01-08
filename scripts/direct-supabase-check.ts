import { PrismaClient } from '@prisma/client'

// Direct connection without any caching
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

async function main() {
  console.log('🔍 Direct Supabase Connection Check\n')
  console.log('='.repeat(80))

  const dbUrl = process.env.DATABASE_URL || 'NOT SET'
  console.log(`\nDATABASE_URL (first 100 chars):\n${dbUrl.substring(0, 100)}...\n`)

  // Anonymize the password part if present
  const cleanUrl = dbUrl.replace(/:[^:@]+@/, ':****@')
  console.log(`Clean URL:\n${cleanUrl}\n`)

  // Check if it's really Supabase
  if (dbUrl.includes('supabase')) {
    console.log('✅ URL contains "supabase"')
  } else if (dbUrl.includes('localhost')) {
    console.log('❌ URL contains "localhost" - NOT Supabase!')
  } else if (dbUrl.includes('aws')) {
    console.log('⚠️  URL contains "aws" - might be AWS RDS')
  } else {
    console.log('⚠️  Unknown database host')
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n🔍 Testing actual connection...\n')

  try {
    // Force disconnect and reconnect
    await prisma.$disconnect()
    await prisma.$connect()

    // Test query
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, inet_server_addr()`
    console.log('📊 Connection Info:')
    console.log(`  - Database: ${result[0].current_database}`)
    console.log(`  - User: ${result[0].current_user}`)
    console.log(`  - Server: ${result[0].inet_server_addr}`)
    console.log()

    // Count tables
    const daerahCount = await prisma.daerah.count()
    const regionPriceCount = await prisma.regionPrice.count()

    console.log('📊 Record Counts:')
    console.log(`  - Daerah:       ${daerahCount}`)
    console.log(`  - RegionPrice:  ${regionPriceCount}`)

    // Get actual records
    const daerahList = await prisma.daerah.findMany({
      select: {
        id: true,
        kodeDaerah: true,
        namaDaerah: true,
      },
      orderBy: {
        kodeDaerah: 'asc',
      },
      take: 10, // Just first 10
    })

    console.log(`\n📋 First 10 Daerah records (of ${daerahList.length}):`)
    if (daerahList.length === 0) {
      console.log('  ⚠️  NO RECORDS! Table is empty!')
    } else {
      daerahList.forEach((d, i) => {
        console.log(`  ${i + 1}. ${d.kodeDaerah}: ${d.namaDaerah}`)
      })
    }

  } catch (error) {
    console.error('❌ Connection failed:', error)
  } finally {
    await prisma.$disconnect()
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n💡 STILL SEEING DIFFERENT DATA?')
  console.log('   1. Copy DATABASE_URL from Supabase Settings > Database')
  console.log('   2. Make sure you selected the correct project and branch')
  console.log('   3. Paste in your .env file')
  console.log('   4. Restart your terminal/IDE completely (kill and reopen)')
  console.log('   5. Run this script again\n')
}

main()
