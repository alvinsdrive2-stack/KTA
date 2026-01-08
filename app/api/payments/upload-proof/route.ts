import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const paymentProof = formData.get('paymentProof') as File
    const bulkPaymentId = formData.get('bulkPaymentId') as string

    if (!paymentProof || !bulkPaymentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get bulk payment
    const bulkPayment = await prisma.bulkPayment.findUnique({
      where: { id: bulkPaymentId },
      include: {
        payments: true
      }
    })

    if (!bulkPayment) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check permissions
    if (session.user.role === 'DAERAH' && bulkPayment.daerahId !== session.user.daerahId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check status
    if (bulkPayment.status !== 'PENDING') {
      return NextResponse.json({ error: 'Invoice is not in PENDING status' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await paymentProof.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${paymentProof.type};base64,${base64}`

    // Update bulk payment with proof
    await prisma.bulkPayment.update({
      where: { id: bulkPaymentId },
      data: {
        buktiPembayaranUrl: dataUrl,
        status: 'PAID'
      }
    })

    // Update all related KTA requests status
    const ktaRequestIds = bulkPayment.payments.map(p => p.ktaRequestId)
    await prisma.kTARequest.updateMany({
      where: {
        id: { in: ktaRequestIds }
      },
      data: {
        status: 'WAITING_PAYMENT'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Bukti pembayaran berhasil diupload'
    })

  } catch (error) {
    console.error('Upload proof error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
