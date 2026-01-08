import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can view all payments
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const daerahKode = searchParams.get('daerahKode')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Build where clause
    let whereClause: any = {}

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (daerahKode && daerahKode !== 'all') {
      whereClause.daerah = {
        kodeDaerah: daerahKode
      }
    }

    if (search) {
      whereClause.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { daerah: { namaDaerah: { contains: search, mode: 'insensitive' } } },
        { submittedByUser: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const [payments, total] = await Promise.all([
      prisma.bulkPayment.findMany({
        where: whereClause,
        include: {
          daerah: {
            select: {
              id: true,
              namaDaerah: true,
              kodeDaerah: true
            }
          },
          submittedByUser: {
            select: {
              id: true,
              name: true
            }
          },
          verifiedByUser: {
            select: {
              id: true,
              name: true
            }
          },
          payments: {
            include: {
              ktaRequest: {
                select: {
                  id: true,
                  idIzin: true,
                  nama: true,
                  nik: true,
                  jabatanKerja: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.bulkPayment.count({ where: whereClause })
    ])

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('List payments error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}