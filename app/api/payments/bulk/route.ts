import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only DAERAH users can access their bulk payments
    if (session.user.role !== 'DAERAH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'
    const status = searchParams.get('status')

    // Build where clause
    const where: any = {
      daerahId: session.user.daerahId!
    }

    // Filter by status if provided
    if (status) {
      where.status = status
    } else if (!all) {
      // If not fetching all and no status specified, only get PENDING invoices
      where.status = 'PENDING'
    }

    const bulkPayments = await prisma.bulkPayment.findMany({
      where,
      include: {
        payments: {
          include: {
            ktaRequest: {
              select: {
                id: true,
                idIzin: true,
                nama: true,
                jenjang: true
              }
            }
          }
        },
        daerah: {
          select: {
            namaDaerah: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: bulkPayments
    })
  } catch (error) {
    console.error('Error fetching bulk payments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
