import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test without auth first
    const payments = await prisma.bulkPayment.findMany({
      take: 5,
      include: {
        daerah: {
          select: {
            id: true,
            namaDaerah: true,
            kodeDaerah: true
          }
        },
        submittedByUser: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            payments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: payments,
      count: payments.length
    })
  } catch (error) {
    console.error('Test payments error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}