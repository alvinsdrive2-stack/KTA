import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check if there are any users in the database
    const userCount = await prisma.user.count()

    // Get sample user if exists
    const sampleUser = await prisma.user.findFirst({
      include: {
        daerah: {
          select: {
            id: true,
            namaDaerah: true,
            kodeDaerah: true
          }
        }
      }
    })

    return NextResponse.json({
      totalUsers: userCount,
      sampleUser: sampleUser ? {
        id: sampleUser.id,
        email: sampleUser.email,
        name: sampleUser.name,
        role: sampleUser.role,
        daerahId: sampleUser.daerahId,
        daerah: sampleUser.daerah
      } : null
    })
  } catch (error) {
    console.error('Check user error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}