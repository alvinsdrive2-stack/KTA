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
    now.setHours(23, 59, 59, 999)

    // Calculate current period dates
    let currentStartDate = new Date(now.getTime())

    switch (period) {
      case 'week':
        currentStartDate.setDate(now.getDate() - 7)
        break
      case 'month':
        currentStartDate.setDate(now.getDate() - 30)
        break
      case 'year':
        currentStartDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        currentStartDate.setDate(now.getDate() - 30)
    }

    currentStartDate.setHours(0, 0, 0, 0)

    // Build base where clause
    const baseWhereClause: any = {
      daerahId: userDaerahId,
      status: 'READY_TO_PRINT',
    }

    // Fetch current period printed KTA
    const currentKTA = await prisma.kTARequest.findMany({
      where: {
        ...baseWhereClause,
        createdAt: {
          gte: currentStartDate,
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

    // Calculate right side label data based on period
    let rightLabelValue = 0
    let rightLabelPrevValue = 0

    if (period === 'week') {
      // Today's count
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      rightLabelValue = await prisma.kTARequest.count({
        where: {
          ...baseWhereClause,
          createdAt: {
            gte: todayStart,
            lte: now,
          },
        },
      })
      // Yesterday's count for comparison
      const yesterdayStart = new Date(todayStart)
      yesterdayStart.setDate(yesterdayStart.getDate() - 1)
      const yesterdayEnd = new Date(todayStart)
      yesterdayEnd.setMilliseconds(yesterdayEnd.getMilliseconds() - 1)
      rightLabelPrevValue = await prisma.kTARequest.count({
        where: {
          ...baseWhereClause,
          createdAt: {
            gte: yesterdayStart,
            lte: yesterdayEnd,
          },
        },
      })
    } else if (period === 'month') {
      // Last 5 days count
      const fiveDaysAgo = new Date(now)
      fiveDaysAgo.setDate(now.getDate() - 5)
      fiveDaysAgo.setHours(0, 0, 0, 0)
      rightLabelValue = await prisma.kTARequest.count({
        where: {
          ...baseWhereClause,
          createdAt: {
            gte: fiveDaysAgo,
            lte: now,
          },
        },
      })
      // Previous 5 days for comparison
      const tenDaysAgo = new Date(fiveDaysAgo)
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 5)
      const sixDaysAgo = new Date(fiveDaysAgo)
      sixDaysAgo.setMilliseconds(sixDaysAgo.getMilliseconds() - 1)
      rightLabelPrevValue = await prisma.kTARequest.count({
        where: {
          ...baseWhereClause,
          createdAt: {
            gte: tenDaysAgo,
            lte: sixDaysAgo,
          },
        },
      })
    } else {
      // This month count
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      rightLabelValue = await prisma.kTARequest.count({
        where: {
          ...baseWhereClause,
          createdAt: {
            gte: monthStart,
            lte: now,
          },
        },
      })
      // Last month count for comparison
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(monthStart)
      lastMonthEnd.setMilliseconds(lastMonthEnd.getMilliseconds() - 1)
      rightLabelPrevValue = await prisma.kTARequest.count({
        where: {
          ...baseWhereClause,
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      })
    }

    // Initialize date labels based on period
    const groupedData: Record<string, number> = {}

    if (period === 'week') {
      const currentDate = new Date(currentStartDate)
      while (currentDate <= now) {
        const dateKey = formatDateKey(currentDate)
        groupedData[dateKey] = 0
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else if (period === 'month') {
      const currentDate = new Date(currentStartDate)
      let dayCounter = 1
      while (currentDate <= now) {
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
      const currentDate = new Date(currentStartDate)
      while (currentDate <= now) {
        const dateKey = formatDateKeyMonth(currentDate)
        if (!groupedData[dateKey]) {
          groupedData[dateKey] = 0
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Count printed KTA per date group
    currentKTA.forEach((kta) => {
      let dateKey: string

      if (period === 'week') {
        dateKey = formatDateKey(kta.createdAt)
      } else if (period === 'month') {
        const dayOfMonth = kta.createdAt.getDate()
        const groupDay = Math.floor((dayOfMonth - 1) / 5) * 5 + 1
        const groupDate = new Date(kta.createdAt)
        groupDate.setDate(groupDay)
        dateKey = formatDateKey(groupDate)
      } else {
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

    // Calculate current period total
    const currentCount = currentKTA.length

    // Calculate right side growth percentage
    const rightGrowthPercentage = rightLabelPrevValue > 0
      ? ((rightLabelValue - rightLabelPrevValue) / rightLabelPrevValue) * 100
      : (rightLabelValue > 0 ? 100 : 0)

    return NextResponse.json({
      success: true,
      data: chartData,
      currentCount,
      rightLabel: {
        value: rightLabelValue,
        prevValue: rightLabelPrevValue,
        growthPercentage: Math.round(rightGrowthPercentage * 10) / 10,
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
    const startDay = date.getDate()
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const endDay = Math.min(startDay + 4, lastDayOfMonth)
    return `${startDay}-${endDay} ${date.toLocaleDateString('id-ID', { month: 'short' })}`
  } else {
    return date.toLocaleDateString('id-ID', { month: 'short' })
  }
}
