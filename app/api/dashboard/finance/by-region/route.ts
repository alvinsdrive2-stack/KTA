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

    // Only PUSAT and ADMIN can access
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = (searchParams.get('period') || 'ytd') as PeriodFilter
    const limit = parseInt(searchParams.get('limit') || '5')

    const { start, end } = getDateRange(period)

    // Fetch bulk payments grouped by region
    const bulkPayments = await prisma.bulkPayment.findMany({
      where: {
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
