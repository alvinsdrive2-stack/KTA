import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { saveUpload, keyToUrl } from '@/lib/upload-storage'
import { KODE_DAERAH_PUSAT } from '@/lib/riwayat-invoice'

export const dynamic = 'force-dynamic'

/**
 * Pilih "Pengajuan Dinas" untuk satu invoice: gratis, nggak perlu bayar.
 *
 * Ini PILIHAN user di halaman invoice, bukan otomatis dari daerah. Invoice
 * daerah Pusat tetap ditagih kalau user pilih pembayaran online / transfer
 * manual. Keterangan wajib diisi — itu jejak kenapa invoice ini tak ditagih.
 *
 * Yang diubah cuma penanda `gratis` + status PAID. `totalNominal` dan
 * `diskonPersen` dibiarkan apa adanya: angka tagihan aslinya tetap utuh.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cuma BPP yang boleh memutuskan pengajuan dinas.
    if (session.user.role !== 'PUSAT') {
      return NextResponse.json(
        { error: 'Pengajuan dinas hanya bisa dipilih oleh akun BPP' },
        { status: 403 }
      )
    }

    // Dulu JSON; sekarang multipart karena bisa bawa bukti (opsional).
    // JSON tetap diterima biar pemanggil lama nggak langsung jebol.
    let bulkPaymentId: string | undefined
    let keterangan = ''
    let buktiFile: File | null = null

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      bulkPaymentId = (formData.get('bulkPaymentId') as string) || undefined
      keterangan = ((formData.get('keterangan') as string) || '').trim()
      const f = formData.get('buktiPembayaran')
      buktiFile = f instanceof File ? f : null
    } else {
      const body = await request.json().catch(() => ({}))
      bulkPaymentId = body.bulkPaymentId as string | undefined
      keterangan = ((body.keterangan as string) || '').trim()
    }

    if (!bulkPaymentId) {
      return NextResponse.json({ error: 'bulkPaymentId wajib diisi' }, { status: 400 })
    }

    if (!keterangan) {
      return NextResponse.json(
        { error: 'Keterangan pengajuan dinas wajib diisi' },
        { status: 400 }
      )
    }

    const invoice = await prisma.bulkPayment.findUnique({
      where: { id: bulkPaymentId },
      include: { daerah: { select: { kodeDaerah: true } } }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // BPP cuma urus invoice daerah Pusat, sama kayak scope di riwayat invoice.
    if (invoice.daerah?.kodeDaerah !== KODE_DAERAH_PUSAT) {
      return NextResponse.json(
        { error: 'Pengajuan dinas hanya untuk invoice daerah Pusat' },
        { status: 403 }
      )
    }

    if (invoice.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Invoice ini sudah tidak menunggu pembayaran' },
        { status: 400 }
      )
    }

    // Bukti (surat dinas / bukti transfer kedinasan) opsional. Disimpan di
    // kolom yang sama dengan bukti transfer manual biar halaman konfirmasi
    // cuma perlu baca satu tempat.
    let proofUrl: string | null = null
    if (buktiFile) {
      const MAX_BYTES = 5 * 1024 * 1024
      const tipeOk = /^image\/(jpeg|jpg|png)$/.test(buktiFile.type) || buktiFile.type === 'application/pdf'
      if (!tipeOk) {
        return NextResponse.json(
          { error: 'Bukti harus JPG, JPEG, PNG, atau PDF' },
          { status: 400 }
        )
      }
      if (buktiFile.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Ukuran bukti maksimal 5MB' }, { status: 400 })
      }
      proofUrl = keyToUrl(await saveUpload(buktiFile, 'payments', 'payment-proof'))
    }

    // Pengajuan dinas = lunas tanpa bayar. Status PAID (bukan VERIFIED) biar
    // tetap masuk antrean verifikasi Keuangan kayak pembayaran lain.
    await prisma.bulkPayment.update({
      where: { id: bulkPaymentId },
      data: {
        gratis: true,
        keterangan,
        status: 'PAID',
        verifiedAt: null,
        ...(proofUrl ? { buktiPembayaranUrl: proofUrl } : {}),
        // Pengajuan dinas = lunas tanpa bayar. Order id Midtrans yang sempat
        // dibuat (lalu dibatalkan) dilepas biar invoice ini nggak dianggap
        // transaksi Midtrans.
        midtransOrderId: null,
        midtransToken: null,
        midtransRedirectUrl: null,
      }
    })

    await prisma.payment.updateMany({
      where: { bulkPaymentId },
      data: {
        statusPembayaran: 'PAID',
        paidAt: new Date(),
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pengajuan dinas tercatat. Invoice tidak ditagih dan menunggu verifikasi Keuangan.'
    })
  } catch (error) {
    console.error('Pengajuan dinas error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
