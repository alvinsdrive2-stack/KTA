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

    // Only PUSAT and ADMIN can push as enrol
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Anda tidak memiliki izin untuk melakukan aksi ini' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ids, keterangan } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs are required' }, { status: 400 })
    }

    if (!keterangan || !keterangan.trim()) {
      return NextResponse.json({ error: 'Keterangan wajib diisi' }, { status: 400 })
    }

    // Check if all KTA requests exist and have documents
    const ktaRequests = await prisma.kTARequest.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        daerah: true,
      },
    })

    if (ktaRequests.length !== ids.length) {
      return NextResponse.json(
        { error: 'Beberapa KTA tidak ditemukan' },
        { status: 404 }
      )
    }

    // Validate all documents are uploaded
    const incompleteRequests = ktaRequests.filter(req => !req.ktpUrl || !req.fotoUrl)
    if (incompleteRequests.length > 0) {
      return NextResponse.json(
        {
          error: 'Dokumen KTP dan Pas Foto harus diupload terlebih dahulu',
          incomplete: incompleteRequests.map(r => ({ id: r.id, nama: r.nama }))
        },
        { status: 400 }
      )
    }

    // Group by daerah to create bulk payments per daerah
    const groupedByDaerah = ktaRequests.reduce((acc, req) => {
      if (!acc[req.daerahId]) {
        acc[req.daerahId] = {
          daerahId: req.daerahId,
          daerah: req.daerah,
          requests: []
        }
      }
      acc[req.daerahId].requests.push(req)
      return acc
    }, {} as Record<string, { daerahId: string; daerah: any; requests: any[] }>)

    const bulkPaymentsCreated = []

    // Create bulk payment for each daerah
    for (const [daerahId, group] of Object.entries(groupedByDaerah)) {
      const totalAmount = group.requests.reduce((sum, req) => sum + (req.hargaFinal || 0), 0)

      if (totalAmount === 0) {
        return NextResponse.json({
          error: 'Harga untuk KTA belum ditetapkan. Silakan hubungi administrator.'
        }, { status: 400 })
      }

      // Generate invoice number
      const timestamp = Date.now()
      const invoiceNumber = `INV-ENROL-${daerahId}-${timestamp}`

      // Create bulk payment record (without buktiPembayaranUrl since this is enrol push)
      const bulkPayment = await prisma.bulkPayment.create({
        data: {
          invoiceNumber,
          daerahId,
          totalJumlah: group.requests.length,
          totalNominal: totalAmount,
          buktiPembayaranUrl: '', // Empty for enrol push
          status: 'PAID',
          submittedBy: session.user.id,
          isEnrolment: true,
          keterangan,
        }
      })

      bulkPaymentsCreated.push(bulkPayment)

      // Create individual payment records for each KTA request
      const paymentPromises = group.requests.map(request =>
        prisma.payment.create({
          data: {
            ktaRequestId: request.id,
            bulkPaymentId: bulkPayment.id,
            jumlah: request.hargaFinal || 0,
            statusPembayaran: 'PAID',
            invoiceNumber,
            rekeningTujuan: 'BTN KC Jakarta Kuningan - 00001.01.30.000986.9 - a.n. Gabungan Ahli Teknik Nasional Indonesia'
          }
        })
      )

      await Promise.all(paymentPromises)
    }

    // Update all KTA requests status
    await prisma.kTARequest.updateMany({
      where: {
        id: { in: ids }
      },
      data: {
        status: 'READY_FOR_PUSAT'
      }
    })

    return NextResponse.json({
      success: true,
      message: `${ids.length} KTA berhasil di-push sebagai enrol. Menunggu konfirmasi Keuangan.`,
      data: {
        totalKta: ids.length,
        bulkPayments: bulkPaymentsCreated.length,
        invoiceNumbers: bulkPaymentsCreated.map(bp => bp.invoiceNumber)
      }
    })
  } catch (error) {
    console.error('Push as enrol error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
