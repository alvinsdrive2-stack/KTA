import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export type PeriodFilter = '1month' | '3months' | '6months' | 'ytd'

function getDateRange(filter: PeriodFilter): { start: Date, end: Date } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  let start: Date

  switch (filter) {
    case '1month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      break
    case '3months':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      break
    case '6months':
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      break
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1)
      break
    default:
      start = new Date(now.getFullYear(), 0, 1)
  }

  return { start, end }
}

function getPreviousPeriodRange(filter: PeriodFilter): { start: Date, end: Date } {
  const current = getDateRange(filter)
  const duration = current.end.getTime() - current.start.getTime()

  const end = new Date(current.start.getTime() - 1)
  const start = new Date(end.getTime() - duration + 1)

  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ADMIN, KEUANGAN, PUSAT, and DAERAH can access
    const allowedRoles = ['ADMIN', 'KEUANGAN', 'PUSAT', 'DAERAH']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = (searchParams.get('period') || 'ytd') as PeriodFilter

    const currentRange = getDateRange(period)
    const previousRange = getPreviousPeriodRange(period)

    // DAERAH users only see their own daerah's payments
    const scopeFilter = session.user.role === 'DAERAH' && session.user.daerahId
      ? { daerahId: session.user.daerahId }
      : {}

    // Current period stats
    const [currentConfirmed, currentPending, currentTotalKTA] = await Promise.all([
      prisma.bulkPayment.aggregate({
        where: {
          status: 'VERIFIED',
          ...scopeFilter,
          createdAt: {
            gte: currentRange.start,
            lte: currentRange.end,
          },
        },
        _sum: { totalNominal: true },
      }),
      prisma.bulkPayment.aggregate({
        where: {
          status: 'PENDING',
          ...scopeFilter,
          createdAt: {
            gte: currentRange.start,
            lte: currentRange.end,
          },
        },
        _sum: { totalNominal: true },
      }),
      prisma.bulkPayment.aggregate({
        where: {
          ...scopeFilter,
          createdAt: {
            gte: currentRange.start,
            lte: currentRange.end,
          },
        },
        _sum: { totalJumlah: true },
      }),
    ])

    // Previous period stats (for growth calculation)
    const [previousConfirmed, previousPending] = await Promise.all([
      prisma.bulkPayment.aggregate({
        where: {
          status: 'VERIFIED',
          ...scopeFilter,
          createdAt: {
            gte: previousRange.start,
            lte: previousRange.end,
          },
        },
        _sum: { totalNominal: true },
      }),
      prisma.bulkPayment.aggregate({
        where: {
          status: 'PENDING',
          ...scopeFilter,
          createdAt: {
            gte: previousRange.start,
            lte: previousRange.end,
          },
        },
        _sum: { totalNominal: true },
      }),
    ])

    const confirmedRevenue = currentConfirmed._sum.totalNominal || 0
    const pendingRevenue = currentPending._sum.totalNominal || 0
    const totalRevenue = confirmedRevenue + pendingRevenue
    const previousConfirmedRevenue = previousConfirmed._sum.totalNominal || 0
    const previousPendingRevenue = previousPending._sum.totalNominal || 0
    const previousTotalRevenue = previousConfirmedRevenue + previousPendingRevenue
    const totalKTA = currentTotalKTA._sum.totalJumlah || 0

    // Calculate growth rate
    let growthRate = 0
    if (previousTotalRevenue > 0) {
      growthRate = ((totalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100
    }

    // Calculate average per KTA
    const avgPerKTA = totalKTA > 0 ? Math.round(totalRevenue / totalKTA) : 0

    return NextResponse.json({
      success: true,
      data: {
        confirmedRevenue,
        pendingRevenue,
        totalRevenue,
        previousRevenue: previousTotalRevenue,
        growthRate,
        totalKTA,
        avgPerKTA,
        period: {
          start: currentRange.start,
          end: currentRange.end,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching finance stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch finance stats' },
      { status: 500 }
    )
  }
}
