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

    // Only DAERAH users can upload bulk payments
    if (session.user.role !== 'DAERAH') {
      return NextResponse.json({ error: 'Forbidden - Only DAERAH users can upload payments' }, { status: 403 })
    }

    const formData = await request.formData()
    const paymentProof = formData.get('paymentProof') as File
    const requestIds = JSON.parse(formData.get('requestIds') as string)

    if (!paymentProof || !requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Verify all requests belong to the user's daerah and are in correct status
    const ktaRequests = await prisma.kTARequest.findMany({
      where: {
        id: { in: requestIds },
        daerahId: session.user.daerahId
      },
      include: {
        daerah: true,
        payments: true
      }
    })

    if (ktaRequests.length !== requestIds.length) {
      return NextResponse.json({
        error: 'Some requests are not found or not from your daerah'
      }, { status: 400 })
    }

    // Check if all requests are in correct status for payment
    const invalidRequests = ktaRequests.filter(req => {
      // Should not have existing payment
      return req.payments && req.payments.length > 0
    })

    if (invalidRequests.length > 0) {
      return NextResponse.json({
        error: 'Some requests already have payments'
      }, { status: 400 })
    }

    // Save payment proof file
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

    // Calculate total amount from each request's hargaFinal
    const totalAmount = ktaRequests.reduce((sum, req) => sum + (req.hargaFinal || 0), 0)

    if (totalAmount === 0) {
      return NextResponse.json({
        error: 'Harga untuk KTA belum ditetapkan. Silakan hubungi administrator.'
      }, { status: 400 })
    }

    // Generate invoice number
    const invoiceNumber = `INV-${session.user.daerahId}-${timestamp}`

    // Create bulk payment record
    const bulkPayment = await prisma.bulkPayment.create({
      data: {
        invoiceNumber,
        daerahId: session.user.daerahId!,
        totalJumlah: ktaRequests.length,
        totalNominal: totalAmount,
        buktiPembayaranUrl: `/uploads/payments/${fileName}`,
        status: 'PENDING',
        submittedBy: session.user.id
      }
    })

    // Create individual payment records for each KTA request using their hargaFinal
    const paymentPromises = ktaRequests.map(request =>
      prisma.payment.create({
        data: {
          ktaRequestId: request.id,
          bulkPaymentId: bulkPayment.id,
          jumlah: request.hargaFinal || 0, // Use hargaFinal from each request
          statusPembayaran: 'PENDING',
          invoiceNumber,
          rekeningTujuan: 'BNI - 1234567890 - a.n. LSP GATENSI NASIONAL'
        }
      })
    )

    await Promise.all(paymentPromises)

    // Update KTA requests status
    await prisma.kTARequest.updateMany({
      where: {
        id: { in: requestIds }
      },
      data: {
        status: 'WAITING_PAYMENT'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pembayaran berhasil diupload',
      invoiceNumber,
      totalAmount,
      requestId: bulkPayment.id
    })

  } catch (error) {
    console.error('Bulk payment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}