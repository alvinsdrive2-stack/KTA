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

    const body = await request.json()
    const { requestIds } = body

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json({ error: 'Invalid request IDs' }, { status: 400 })
    }

    // Fetch KTA requests
    const ktaRequests = await prisma.kTARequest.findMany({
      where: {
        id: { in: requestIds },
        daerahId: session.user.daerahId
      }
    })

    if (ktaRequests.length !== requestIds.length) {
      return NextResponse.json({ error: 'Some KTA requests not found' }, { status: 404 })
    }

    // Calculate total
    const totalNominal = ktaRequests.reduce((sum, req) => sum + (req.hargaFinal || 0), 0)

    // Generate invoice number: KTA-INV/LSP-GKK/[tahun]/[bulan]-[sequence]
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')

    // Get sequence number for this month
    const existingInvoices = await prisma.bulkPayment.findMany({
      where: {
        invoiceNumber: {
          startsWith: `KTA-INV/LSP-GKK/${year}/${month}-`
        }
      },
      orderBy: {
        invoiceNumber: 'desc'
      },
      take: 1
    })

    let sequence = 1
    if (existingInvoices.length > 0) {
      const lastInvoiceNumber = existingInvoices[0].invoiceNumber
      const lastSequence = parseInt(lastInvoiceNumber.split('-').pop() || 0)
      sequence = lastSequence + 1
    }

    const sequenceStr = String(sequence).padStart(4, '0')
    const invoiceNumber = `KTA-INV/LSP-GKK/${year}/${month}-${sequenceStr}`

    console.log('Creating bulk payment with data:', {
      invoiceNumber,
      totalJumlah: ktaRequests.length,
      totalNominal,
      status: 'PENDING',
      daerahId: session.user.daerahId,
      buktiPembayaranUrl: '',
      submittedBy: session.user.id,
    })

    // Create bulk payment record
    const bulkPayment = await prisma.bulkPayment.create({
      data: {
        invoiceNumber,
        totalJumlah: ktaRequests.length,
        totalNominal,
        status: 'PENDING',
        daerahId: session.user.daerahId,
        buktiPembayaranUrl: '', // Empty string for now, will be filled when payment proof uploaded
        submittedBy: session.user.id
      }
    })

    // Create individual payment records for each KTA request
    const paymentPromises = ktaRequests.map(req =>
      prisma.payment.create({
        data: {
          ktaRequestId: req.id,
          bulkPaymentId: bulkPayment.id,
          invoiceNumber,
          rekeningTujuan: 'BNI - 1234567890 - a.n. LSP GATENSI NASIONAL',
          jumlah: req.hargaFinal || 0,
          statusPembayaran: 'PENDING'
        }
      })
    )

    await Promise.all(paymentPromises)

    return NextResponse.json({
      success: true,
      data: bulkPayment
    })

  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
