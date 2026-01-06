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

    // Fetch KTA requests grouped by date
    const ktaRequests = await prisma.kTARequest.findMany({
      where: {
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

    // Group by date
    const groupedData: Record<string, number> = {}

    // Initialize all dates in the range with 0
    const currentDate = new Date(startDate)
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().split('T')[0]
      groupedData[dateKey] = 0
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Count submissions per date
    ktaRequests.forEach((request) => {
      const dateKey = request.createdAt.toISOString().split('T')[0]
      if (groupedData.hasOwnProperty(dateKey)) {
        groupedData[dateKey]++
      }
    })

    // Convert to array format for chart
    const chartData = Object.entries(groupedData).map(([date, count]) => ({
      date: formatDate(date, period),
      count,
    }))

    return NextResponse.json({
      success: true,
      data: chartData,
    })
  } catch (error) {
    console.error('Error fetching daily submissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
