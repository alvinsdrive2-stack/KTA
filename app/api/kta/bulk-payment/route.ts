import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { generateInvoiceNumber, computeHargaBaseSnapshot } from '@/lib/invoice'
import { saveUpload, keyToUrl } from '@/lib/upload-storage'

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
    const userDaerahId = session.user.daerahId
    if (!userDaerahId) {
      return NextResponse.json(
        { error: 'User tidak memiliki daerah yang ditugaskan' },
        { status: 400 }
      )
    }

    const ktaRequests = await prisma.kTARequest.findMany({
      where: {
        id: { in: requestIds },
        daerahId: userDaerahId
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

    // Yang nggak boleh ditagih ulang cuma KTA yang payment-nya masih jalan
    // (PENDING/PAID/VERIFIED). Payment berstatus REJECTED dianggap batal —
    // tanpa ini, KTA yang invoice-nya pernah ditolak nggak akan pernah bisa
    // diajukan pembayaran lagi karena jejak payment-nya nyangkut selamanya.
    const invalidRequests = ktaRequests.filter(req =>
      req.payments?.some(p => p.statusPembayaran !== 'REJECTED')
    )

    if (invalidRequests.length > 0) {
      return NextResponse.json({
        error: 'Sebagian KTA sudah punya pembayaran yang masih berjalan'
      }, { status: 400 })
    }

    // Simpan bukti pembayaran lewat helper storage (di luar public/).
    const proofUrl = keyToUrl(await saveUpload(paymentProof, 'payments', 'payment-proof'))

    // Calculate total amount from each request's hargaFinal
    const totalAmount = ktaRequests.reduce((sum, req) => sum + (req.hargaFinal || 0), 0)

    // Snapshot harga saat invoice dibuat — invoice jadi catatan tetap, nggak
    // ikut berubah kalau diskon daerah berubah belakangan.
    const diskonPersen = ktaRequests[0].daerah?.diskonPersen ?? 0
    const { totalHargaBase, baseById } = await computeHargaBaseSnapshot(ktaRequests)

    if (totalAmount === 0) {
      return NextResponse.json({
        error: 'Harga untuk KTA belum ditetapkan. Silakan hubungi administrator.'
      }, { status: 400 })
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber()

    // Create bulk payment record
    const bulkPayment = await prisma.bulkPayment.create({
      data: {
        invoiceNumber,
        daerahId: session.user.daerahId!,
        totalJumlah: ktaRequests.length,
        totalNominal: totalAmount,
        totalHargaBase,
        diskonPersen,
        buktiPembayaranUrl: proofUrl,
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
          hargaBaseSnapshot: baseById[request.id] ?? 0,
          statusPembayaran: 'PENDING',
          invoiceNumber,
          rekeningTujuan: 'BTN KC Jakarta Kuningan - 00001.01.30.000986.9 - a.n. Gabungan Ahli Teknik Nasional Indonesia'
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