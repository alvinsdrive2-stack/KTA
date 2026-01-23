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

    // Initialize all dates in the range with 0
    const groupedData: Record<string, number> = {}
    const currentDate = new Date(startDate)
    while (currentDate <= now) {
      // Use local timezone to avoid UTC shift
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`
      groupedData[dateKey] = 0
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Count printed KTA per date - use local timezone to avoid UTC shift
    printedKTA.forEach((kta) => {
      // Get the local date components to avoid UTC conversion issues
      const localDate = new Date(kta.createdAt.getTime())
      // Format as YYYY-MM-DD in local timezone
      const year = localDate.getFullYear()
      const month = String(localDate.getMonth() + 1).padStart(2, '0')
      const day = String(localDate.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`

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

function formatDate(dateString: string, period: string): string {
  const date = new Date(dateString)

  if (period === 'week') {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    return days[date.getDay()]
  } else if (period === 'month') {
    return date.getDate() + ' ' + date.toLocaleDateString('id-ID', { month: 'short' })
  } else {
    return date.toLocaleDateString('id-ID', { month: 'short' })
  }
}
