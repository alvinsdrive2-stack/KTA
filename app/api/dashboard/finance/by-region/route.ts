import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveRange } from '@/lib/finance-period'

export const dynamic = 'force-dynamic'

export interface RegionFinanceData {
  daerahId: string
  daerahName: string
  confirmedRevenue: number
  pendingRevenue: number
  totalRevenue: number
  totalKTA: number
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
    const limit = parseInt(searchParams.get('limit') || '5')

    const { start, end } = resolveRange(searchParams)

    // DAERAH users only see their own daerah
    const scopeFilter = session.user.role === 'DAERAH' && session.user.daerahId
      ? { daerahId: session.user.daerahId }
      : {}

    // Fetch bulk payments grouped by region
    const bulkPayments = await prisma.bulkPayment.findMany({
      where: {
        ...scopeFilter,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        daerah: {
          select: {
            id: true,
            namaDaerah: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Group and aggregate by region
    const regionMap = new Map<string, RegionFinanceData>()

    bulkPayments.forEach((payment) => {
      const daerahId = payment.daerahId
      const daerahName = payment.daerah?.namaDaerah || 'Unknown'

      const existing = regionMap.get(daerahId) || {
        daerahId,
        daerahName,
        confirmedRevenue: 0,
        pendingRevenue: 0,
        totalRevenue: 0,
        totalKTA: 0,
      }

      if (payment.status === 'VERIFIED') {
        existing.confirmedRevenue += payment.totalNominal
      } else if (payment.status === 'PENDING') {
        existing.pendingRevenue += payment.totalNominal
      }

      existing.totalRevenue += payment.totalNominal
      existing.totalKTA += payment.totalJumlah

      regionMap.set(daerahId, existing)
    })

    // Convert to array and sort by total revenue
    const regionData = Array.from(regionMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    )

    // Return top N regions
    const topRegions = regionData.slice(0, limit)

    return NextResponse.json({
      success: true,
      data: topRegions,
      summary: {
        totalRegions: regionData.length,
        topRegionsCount: topRegions.length,
      },
    })
  } catch (error) {
    console.error('Error fetching finance by region:', error)
    return NextResponse.json(
      { error: 'Failed to fetch finance by region' },
      { status: 500 }
    )
  }
}
