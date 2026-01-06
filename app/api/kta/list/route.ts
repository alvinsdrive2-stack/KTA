import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const daerahKode = searchParams.get('daerahKode')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Build where clause based on user role
    let whereClause: any = {}

    switch (session.user.role) {
      case 'DAERAH':
        // DAERAH users can only see requests from their assigned daerah
        if (session.user.daerahId) {
          whereClause.daerahId = session.user.daerahId
        } else {
          // If DAERAH user has no daerah assignment, return empty result
          return NextResponse.json({
            success: true,
            data: [],
            message: 'User belum di-assign ke daerah'
          })
        }
        break

      case 'PUSAT':
        // PUSAT users can see all requests
        break

      case 'ADMIN':
        // ADMIN can see all requests
        break

      default:
        // Unknown role - return empty
        return NextResponse.json({
          success: true,
          data: [],
          message: 'Invalid user role'
        })
    }

    // Additional daerah filter only applies to PUSAT/ADMIN
    if ((session.user.role === 'PUSAT' || session.user.role === 'ADMIN') && daerahKode && daerahKode !== 'all') {
      whereClause.daerah = {
        kodeDaerah: daerahKode
      }
    }

    if (status) {
      whereClause.status = status
    }

    if (daerahKode && (session.user.role === 'PUSAT' || session.user.role === 'ADMIN')) {
      // Only allow daerah filter for PUSAT/ADMIN users
      whereClause.daerah = {
        kodeDaerah: daerahKode
      }
    }

    if (search) {
      whereClause.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { idIzin: { contains: search, mode: 'insensitive' } },
        { nik: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [ktaRequests, total] = await Promise.all([
      prisma.kTARequest.findMany({
        where: whereClause,
        include: {
          requestedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
          daerah: {
            select: {
              id: true,
              namaDaerah: true,
              kodeDaerah: true,
              // kodePropinsi: true, // Disable until fixed
            },
          },
          payments: {
            select: {
              id: true,
              jumlah: true,
              statusPembayaran: true,
              paidAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.kTARequest.count({ where: whereClause }),
    ])

    return NextResponse.json({
      success: true,
      data: ktaRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}