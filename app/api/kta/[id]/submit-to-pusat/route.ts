import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

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
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        payment: true,
      },
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    // Validate requirements
    if (!ktaRequest.ktpUrl || !ktaRequest.fotoUrl) {
      return NextResponse.json(
        { error: 'Please upload all required documents' },
        { status: 400 }
      )
    }

    if (!ktaRequest.payment || ktaRequest.payment.status !== 'PAID') {
      return NextResponse.json(
        { error: 'Payment is required' },
        { status: 400 }
      )
    }

    // Update status
    const updatedRequest = await prisma.kTARequest.update({
      where: { id: params.id },
      data: {
        status: 'WAITING_APPROVAL',
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