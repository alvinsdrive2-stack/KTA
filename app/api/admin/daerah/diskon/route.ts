import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// GET - Get all daerah with diskon (for admin)
export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can access
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const daerahList = await prisma.daerah.findMany({
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        diskonPersen: true,
        isActive: true
      },
      orderBy: {
        kodeDaerah: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: daerahList
    })

  } catch (error) {
    console.error('Get daerah list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update diskon for a specific daerah (for admin)
export async function PATCH(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can update
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, diskonPersen } = body

    // Validation
    if (!id) {
      return NextResponse.json({ error: 'Daerah ID is required' }, { status: 400 })
    }

    if (typeof diskonPersen !== 'number' || diskonPersen < 0 || diskonPersen > 100) {
      return NextResponse.json({ error: 'Diskon must be between 0 and 100' }, { status: 400 })
    }

    // Update daerah diskon
    const updatedDaerah = await prisma.daerah.update({
      where: { id },
      data: { diskonPersen },
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        diskonPersen: true
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedDaerah
    })

  } catch (error) {
    console.error('Update daerah diskon error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
