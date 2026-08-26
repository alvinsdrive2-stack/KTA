import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveRange } from '@/lib/finance-period'
import { getBulkPaymentsWithPorsi } from '@/lib/finance-porsi'

export const dynamic = 'force-dynamic'

function getPreviousPeriodRange(current: { start: Date, end: Date }): { start: Date, end: Date } {
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
    const { start, end } = resolveRange(searchParams)

    const currentRange = { start, end }
    const previousRange = getPreviousPeriodRange(currentRange)

    const isDaerah = session.user.role === 'DAERAH' && session.user.daerahId
    const scopeFilter = isDaerah ? { daerahId: session.user.daerahId as string } : {}

    let confirmedRevenue: number
    let pendingRevenue: number
    let previousConfirmedRevenue: number
    let previousPendingRevenue: number
    let totalKTA: number

    if (isDaerah) {
      // Pendapatan daerah = porsi diskon, bukan total nominal
      const [cur, prev, ktaAgg] = await Promise.all([
        getBulkPaymentsWithPorsi({ ...scopeFilter, createdAt: { gte: currentRange.start, lte: currentRange.end } }),
        getBulkPaymentsWithPorsi({ ...scopeFilter, createdAt: { gte: previousRange.start, lte: previousRange.end } }),
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
      confirmedRevenue = cur.filter(b => b.status === 'VERIFIED').reduce((s, b) => s + b.porsi, 0)
      pendingRevenue = cur.filter(b => b.status === 'PENDING').reduce((s, b) => s + b.porsi, 0)
      previousConfirmedRevenue = prev.filter(b => b.status === 'VERIFIED').reduce((s, b) => s + b.porsi, 0)
      previousPendingRevenue = prev.filter(b => b.status === 'PENDING').reduce((s, b) => s + b.porsi, 0)
      totalKTA = ktaAgg._sum?.totalJumlah || 0
    } else {
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

      confirmedRevenue = currentConfirmed._sum.totalNominal || 0
      pendingRevenue = currentPending._sum.totalNominal || 0
      previousConfirmedRevenue = previousConfirmed._sum.totalNominal || 0
      previousPendingRevenue = previousPending._sum.totalNominal || 0
      totalKTA = currentTotalKTA._sum.totalJumlah || 0
    }

    const totalRevenue = confirmedRevenue + pendingRevenue
    const previousTotalRevenue = previousConfirmedRevenue + previousPendingRevenue

    // Calculate growth rate
    let growthRate = 0
    if (previousTotalRevenue > 0) {
      growthRate = ((totalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100
    }

    // Calculate average per KTA
    const avgPerKTA = totalKTA > 0 ? Math.round(totalRevenue / totalKTA) : 0

    let porsiPersen = 0
    let porsiAmount = 0
    if (isDaerah) {
      const daerahInfo = await prisma.daerah.findUnique({
        where: { id: session.user.daerahId as string },
        select: { diskonPersen: true }
      })
      porsiPersen = daerahInfo?.diskonPersen || 0
      porsiAmount = totalRevenue
    }

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
        porsiPersen,
        porsiAmount,
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
