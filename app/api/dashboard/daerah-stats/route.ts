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

    const userRole = session.user?.role
    const userDaerahId = session.user?.daerahId

    // Only allow DAERAH role to access this endpoint
    if (userRole !== 'DAERAH' || !userDaerahId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'month'

    const now = new Date()
    // Create a new date object to avoid reference issues
    let startDate = new Date(now.getTime())

    // Set the start date based on the period
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setDate(now.getDate() - 30)
        break
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    // Reset time to start of day for accurate date comparison
    startDate.setHours(0, 0, 0, 0)
    now.setHours(23, 59, 59, 999)

    // Fetch printed KTA for this daerah
    const printedKTA = await prisma.kTARequest.findMany({
      where: {
        daerahId: userDaerahId,
        status: 'READY_TO_PRINT',
        createdAt: {
          gte: startDate,
          lte: now,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Initialize date labels based on period
    const groupedData: Record<string, number> = {}

    if (period === 'week') {
      // Week: every day
      const currentDate = new Date(startDate)
      while (currentDate <= now) {
        const dateKey = formatDateKey(currentDate)
        groupedData[dateKey] = 0
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else if (period === 'month') {
      // Month: every 5 days (1-5, 6-10, etc.)
      const currentDate = new Date(startDate)
      let dayCounter = 1
      while (currentDate <= now) {
        // Group every 5 days
        const groupDay = Math.floor((dayCounter - 1) / 5) * 5 + 1
        const groupDate = new Date(currentDate)
        groupDate.setDate(groupDay)
        const dateKey = formatDateKey(groupDate)

        if (!groupedData[dateKey]) {
          groupedData[dateKey] = 0
        }

        currentDate.setDate(currentDate.getDate() + 1)
        dayCounter++
      }
    } else if (period === 'year') {
      // Year: by month
      const currentDate = new Date(startDate)
      while (currentDate <= now) {
        const dateKey = formatDateKeyMonth(currentDate)
        if (!groupedData[dateKey]) {
          groupedData[dateKey] = 0
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Count printed KTA per date group
    printedKTA.forEach((kta) => {
      let dateKey: string

      if (period === 'week') {
        dateKey = formatDateKey(kta.createdAt)
      } else if (period === 'month') {
        // Group by 5-day periods
        const dayOfMonth = kta.createdAt.getDate()
        const groupDay = Math.floor((dayOfMonth - 1) / 5) * 5 + 1
        const groupDate = new Date(kta.createdAt)
        groupDate.setDate(groupDay)
        dateKey = formatDateKey(groupDate)
      } else {
        // year: group by month
        dateKey = formatDateKeyMonth(kta.createdAt)
      }

      if (groupedData.hasOwnProperty(dateKey)) {
        groupedData[dateKey]++
      }
    })

    // Convert to array format for chart
    const chartData = Object.entries(groupedData).map(([date, count]) => ({
      date: formatDate(date, period),
      count,
    }))

    // Calculate comparison: current month vs previous month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    // Current month printed KTA
    const thisMonthCount = await prisma.kTARequest.count({
      where: {
        daerahId: userDaerahId,
        status: 'READY_TO_PRINT',
        createdAt: {
          gte: thisMonthStart,
          lte: now,
        },
      },
    })

    // Previous month printed KTA
    const lastMonthCount = await prisma.kTARequest.count({
      where: {
        daerahId: userDaerahId,
        status: 'READY_TO_PRINT',
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    })

    // Total printed KTA for this daerah
    const totalPrinted = await prisma.kTARequest.count({
      where: {
        daerahId: userDaerahId,
        status: 'READY_TO_PRINT',
      },
    })

    // Calculate growth percentage
    const growthPercentage = lastMonthCount > 0
      ? ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100
      : (thisMonthCount > 0 ? 100 : 0)

    return NextResponse.json({
      success: true,
      data: chartData,
      comparison: {
        thisMonthCount,
        lastMonthCount,
        growthPercentage: Math.round(growthPercentage * 10) / 10,
        totalPrinted,
      },
    })
  } catch (error) {
    console.error('Error fetching daerah stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Format date as YYYY-MM-DD using local timezone (not UTC)
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Format date as YYYY-MM for monthly grouping
function formatDateKeyMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatDate(dateString: string, period: string): string {
  const date = new Date(dateString)

  if (period === 'week') {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    return days[date.getDay()]
  } else if (period === 'month') {
    // Show date range (e.g., "1-5 Jan", "26-31 Jan")
    const startDay = date.getDate()
    // Get the last day of the month dynamically
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const endDay = Math.min(startDay + 4, lastDayOfMonth)
    return `${startDay}-${endDay} ${date.toLocaleDateString('id-ID', { month: 'short' })}`
  } else {
    return date.toLocaleDateString('id-ID', { month: 'short' })
  }
}
