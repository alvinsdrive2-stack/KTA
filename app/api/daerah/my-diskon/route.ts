import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.daerahId) {
      return NextResponse.json({
        success: true,
        diskonPersen: 0
      })
    }

    // Get daerah diskon for this user
    const daerah = await prisma.daerah.findUnique({
      where: { id: session.user.daerahId },
      select: {
        diskonPersen: true
      }
    })

    return NextResponse.json({
      success: true,
      diskonPersen: daerah?.diskonPersen ?? 0
    })

  } catch (error) {
    console.error('Get daerah diskon error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
