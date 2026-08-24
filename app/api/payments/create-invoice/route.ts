import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { generateInvoiceNumber } from '@/lib/invoice'

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
    // For ADMIN/KEUANGAN, don't filter by daerahId - they can create invoices for any daerah
    const userRole = session.user.role
    const isPusatOrAdmin = userRole === 'ADMIN' || userRole === 'KEUANGAN'

    const ktaRequests = await prisma.kTARequest.findMany({
      where: {
        id: { in: requestIds },
        ...(isPusatOrAdmin ? {} : { daerahId: session.user.daerahId })
      }
    })

    if (ktaRequests.length !== requestIds.length) {
      return NextResponse.json({ error: 'Some KTA requests not found' }, { status: 404 })
    }

    // Calculate total
    const totalNominal = ktaRequests.reduce((sum, req) => sum + (req.hargaFinal || 0), 0)

    // Diskon >=100% => gratis, auto-marked as PAID (manual payment / tanpa bayar)
    const daerahInfo = await prisma.daerah.findUnique({
      where: { id: session.user.daerahId || '' },
      select: { diskonPersen: true }
    })
    const isFree = (daerahInfo?.diskonPersen || 0) >= 100

    // Generate invoice number: INV/KTA-GATENSI/[yymm]/[urut]
    const invoiceNumber = await generateInvoiceNumber()

    console.log('Creating bulk payment with data:', {
      invoiceNumber,
      totalJumlah: ktaRequests.length,
      totalNominal,
      status: isFree ? 'PAID' : 'PENDING',
      isFree,
      daerahId: session.user.daerahId,
      buktiPembayaranUrl: '',
      submittedBy: session.user.id,
    })

    // Create bulk payment record - same flow for ADMIN/KEUANGAN and DAERAH
    const bulkPayment = await prisma.bulkPayment.create({
      data: {
        invoiceNumber,
        totalJumlah: ktaRequests.length,
        totalNominal,
        status: isFree ? 'PAID' : 'PENDING',
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
          rekeningTujuan: 'BTN KC Jakarta Kuningan - 00001.01.30.000986.9 - a.n. Gabungan Ahli Teknik Nasional Indonesia',
          jumlah: req.hargaFinal || 0,
          statusPembayaran: isFree ? 'PAID' : 'PENDING',
          paidAt: isFree ? new Date() : null
        }
      })
    )

    await Promise.all(paymentPromises)

    // Update KTA requests status to WAITING_PAYMENT after invoice creation
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
