import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveRange } from '@/lib/finance-period'

export const dynamic = 'force-dynamic'

export type PeriodFilter = '1month' | '3months' | '6months' | 'ytd'

type GroupingMode = 'day' | 'week' | 'month'

// Pilih grouping berdasarkan mode period atau span tanggal custom
function resolveGroupingMode(period: PeriodFilter, isCustom: boolean, start: Date, end: Date): GroupingMode {
  if (isCustom) {
    const spanDays = (end.getTime() - start.getTime()) / 86400000
    if (spanDays <= 45) return 'day'
    if (spanDays <= 180) return 'week'
    return 'month'
  }
  if (period === '1month') return 'day'
  if (period === '3months' || period === '6months') return 'week'
  return 'month'
}

// Group data by day, week, or month
function getGroupingKey(date: Date, mode: GroupingMode): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  if (mode === 'day') {
    return `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`
  } else if (mode === 'week') {
    const weekNumber = Math.ceil(date.getDate() / 7)
    return `${year}-${month}-W${String(weekNumber).padStart(2, '0')}`
  } else {
    return `${year}-${month}`
  }
}

// Format the label for display
function formatLabel(key: string, mode: GroupingMode): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

  if (mode === 'day') {
    // Format: DD MMM
    const [year, month, day] = key.split('-')
    return `${parseInt(day)} ${months[parseInt(month) - 1]}`
  } else if (mode === 'week') {
    // Format: MMM W##
    const [year, month, week] = key.split('-')
    return `${months[parseInt(month) - 1]} ${week}`
  } else {
    // Format: MMM YYYY
    const [year, month] = key.split('-')
    return `${months[parseInt(month) - 1]} ${year}`
  }
}

export interface TrendDataPoint {
  date: string
  label: string
  confirmed: number
  pending: number
  total: number
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
    const { start, end, period, isCustom } = resolveRange(searchParams)
    const mode = resolveGroupingMode(period, isCustom, start, end)

    // Build where clause based on user role
    let whereClause: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    }

    // DAERAH users can only see their own daerah's payments
    if (session.user.role === 'DAERAH' && session.user.daerahId) {
      whereClause.daerahId = session.user.daerahId
    }

    // Fetch bulk payments in the period
    const bulkPayments = await prisma.bulkPayment.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        totalNominal: true,
        status: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Group by time period
    const groupedData = new Map<string, { confirmed: number; pending: number }>()

    // Initialize all dates in range with 0 values
    const currentDate = new Date(start)
    while (currentDate <= end) {
      const key = getGroupingKey(currentDate, mode)
      groupedData.set(key, { confirmed: 0, pending: 0 })

      // Move to next period
      if (mode === 'day') {
        currentDate.setDate(currentDate.getDate() + 1)
      } else if (mode === 'week') {
        currentDate.setDate(currentDate.getDate() + 7)
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
    }

    // Aggregate data by period
    bulkPayments.forEach((payment) => {
      const key = getGroupingKey(payment.createdAt, mode)
      const existing = groupedData.get(key) || { confirmed: 0, pending: 0 }

      if (payment.status === 'VERIFIED') {
        existing.confirmed += payment.totalNominal
      } else if (payment.status === 'PENDING') {
        existing.pending += payment.totalNominal
      }

      groupedData.set(key, existing)
    })

    // Convert to array and format - match RevenueChart expected format
    const trendData = Array.from(groupedData.entries()).map(([date, values]) => ({
      date,
      label: formatLabel(date, mode),
      confirmed: values.confirmed, // Use confirmed as revenue
      pending: values.pending,
      total: values.confirmed + values.pending,
    }))

    return NextResponse.json({
      success: true,
      data: trendData,
      period: {
        start,
        end,
        filter: period,
      },
    })
  } catch (error) {
    console.error('Error fetching finance trend:', error)
    return NextResponse.json(
      { error: 'Failed to fetch finance trend' },
      { status: 500 }
    )
  }
}
