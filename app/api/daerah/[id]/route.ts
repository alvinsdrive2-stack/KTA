import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// Get details for a specific daerah (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can access
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const daerah = await prisma.daerah.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        kodePropinsi: true,
        alamat: true,
        telepon: true,
        email: true,
        isActive: true,
        diskonPersen: true,
        createdAt: true,
        _count: {
          select: {
            ktaRequests: true,
            users: true,
          }
        }
      }
    })

    if (!daerah) {
      return NextResponse.json({ error: 'Daerah not found' }, { status: 404 })
    }

    // Get users in this daerah
    const users = await prisma.user.findMany({
      where: { daerahId: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get KTA status breakdown
    const ktaStats = await prisma.kTARequest.groupBy({
      by: ['status'],
      where: { daerahId: params.id },
      _count: { status: true }
    })

    const statusBreakdown: Record<string, number> = {}
    ktaStats.forEach(stat => {
      statusBreakdown[stat.status] = stat._count.status
    })

    // Get recent KTA requests
    const recentKta = await prisma.kTARequest.findMany({
      where: { daerahId: params.id },
      select: {
        id: true,
        idIzin: true,
        nama: true,
        jenjang: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Get monthly KTA data for chart (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyKtaData = await prisma.kTARequest.findMany({
      where: {
        daerahId: params.id,
        createdAt: { gte: sixMonthsAgo }
      },
      select: {
        createdAt: true,
        status: true
      }
    })

    // Group by month
    const monthlyData: Record<string, { total: number; printed: number }> = {}
    monthlyKtaData.forEach(kta => {
      const monthKey = new Date(kta.createdAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, printed: 0 }
      }
      monthlyData[monthKey].total++
      if (kta.status === 'PRINTED') {
        monthlyData[monthKey].printed++
      }
    })

    // Convert to array format
    const chartData = Object.entries(monthlyData).map(([month, counts]) => ({
      date: month,
      total: counts.total,
      printed: counts.printed
    }))

    // Calculate 6-month comparison
    const now = new Date()
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 6)

    const last6Months = await prisma.kTARequest.count({
      where: {
        daerahId: params.id,
        createdAt: { gte: threeMonthsAgo }
      }
    })

    const sixMonthsBeforeStart = new Date(threeMonthsAgo)
    sixMonthsBeforeStart.setMonth(sixMonthsBeforeStart.getMonth() - 6)

    const previous6Months = await prisma.kTARequest.count({
      where: {
        daerahId: params.id,
        createdAt: {
          gte: sixMonthsBeforeStart,
          lt: threeMonthsAgo
        }
      }
    })

    const totalPrinted = await prisma.kTARequest.count({
      where: {
        daerahId: params.id,
        status: 'PRINTED'
      }
    })

    const comparisonData = {
      last6Months,
      previous6Months,
      growthPercentage: previous6Months > 0 ? ((last6Months - previous6Months) / previous6Months) * 100 : (last6Months > 0 ? 100 : 0),
      totalPrinted
    }

    return NextResponse.json({
      success: true,
      data: {
        daerah: {
          ...daerah,
          statusBreakdown
        },
        users,
        recentKta,
        chartData,
        comparisonData
      }
    })

  } catch (error) {
    console.error('Get daerah detail error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update daerah (diskon, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can update
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { diskonPersen, isActive } = body

    // Validate diskon
    if (diskonPersen !== undefined && (typeof diskonPersen !== 'number' || diskonPersen < 0 || diskonPersen > 100)) {
      return NextResponse.json({ error: 'Diskon must be between 0 and 100' }, { status: 400 })
    }

    // Update daerah
    const updated = await prisma.daerah.update({
      where: { id: params.id },
      data: {
        ...(diskonPersen !== undefined && { diskonPersen }),
        ...(isActive !== undefined && { isActive })
      },
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        diskonPersen: true,
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      data: updated
    })

  } catch (error) {
    console.error('Update daerah error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
