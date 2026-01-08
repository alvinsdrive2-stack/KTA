import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

// Group data by day, week, or month based on period length
function getGroupingKey(date: Date, filter: PeriodFilter): string {
  const year = date.getFullYear()
  const month = date.getMonth()

  if (filter === '1month') {
    // Group by day
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  } else if (filter === '3months' || filter === '6months') {
    // Group by week
    const weekNumber = Math.ceil(date.getDate() / 7)
    return `${year}-${String(month + 1).padStart(2, '0')}-W${String(weekNumber).padStart(2, '0')}`
  } else {
    // Group by month for YTD
    return `${year}-${String(month + 1).padStart(2, '0')}`
  }
}

// Format the label for display
function formatLabel(key: string, filter: PeriodFilter): string {
  if (filter === '1month') {
    // Format: DD MMM
    const [year, month, day] = key.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    return `${parseInt(day)} ${months[parseInt(month) - 1]}`
  } else if (filter === '3months' || filter === '6months') {
    // Format: MMM W##
    const [year, month, week] = key.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    return `${months[parseInt(month) - 1]} ${week}`
  } else {
    // Format: MMM YYYY
    const [year, month] = key.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
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

    // Only PUSAT and ADMIN can access
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = (searchParams.get('period') || 'ytd') as PeriodFilter

    const { start, end } = getDateRange(period)

    // Fetch all bulk payments in the period
    const bulkPayments = await prisma.bulkPayment.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
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
      const key = getGroupingKey(currentDate, period)
      groupedData.set(key, { confirmed: 0, pending: 0 })

      // Move to next period
      if (period === '1month') {
        currentDate.setDate(currentDate.getDate() + 1)
      } else if (period === '3months' || period === '6months') {
        currentDate.setDate(currentDate.getDate() + 7)
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
    }

    // Aggregate data by period
    bulkPayments.forEach((payment) => {
      const key = getGroupingKey(payment.createdAt, period)
      const existing = groupedData.get(key) || { confirmed: 0, pending: 0 }

      if (payment.status === 'VERIFIED') {
        existing.confirmed += payment.totalNominal
      } else if (payment.status === 'PENDING') {
        existing.pending += payment.totalNominal
      }

      groupedData.set(key, existing)
    })

    // Convert to array and format
    const trendData: TrendDataPoint[] = Array.from(groupedData.entries()).map(([date, values]) => ({
      date,
      label: formatLabel(date, period),
      confirmed: values.confirmed,
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
