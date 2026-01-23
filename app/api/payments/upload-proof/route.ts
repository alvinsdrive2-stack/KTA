import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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

    // Save payment proof file to public/uploads/payments/
    const timestamp = Date.now()
    const fileExtension = paymentProof.name.split('.').pop()
    const fileName = `payment-proof-${timestamp}.${fileExtension}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'payments')

    // Create directory if it doesn't exist
    await mkdir(uploadDir, { recursive: true })

    // Convert file to buffer and save
    const bytes = await paymentProof.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    // Use URL path for accessing the file
    const proofUrl = `/uploads/payments/${fileName}`

    // Update bulk payment with proof URL and PAID status
    await prisma.bulkPayment.update({
      where: { id: bulkPaymentId },
      data: {
        buktiPembayaranUrl: proofUrl,
        status: 'PAID',
      }
    })

    // Update all related payments to PAID
    await prisma.payment.updateMany({
      where: { bulkPaymentId },
      data: {
        statusPembayaran: 'PAID',
        paidAt: new Date()
      }
    })

    // Update all related KTA requests status based on role
    const ktaRequestIds = bulkPayment.payments.map(p => p.ktaRequestId)

    // Get user role from session
    const isDaerah = session.user.role === 'DAERAH'
    const ktaStatus = isDaerah ? 'READY_FOR_PUSAT' : 'READY_FOR_PUSAT'

    await prisma.kTARequest.updateMany({
      where: {
        id: { in: ktaRequestIds }
      },
      data: {
        status: ktaStatus
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
