import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if KTA request exists and belongs to user
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      include: { payments: true },
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    if (
      ktaRequest.requestedBy !== session.user.id &&
      session.user.role !== 'ADMIN' &&
      session.user.role !== 'PUSAT'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate requirements
    if (!ktaRequest.ktpUrl || !ktaRequest.fotoUrl) {
      return NextResponse.json(
        { error: 'Please upload all required documents' },
        { status: 400 }
      )
    }

    const paidPayment = ktaRequest.payments.find(
      (p) => p.statusPembayaran === 'PAID' || p.statusPembayaran === 'VERIFIED'
    )
    if (!paidPayment) {
      return NextResponse.json(
        { error: 'Payment is required' },
        { status: 400 }
      )
    }

    // Update status
    const updatedRequest = await prisma.kTARequest.update({
      where: { id: params.id },
      data: {
        status: 'READY_FOR_PUSAT',
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedRequest,
    })
  } catch (error) {
    console.error('Submit to pusat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}