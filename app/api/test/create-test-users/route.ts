import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    // Create test users with different roles and daerah assignments
    const testUsers = [
      {
        name: 'Admin User',
        email: 'admin@test.com',
        password: 'admin123',
        role: 'ADMIN',
        daerahId: null // ADMIN can see all
      },
      {
        name: 'Pusat User',
        email: 'pusat@test.com',
        password: 'pusat123',
        role: 'PUSAT',
        daerahId: null // PUSAT can see all
      },
      {
        name: 'DKI Jakarta User',
        email: 'dki@test.com',
        password: 'dki123',
        role: 'DAERAH',
        daerahId: 'cmjh08vmo00091h8cq0xmsm4o' // DKI Jakarta ID
      },
      {
        name: 'Sumut User',
        email: 'sumut@test.com',
        password: 'sumut123',
        role: 'DAERAH',
        daerahId: 'cmjh08w4n001e1h8c8q6wa8dy' // Sumut ID
      },
      {
        name: 'Unassigned Daerah User',
        email: 'unassigned@test.com',
        password: 'test123',
        role: 'DAERAH',
        daerahId: null // No daerah assignment
      }
    ]

    const createdUsers = []

    for (const userData of testUsers) {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(userData.password, 10)
        const user = await prisma.user.create({
          data: {
            ...userData,
            password: hashedPassword
          }
        })
        createdUsers.push({
          email: user.email,
          password: userData.password,
          role: user.role,
          daerahId: user.daerahId
        })
      } else {
        createdUsers.push({
          email: existingUser.email,
          password: userData.password,
          role: existingUser.role,
          daerahId: existingUser.daerahId
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Test users created/verified',
      users: createdUsers
    })
  } catch (error) {
    console.error('Create test users error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}