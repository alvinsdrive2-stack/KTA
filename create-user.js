const { PrismaClient } = require('@prisma/client')

// Load environment variables dari file .env.local
require('dotenv').config({ path: '.env.local' })

const prisma = new PrismaClient({
  errorFormat: 'pretty',
  log: ['info', 'warn', 'error']
})

async function createUser() {
  try {
    console.log('👤 Creating new user...')

    // Test 1: Create user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User'
      }
    })

    console.log('✅ User created:', user)

    // Test 2: Get all users
    const users = await prisma.user.findMany()
    console.log('📋 All users:', users)

    // Test 3: Find user by email
    const foundUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    })
    console.log('🔍 Found user:', foundUser)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createUser()