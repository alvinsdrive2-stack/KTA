import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveRange } from '@/lib/finance-period'

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

    // Porsi BPD (nilai diskon yang didapat daerah) — hanya buat role DAERAH.
    // bulkPayment cuma nyimpen totalNominal (udah kena diskon), jadi hitung dari selisih base vs final per invoice.
    let porsiPersen = 0
    let porsiAmount = 0

    if (session.user.role === 'DAERAH' && session.user.daerahId) {
      const daerahInfo = await prisma.daerah.findUnique({
        where: { id: session.user.daerahId },
        select: { diskonPersen: true }
      })
      porsiPersen = daerahInfo?.diskonPersen || 0

      const bulkPayments = await prisma.bulkPayment.findMany({
        where: {
          daerahId: session.user.daerahId,
          createdAt: { gte: currentRange.start, lte: currentRange.end },
        },
        include: {
          payments: {
            include: {
              ktaRequest: {
                select: {
                  hargaBase: true,
                  isUpgrade: true,
                  upgradeFromKtaId: true,
                }
              }
            }
          }
        }
      })

      // KTA asal buat line upgrade, biar base upgrade dihitung bener (hargaBase - hargaBase sebelumnya)
      const upgradeFromIds = Array.from(new Set(
        bulkPayments.flatMap(bp => bp.payments.map(p => p.ktaRequest.upgradeFromKtaId).filter(Boolean))
      )) as string[]

      const prevKtas = upgradeFromIds.length > 0
        ? await prisma.kTARequest.findMany({
            where: { id: { in: upgradeFromIds } },
            select: { id: true, hargaBase: true }
          })
        : []

      const prevBaseMap = new Map(prevKtas.map(k => [k.id, k.hargaBase || 0]))

      porsiAmount = bulkPayments.reduce((sum, bp) => {
        const invoiceBase = bp.payments.reduce((acc, p) => {
          const k = p.ktaRequest
          const effective = k.isUpgrade && k.upgradeFromKtaId
            ? (k.hargaBase || 0) - (prevBaseMap.get(k.upgradeFromKtaId) || 0)
            : (k.hargaBase || 0)
          return acc + effective
        }, 0)
        return sum + Math.max(0, invoiceBase - bp.totalNominal)
      }, 0)
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
