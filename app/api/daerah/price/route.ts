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
      return NextResponse.json({ error: 'User not assigned to any daerah' }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()

    // Get active region price for this daerah
    const regionPrice = await prisma.regionPrice.findFirst({
      where: {
        daerahId: session.user.daerahId,
        tahun: currentYear,
        isActive: true
      },
      include: {
        daerah: {
          select: {
            namaDaerah: true,
            kodeDaerah: true
          }
        }
      }
    })

    if (!regionPrice) {
      return NextResponse.json({
        error: 'Harga untuk daerah Anda belum ditetapkan',
        daerah: session.user.daerahId
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      price: regionPrice.hargaKta,
      year: regionPrice.tahun,
      daerah: regionPrice.daerah
    })

  } catch (error) {
    console.error('Get region price error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}