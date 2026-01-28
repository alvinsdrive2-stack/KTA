import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// GET endpoint to fetch legacy KTA data
export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN can access
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const daerahId = searchParams.get('daerahId') || ''
    const legacy = searchParams.get('legacy') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const skip = (page - 1) * limit

    // Build where clause for legacy data
    // Legacy data = DRAFT status OR (READY_TO_PRINT AND missing foto/ktp)
    const whereClause: any = {
          AND: [
            { status: 'IMPORTED_PENDING_DOCS' },
            { OR: [{ ktpUrl: null }, { fotoUrl: null }, { idIzin: null }] }
          ]
    }

    // Add search filter - combine with AND
    if (search) {
      whereClause.AND = [
        {
          OR: [
            { nama: { contains: search, mode: 'insensitive' } },
            { nik: { contains: search } },
            { nomorKTA: { contains: search } },
          ]
        }
      ]
    }

    // Add daerah filter
    if (daerahId) {
      whereClause.AND = whereClause.AND || []
      whereClause.AND.push({ daerahId })
    }

    // Get total count
    const total = await prisma.kTARequest.count({ where: whereClause })

    // Fetch data
    const ktaRequests = await prisma.kTARequest.findMany({
      where: whereClause,
      select: {
        id: true,
        idIzin: true,
        nomorKTA: true,
        nama: true,
        nik: true,
        jenjang: true,
        jabatanKerja: true,
        subklasifikasi: true,
        status: true,
        daerah: {
          select: {
            namaDaerah: true,
            kodeDaerah: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: ktaRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      }
    })

  } catch (error) {
    console.error('[Legacy KTA] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
