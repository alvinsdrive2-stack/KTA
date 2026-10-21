import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import {
  endOfWibDay,
  formatDateKey,
  formatDateKeyMonth,
  shiftWibDate,
  startOfWibDay,
  startOfWibMonth,
} from '@/lib/utils'

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

    const now = endOfWibDay(new Date())

    // Calculate current period dates — semua batas dipatok kalender WIB
    let currentStartDate = startOfWibDay(now)
    let chartStartDate = startOfWibDay(now) // For chart data range

    switch (period) {
      case 'week':
        chartStartDate = startOfWibDay(shiftWibDate(now, { days: -7 }))
        currentStartDate = chartStartDate
        break
      case 'month':
        // For labels: use calendar month
        currentStartDate = startOfWibMonth(now)
        // For chart: still use 30 days for visualization
        chartStartDate = startOfWibDay(shiftWibDate(now, { days: -30 }))
        break
      case 'year':
        chartStartDate = startOfWibDay(shiftWibDate(now, { years: -1 }))
        currentStartDate = chartStartDate
        break
      default:
        chartStartDate = startOfWibDay(shiftWibDate(now, { days: -30 }))
        currentStartDate = chartStartDate
    }

    // Build base where clause - include both READY_TO_PRINT and PRINTED
    const baseWhereClause: Prisma.KTARequestWhereInput = {
      daerahId: userDaerahId,
      status: { in: ['READY_TO_PRINT', 'PRINTED'] }, // Include both statuses
    }

    // Fetch current period printed KTA - use chartStartDate for complete chart data
    const currentKTA = await prisma.kTARequest.findMany({
      where: {
        ...baseWhereClause,
        createdAt: {
          gte: chartStartDate,
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
      const todayStart = startOfWibDay(now)
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
      const yesterdayStart = startOfWibDay(shiftWibDate(todayStart, { days: -1 }))
      const yesterdayEnd = new Date(todayStart.getTime() - 1)
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
      // Last 5 days count - but only from current calendar month
      const fiveDaysAgo = startOfWibDay(shiftWibDate(now, { days: -5 }))
      // Use currentStartDate (beginning of calendar month) as lower bound
      const effectiveStart = fiveDaysAgo > currentStartDate ? fiveDaysAgo : currentStartDate
      rightLabelValue = await prisma.kTARequest.count({
        where: {
          ...baseWhereClause,
          createdAt: {
            gte: effectiveStart,
            lte: now,
          },
        },
      })
      // Previous 5 days for comparison (also constrained to current month)
      const tenDaysAgo = startOfWibDay(shiftWibDate(fiveDaysAgo, { days: -5 }))
      const sixDaysAgo = new Date(fiveDaysAgo.getTime() - 1)
      // Only count if within current month
      const prevStart = tenDaysAgo > currentStartDate ? tenDaysAgo : currentStartDate
      rightLabelPrevValue = await prisma.kTARequest.count({
        where: {
          ...baseWhereClause,
          createdAt: {
            gte: prevStart,
            lte: sixDaysAgo,
          },
        },
      })
    } else {
      // This month count
      const monthStart = startOfWibMonth(now)
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
      const lastMonthStart = startOfWibMonth(now, -1)
      const lastMonthEnd = new Date(monthStart.getTime() - 1)
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

    // Initialize date labels based on period - use chartStartDate for full chart range
    const groupedData: Record<string, number> = {}

    if (period === 'week') {
      const currentDate = new Date(chartStartDate)
      while (currentDate <= now) {
        const dateKey = formatDateKey(currentDate)
        groupedData[dateKey] = 0
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else if (period === 'month') {
      const currentDate = new Date(chartStartDate)
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
      const currentDate = new Date(chartStartDate)
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

    // Calculate current period total - use currentStartDate for correct "Bulan Ini" count
    const currentCount = currentKTA.filter(kta =>
      kta.createdAt >= currentStartDate && kta.createdAt <= now
    ).length

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
