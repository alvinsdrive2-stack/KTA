import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

// Get statistics for all daerah (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can access
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all daerah with their KTA count and user count
    const daerahList = await prisma.daerah.findMany({
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        kodePropinsi: true,
        isActive: true,
        diskonPersen: true,
        _count: {
          select: {
            ktaRequests: true,
            users: true,
          }
        }
      },
      orderBy: {
        kodeDaerah: 'asc'
      }
    })

    // Get status breakdown per daerah for KTA requests
    const daerahIds = daerahList.map(d => d.id)

    const statusStats = await prisma.kTARequest.groupBy({
      by: ['daerahId', 'status'],
      where: {
        daerahId: { in: daerahIds }
      },
      _count: {
        status: true
      }
    })

    // Create a map of status counts per daerah
    const statusMap = new Map<string, Record<string, number>>()
    statusStats.forEach(stat => {
      if (!statusMap.has(stat.daerahId)) {
        statusMap.set(stat.daerahId, {})
      }
      statusMap.get(stat.daerahId)![stat.status] = stat._count.status
    })

    // Combine data
    const data = daerahList.map(daerah => ({
      id: daerah.id,
      namaDaerah: daerah.namaDaerah,
      kodeDaerah: daerah.kodeDaerah,
      kodePropinsi: daerah.kodePropinsi,
      isActive: daerah.isActive,
      diskonPersen: daerah.diskonPersen,
      totalKta: daerah._count.ktaRequests,
      totalUsers: daerah._count.users,
      statusBreakdown: statusMap.get(daerah.id) || {}
    }))

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Get daerah stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
