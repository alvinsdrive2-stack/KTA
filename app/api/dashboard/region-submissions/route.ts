import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'week'

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
        startDate.setDate(now.getDate() - 7)
    }

    // Reset time to start of day for accurate date comparison
    startDate.setHours(0, 0, 0, 0)
    now.setHours(23, 59, 59, 999)

    // Fetch KTA requests with region info
    const ktaRequests = await prisma.kTARequest.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: now,
        },
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

    // Initialize date range
    const dateLabels: string[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().split('T')[0]
      dateLabels.push(dateKey)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Fetch all active regions
    const allRegions = await prisma.daerah.findMany({
      where: { isActive: true },
      select: { namaDaerah: true },
      orderBy: { namaDaerah: 'asc' },
    })

    // Group by date and region - initialize ALL regions with 0
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
      // Only count if the region exists in our map
      if (regionName && regionDataMap[regionName]) {
        const dateKey = request.createdAt.toISOString().split('T')[0]
        regionDataMap[regionName][dateKey]++
      }
    })

    // Get top regions by total count
    const regionTotals: Record<string, number> = {}
    Object.entries(regionDataMap).forEach(([region, dates]) => {
      regionTotals[region] = Object.values(dates).reduce((sum, count) => sum + count, 0)
    })

    const topRegions = Object.entries(regionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Top 5 regions
      .map(([region]) => region)

    // Build chart data - one data point per date
    const chartData = dateLabels.map((date) => {
      const dataPoint: any = {
        date: formatDate(date, period),
      }

      topRegions.forEach((region) => {
        dataPoint[region] = regionDataMap[region]?.[date] || 0
      })

      return dataPoint
    })

    return NextResponse.json({
      success: true,
      data: chartData,
      regions: topRegions,
    })
  } catch (error) {
    console.error('Error fetching region submissions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function formatDate(dateString: string, period: string): string {
  const date = new Date(dateString)

  if (period === 'week') {
    // For week, show day name (e.g., "Sen", "Sel")
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    return days[date.getDay()]
  } else if (period === 'month') {
    // For month, show date (e.g., "1 Jan", "15 Jan")
    return date.getDate() + ' ' + date.toLocaleDateString('id-ID', { month: 'short' })
  } else {
    // For year, show month name (e.g., "Jan", "Feb")
    return date.toLocaleDateString('id-ID', { month: 'short' })
  }
}
