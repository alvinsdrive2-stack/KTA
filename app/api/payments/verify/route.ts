import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can verify payments
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { bulkPaymentId, approved, reason } = await request.json()

    if (!bulkPaymentId) {
      return NextResponse.json({ error: 'Bulk payment ID is required' }, { status: 400 })
    }

    // Get the bulk payment with its payments
    const bulkPayment = await prisma.bulkPayment.findUnique({
      where: { id: bulkPaymentId },
      include: {
        payments: {
          include: {
            ktaRequest: true
          }
        }
      }
    })

    if (!bulkPayment) {
      return NextResponse.json({ error: 'Bulk payment not found' }, { status: 404 })
    }

    // Update bulk payment status
    const updatedBulkPayment = await prisma.bulkPayment.update({
      where: { id: bulkPaymentId },
      data: {
        status: approved ? 'VERIFIED' : 'REJECTED',
        verifiedBy: session.user.id,
        verifiedAt: new Date()
      }
    })

    // Update all related payment records
    await prisma.payment.updateMany({
      where: { bulkPaymentId },
      data: {
        statusPembayaran: approved ? 'PAID' : 'REJECTED',
        paidAt: approved ? new Date() : null
      }
    })

    // If approved, update KTA requests status
    if (approved) {
      await prisma.kTARequest.updateMany({
        where: {
          id: {
            in: bulkPayment.payments.map(p => p.ktaRequestId)
          }
        },
        data: {
          status: 'APPROVED_BY_PUSAT'
        }
      })
    } else {
      // If rejected, reset KTA status to DRAFT
      await prisma.kTARequest.updateMany({
        where: {
          id: {
            in: bulkPayment.payments.map(p => p.ktaRequestId)
          }
        },
        data: {
          status: 'DRAFT'
        }
      })
    }

    // Create approval record for each KTA if approved
    if (approved) {
      const approvalPromises = bulkPayment.payments.map(payment =>
        prisma.approval.create({
          data: {
            ktaRequestId: payment.ktaRequestId,
            approvedBy: session.user.id,
            status: 'APPROVED',
            catatan: `Pembayaran verified - Invoice: ${bulkPayment.invoiceNumber}`
          }
        })
      )
      await Promise.all(approvalPromises)
    }

    return NextResponse.json({
      success: true,
      message: approved ? 'Pembayaran berhasil diverifikasi' : 'Pembayaran ditolak',
      bulkPayment: updatedBulkPayment
    })

  } catch (error) {
    console.error('Verify payment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}