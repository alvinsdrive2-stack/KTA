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

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'week'

    const userRole = session.user?.role
    const userDaerahId = session.user?.daerahId

    const now = new Date()
    now.setHours(23, 59, 59, 999)

    // Calculate current period dates
    let currentStartDate = new Date(now.getTime())
    let chartStartDate = new Date(now.getTime()) // For chart data range
    let prevStartDate: Date
    let prevEndDate: Date

    switch (period) {
      case 'week':
        chartStartDate.setDate(now.getDate() - 7)
        currentStartDate = new Date(chartStartDate)
        // Previous week: 7-14 days ago
        prevStartDate = new Date(now.getTime())
        prevStartDate.setDate(now.getDate() - 14)
        prevEndDate = new Date(now.getTime())
        prevEndDate.setDate(now.getDate() - 8)
        break
      case 'month':
        // For labels: use calendar month
        currentStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
        // For chart: still use 30 days for visualization
        chartStartDate.setDate(now.getDate() - 30)
        // Previous month: 30-60 days ago
        prevStartDate = new Date(now.getTime())
        prevStartDate.setDate(now.getDate() - 60)
        prevEndDate = new Date(now.getTime())
        prevEndDate.setDate(now.getDate() - 31)
        break
      case 'year':
        chartStartDate.setFullYear(now.getFullYear() - 1)
        currentStartDate = new Date(chartStartDate)
        // Previous year: 1-2 years ago
        prevStartDate = new Date(now.getTime())
        prevStartDate.setFullYear(now.getFullYear() - 2)
        prevEndDate = new Date(now.getTime())
        prevEndDate.setFullYear(now.getFullYear() - 1)
        prevEndDate.setHours(23, 59, 59, 999)
        break
      default:
        chartStartDate.setDate(now.getDate() - 7)
        currentStartDate = new Date(chartStartDate)
        prevStartDate = new Date(now.getTime())
        prevStartDate.setDate(now.getDate() - 14)
        prevEndDate = new Date(now.getTime())
        prevEndDate.setDate(now.getDate() - 8)
    }

    currentStartDate.setHours(0, 0, 0, 0)
    chartStartDate.setHours(0, 0, 0, 0)
    prevStartDate.setHours(0, 0, 0, 0)
    prevEndDate.setHours(23, 59, 59, 999)

    // Build where clause for current period - include both READY_TO_PRINT and PRINTED
    const currentWhereClause: any = {
      createdAt: {
        gte: chartStartDate,
        lte: now,
      },
      status: { in: ['READY_TO_PRINT', 'PRINTED'] }, // Include both statuses
    }

    // Build where clause for previous period (for comparison)
    const prevWhereClause: any = {
      createdAt: {
        gte: prevStartDate,
        lte: prevEndDate,
      },
      status: { in: ['READY_TO_PRINT', 'PRINTED'] },
    }

    // Filter by daerahId for DAERAH role
    if (userRole === 'DAERAH' && userDaerahId) {
      currentWhereClause.daerahId = userDaerahId
      prevWhereClause.daerahId = userDaerahId
    }

    // Fetch current period KTA
    const currentKTA = await prisma.kTARequest.findMany({
      where: currentWhereClause,
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Fetch previous period total count (for percentage comparison)
    const prevCount = await prisma.kTARequest.count({
      where: prevWhereClause,
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
          ...currentWhereClause,
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
          ...currentWhereClause,
          createdAt: {
            gte: yesterdayStart,
            lte: yesterdayEnd,
          },
        },
      })
    } else if (period === 'month') {
      // Last 5 days count - but only from current calendar month
      const fiveDaysAgo = new Date(now)
      fiveDaysAgo.setDate(now.getDate() - 5)
      fiveDaysAgo.setHours(0, 0, 0, 0)
      // Use currentStartDate (beginning of calendar month) as lower bound
      const effectiveStart = fiveDaysAgo > currentStartDate ? fiveDaysAgo : currentStartDate
      rightLabelValue = await prisma.kTARequest.count({
        where: {
          ...currentWhereClause,
          createdAt: {
            gte: effectiveStart,
            lte: now,
          },
        },
      })
      // Previous 5 days for comparison (also constrained to current month)
      const tenDaysAgo = new Date(fiveDaysAgo)
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 5)
      const sixDaysAgo = new Date(fiveDaysAgo)
      sixDaysAgo.setMilliseconds(sixDaysAgo.getMilliseconds() - 1)
      // Only count if within current month
      const prevStart = tenDaysAgo > currentStartDate ? tenDaysAgo : currentStartDate
      rightLabelPrevValue = await prisma.kTARequest.count({
        where: {
          ...currentWhereClause,
          createdAt: {
            gte: prevStart,
            lte: sixDaysAgo,
          },
        },
      })
    } else {
      // This month count
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      rightLabelValue = await prisma.kTARequest.count({
        where: {
          ...currentWhereClause,
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
          ...currentWhereClause,
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      })
    }

    // Group by date based on period - use chartStartDate for full chart range
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

    // Count submissions per date group
    currentKTA.forEach((request) => {
      let dateKey: string

      if (period === 'week') {
        dateKey = formatDateKey(request.createdAt)
      } else if (period === 'month') {
        const dayOfMonth = request.createdAt.getDate()
        const groupDay = Math.floor((dayOfMonth - 1) / 5) * 5 + 1
        const groupDate = new Date(request.createdAt)
        groupDate.setDate(groupDay)
        dateKey = formatDateKey(groupDate)
      } else if (period === 'year') {
        dateKey = formatDateKeyMonth(request.createdAt)
      } else {
        // Fallback
        dateKey = formatDateKey(request.createdAt)
      }

      if (groupedData.hasOwnProperty(dateKey)) {
        groupedData[dateKey]++
      }
    })

    // Debug logging
    console.log(`[Daily Submissions] Period: ${period}, KTA count: ${currentKTA.length}, Date groups: ${Object.keys(groupedData).length}`)
    const sampleData = Object.entries(groupedData).slice(0, 3)
    console.log(`[Daily Submissions] Sample data:`, sampleData.map(([d, c]) => `${d}: ${c}`).join(', '))

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
    console.error('Error fetching daily submissions:', error)
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
