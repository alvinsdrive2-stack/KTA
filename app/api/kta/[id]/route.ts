import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        daerah: {
          select: {
            namaDaerah: true
          }
        },
        klasifikasi: true
      }
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    // Check permissions - DAERAH can only view their own, PUSAT/ADMIN can view any
    if (session.user.role === 'DAERAH' && ktaRequest.daerahId !== session.user.daerahId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: ktaRequest
    })

  } catch (error) {
    console.error('Get KTA request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the KTA request
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      include: {
        payments: true
      }
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    // Check permissions - only DAERAH can delete their own requests, PUSAT/ADMIN can delete any
    if (session.user.role === 'DAERAH' && ktaRequest.daerahId !== session.user.daerahId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cannot delete if already paid, approved, or printed
    if (['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED', 'READY_FOR_PUSAT'].includes(ktaRequest.status)) {
      return NextResponse.json({
        error: 'Tidak dapat menghapus permohonan yang sudah diproses'
      }, { status: 400 })
    }

    // Cannot delete if has payments
    if (ktaRequest.payments && ktaRequest.payments.length > 0) {
      return NextResponse.json({
        error: 'Tidak dapat menghapus permohonan yang sudah memiliki pembayaran'
      }, { status: 400 })
    }

    // Delete the KTA request (cascade will delete related records)
    await prisma.kTARequest.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Permohonan KTA berhasil dihapus'
    })

  } catch (error) {
    console.error('Delete KTA request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
