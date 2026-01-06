import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user role to ADMIN
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' }
    })

    return NextResponse.json({
      success: true,
      message: 'User role updated to ADMIN',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role
      }
    })
  } catch (error) {
    console.error('Update role error:', error)

    // Try to create admin user
    try {
      const admin = await prisma.user.create({
        data: {
          email: 'admin@test.com',
          name: 'Admin User',
          password: '$2a$10$rOzJqQHQGQKJlOxEk9kT0.gBwA5qD9NjW2N4xHs7qE4W2J5aM6uN9J0V5QW7R7I8pK2l',
          role: 'ADMIN',
          isActive: true
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Created new ADMIN user',
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        }
      })
    } catch (createError) {
      return NextResponse.json({
        error: 'Failed to update or create admin user',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  }
}