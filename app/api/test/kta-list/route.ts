import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test query without auth
    const [ktaRequests, total] = await Promise.all([
      prisma.kTARequest.findMany({
        include: {
          requestedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
          daerah: {
            select: {
              id: true,
              namaDaerah: true,
              kodeDaerah: true,
              // kodePropinsi: true, // Temporarily commented out
            },
          },
          payments: {
            select: {
              id: true,
              jumlah: true,
              statusPembayaran: true,
              paidAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Limit for testing
      }),
      prisma.kTARequest.count(),
    ])

    return NextResponse.json({
      success: true,
      data: ktaRequests,
      total: total,
      debug: {
        count: ktaRequests.length,
        sample: ktaRequests[0]?.daerah
      }
    })
  } catch (error) {
    console.error('Test KTA list error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}