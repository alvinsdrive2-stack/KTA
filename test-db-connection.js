const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...')

    // Test koneksi basic
    await prisma.$connect()
    console.log('✅ Connected to Supabase PostgreSQL!')

    // Test query sederhana
    const result = await prisma.$queryRaw`SELECT 1 as test, NOW() as server_time`
    console.log('✅ Query test result:', result[0])

    // Test informasi database
    const dbInfo = await prisma.$queryRaw`SELECT version() as postgres_version, current_database() as database_name`
    console.log('✅ Database info:', dbInfo[0])

  } catch (error) {
    console.error('❌ Database connection failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()