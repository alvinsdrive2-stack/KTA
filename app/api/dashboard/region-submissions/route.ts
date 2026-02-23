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

    const now = new Date()
    now.setHours(23, 59, 59, 999)

    // Calculate current period dates
    let currentStartDate = new Date(now.getTime())
    let chartStartDate = new Date(now.getTime()) // For chart data range

    switch (period) {
      case 'week':
        chartStartDate.setDate(now.getDate() - 7)
        currentStartDate = new Date(chartStartDate)
        break
      case 'month':
        // For labels: use calendar month
        currentStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
        // For chart: still use 30 days for visualization
        chartStartDate.setDate(now.getDate() - 30)
        break
      case 'year':
        currentStartDate.setFullYear(now.getFullYear() - 1)
        chartStartDate = new Date(currentStartDate)
        break
      default:
        chartStartDate.setDate(now.getDate() - 7)
        currentStartDate = new Date(chartStartDate)
    }

    currentStartDate.setHours(0, 0, 0, 0)
    chartStartDate.setHours(0, 0, 0, 0)

    // Fetch KTA requests with region info - include both READY_TO_PRINT and PRINTED
    // Use chartStartDate for fetching data to have complete chart
    const ktaRequests = await prisma.kTARequest.findMany({
      where: {
        createdAt: {
          gte: chartStartDate,
          lte: now,
        },
        status: { in: ['READY_TO_PRINT', 'PRINTED'] }, // Include both statuses
      },
      select: {
        createdAt: true,
        daerah: {
          select: {
            namaDaerah: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Initialize date labels based on period
    const dateLabels: string[] = []

    if (period === 'week') {
      const currentDate = new Date(chartStartDate)
      while (currentDate <= now) {
        const dateKey = formatDateKey(currentDate)
        dateLabels.push(dateKey)
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

        if (!dateLabels.includes(dateKey)) {
          dateLabels.push(dateKey)
        }

        currentDate.setDate(currentDate.getDate() + 1)
        dayCounter++
      }
    } else if (period === 'year') {
      const currentDate = new Date(chartStartDate)
      while (currentDate <= now) {
        const dateKey = formatDateKeyMonth(currentDate)
        if (!dateLabels.includes(dateKey)) {
          dateLabels.push(dateKey)
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Fetch all active regions
    const allRegions = await prisma.daerah.findMany({
      where: { isActive: true },
      select: { namaDaerah: true },
      orderBy: { namaDaerah: 'asc' },
    })

    // Group by date and region
    const regionDataMap: Record<string, Record<string, number>> = {}

    allRegions.forEach((region) => {
      const regionName = region.namaDaerah
      regionDataMap[regionName] = {}
      dateLabels.forEach((date) => {
        regionDataMap[regionName][date] = 0
      })
    })

    // Fill in the counts
    ktaRequests.forEach((request) => {
      const regionName = request.daerah?.namaDaerah
      if (regionName && regionDataMap[regionName]) {
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
          // Fallback - should not reach here
          dateKey = formatDateKey(request.createdAt)
        }

        if (regionDataMap[regionName][dateKey] !== undefined) {
          regionDataMap[regionName][dateKey]++
        }
      }
    })

    // Debug logging
    console.log(`[Region Submissions] Period: ${period}, KTA Requests: ${ktaRequests.length}, Date Labels: ${dateLabels.length}`)

    // Get top regions by total count
    const regionTotals: Record<string, number> = {}
    Object.entries(regionDataMap).forEach(([region, dates]) => {
      regionTotals[region] = Object.values(dates).reduce((sum, count) => sum + count, 0)
    })

    // Debug: log region totals
    const topRegionsWithCounts = Object.entries(regionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    console.log(`[Region Submissions] Top regions with counts:`, topRegionsWithCounts.map(([r, c]) => `${r}: ${c}`).join(', '))

    const topRegions = Object.entries(regionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)  // Top 8 regions
      .map(([region]) => region)

    // Build chart data
    const chartData = dateLabels.map((date) => {
      const dataPoint: any = {
        date: formatDate(date, period),
      }

      topRegions.forEach((region) => {
        dataPoint[region] = regionDataMap[region]?.[date] || 0
      })

      return dataPoint
    })

    // Debug: log sample data
    if (chartData.length > 0) {
      console.log(`[Region Submissions] Sample chart data (first):`, JSON.stringify(chartData[0]))
      console.log(`[Region Submissions] Top regions:`, topRegions.slice(0, 3))
    }

    // Calculate right side label data based on period
    let rightLabelValue = 0
    let rightLabelText = ''

    if (period === 'week') {
      // Today's count
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      rightLabelValue = ktaRequests.filter(kta =>
        kta.createdAt >= todayStart && kta.createdAt <= now
      ).length
      rightLabelText = 'Hari Ini'
    } else if (period === 'month') {
      // Last 5 days count - only from current calendar month
      const fiveDaysAgo = new Date(now)
      fiveDaysAgo.setDate(now.getDate() - 5)
      fiveDaysAgo.setHours(0, 0, 0, 0)
      // Use currentStartDate (beginning of calendar month) as lower bound
      const effectiveStart = fiveDaysAgo > currentStartDate ? fiveDaysAgo : currentStartDate
      rightLabelValue = ktaRequests.filter(kta =>
        kta.createdAt >= effectiveStart && kta.createdAt <= now
      ).length
      rightLabelText = '5 Hari Terakhir'
    } else {
      // This month count
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      rightLabelValue = ktaRequests.filter(kta =>
        kta.createdAt >= monthStart && kta.createdAt <= now
      ).length
      rightLabelText = 'Bulan Ini'
    }

    // Calculate left label (current period total) - counts ALL regions
    const leftLabelValue = ktaRequests.filter(kta =>
      kta.createdAt >= currentStartDate && kta.createdAt <= now
    ).length

    return NextResponse.json({
      success: true,
      data: chartData,
      regions: topRegions,
      rightLabel: {
        value: rightLabelValue,
        text: rightLabelText,
      },
      // Pass left label value for ALL periods - this counts ALL regions
      currentCount: leftLabelValue,
    })
  } catch (error) {
    console.error('Error fetching region submissions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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
