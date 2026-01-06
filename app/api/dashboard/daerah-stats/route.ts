import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

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
        status: 'PRINTED',
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
      const dateKey = currentDate.toISOString().split('T')[0]
      groupedData[dateKey] = 0
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Count printed KTA per date
    printedKTA.forEach((kta) => {
      const dateKey = kta.createdAt.toISOString().split('T')[0]
      if (groupedData.hasOwnProperty(dateKey)) {
        groupedData[dateKey]++
      }
    })

    // Convert to array format for chart
    const chartData = Object.entries(groupedData).map(([date, count]) => ({
      date: formatDate(date, period),
      count,
    }))

    // Calculate comparison: last 6 months vs previous 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(now.getMonth() - 6)

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(now.getMonth() - 12)

    // Last 6 months printed KTA
    const last6Months = await prisma.kTARequest.count({
      where: {
        daerahId: userDaerahId,
        status: 'PRINTED',
        createdAt: {
          gte: sixMonthsAgo,
          lte: now,
        },
      },
    })

    // Previous 6 months printed KTA
    const previous6Months = await prisma.kTARequest.count({
      where: {
        daerahId: userDaerahId,
        status: 'PRINTED',
        createdAt: {
          gte: twelveMonthsAgo,
          lt: sixMonthsAgo,
        },
      },
    })

    // Total printed KTA for this daerah
    const totalPrinted = await prisma.kTARequest.count({
      where: {
        daerahId: userDaerahId,
        status: 'PRINTED',
      },
    })

    // Calculate growth percentage
    const growthPercentage = previous6Months > 0
      ? ((last6Months - previous6Months) / previous6Months) * 100
      : (last6Months > 0 ? 100 : 0)

    return NextResponse.json({
      success: true,
      data: chartData,
      comparison: {
        last6Months,
        previous6Months,
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
