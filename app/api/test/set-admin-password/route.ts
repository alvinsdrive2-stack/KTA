import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    // Find admin user
    const admin = await prisma.user.findFirst({
      where: {
        role: 'ADMIN'
      }
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin user not found' })
    }

    // Set new password
    const newPassword = 'admin123' // Default password for testing
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashedPassword }
    })

    return NextResponse.json({
      success: true,
      message: 'Admin password updated',
      email: admin.email,
      newPassword: newPassword
    })
  } catch (error) {
    console.error('Set admin password error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}