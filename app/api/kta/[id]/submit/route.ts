import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const ktaRequest = await prisma.kTARequest.update({
      where: {
        id: id,
        requestedBy: session.user.id,
      },
      data: {
        status: 'WAITING_PAYMENT',
      },
    })

    return NextResponse.json({
      success: true,
      data: ktaRequest,
    })
  } catch (error) {
    console.error('Submit KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}