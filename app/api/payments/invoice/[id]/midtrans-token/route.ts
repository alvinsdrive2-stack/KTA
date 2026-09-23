import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { resolveInvoiceAmounts } from '@/lib/invoice'
import {
  generateSnapToken,
  resolveEnabledPayments,
  type SnapTokenResponse,
  type MidtransItemDetails,
  type MidtransCustomerDetails,
  type MidtransTransaction
} from '@/lib/midtrans'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch bulk payment with related data
    const bulkPayment = await prisma.bulkPayment.findUnique({
      where: { id: params.id },
      include: {
        daerah: true,
        submittedByUser: {
          select: {
            name: true,
            email: true
          }
        },
        payments: {
          include: {
            ktaRequest: {
              select: {
                id: true,
                idIzin: true,
                nama: true,
                hargaBase: true,
                hargaFinal: true
              }
            }
          }
        }
      }
    })

    if (!bulkPayment) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if user owns this invoice
    if (bulkPayment.daerahId !== session.user.daerahId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Don't allow payment for already paid invoices
    if (bulkPayment.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 })
    }

    // Yang ditagih = snapshot invoice (Payment.jumlah / BulkPayment.totalNominal),
    // BUKAN hargaFinal yang dibaca ulang saat bayar. Kalau harga atau diskon
    // berubah setelah invoice terbit, yang ditagih tetap angka di invoice itu.
    const { totalTagihan } = resolveInvoiceAmounts(
      bulkPayment,
      bulkPayment.payments.map((p) => ({
        // totalTagihan diambil dari totalNominal/jumlah, jadi harga dasar baris
        // nggak kepakai di sini — cukup diisi snapshot-nya biar nggak menebak.
        effectiveHarga: p.hargaBaseSnapshot ?? 0,
        jumlah: p.jumlah
      }))
    )

    // Item details ikut snapshot juga, biar jumlahnya pas sama gross_amount.
    const itemDetails: MidtransItemDetails[] = bulkPayment.payments.map((payment, index) => ({
      id: payment.ktaRequest.idIzin || `kta-${index + 1}`,
      price: Math.floor(payment.jumlah || 0),
      quantity: 1,
      name: `KTA - ${payment.ktaRequest.nama}`.substring(0, 50)
    }))

    // Build customer details
    const customerDetails: MidtransCustomerDetails = {
      first_name: bulkPayment.submittedByUser.name.split(' ')[0] || 'User',
      last_name: bulkPayment.submittedByUser.name.split(' ').slice(1).join(' '),
      email: bulkPayment.submittedByUser.email
    }

    // Generate order_id: KTA_GATENSI_yymm_000-timestamp (sequential per month)
    // Midtrans only allows alphanumeric plus - _ ~ . in order_id
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const orderPrefix = `KTA_GATENSI_${yy}${mm}_`
    const ts = Math.floor(Date.now() / 1000)

    // Ambil semua order_id bulan ini, hitung sequence tertinggi dari ANGKA-nya.
    //
    // Dulu ini `orderBy: midtransOrderId desc, take: 1` — sort string, jadi
    // urutannya salah begitu lewat 9: "KTA_..._010" dianggap lebih kecil dari
    // "KTA_..._009" karena '1' < '9'. Akibatnya sequence bisa balik ke angka
    // yang udah kepakai.
    const orderBulanIni = await prisma.bulkPayment.findMany({
      where: { midtransOrderId: { startsWith: orderPrefix } },
      select: { midtransOrderId: true }
    })
    let seqTertinggi = 0
    for (const o of orderBulanIni) {
      const n = parseInt((o.midtransOrderId || '').split('-')[0].split('_').pop() || '0', 10)
      if (Number.isFinite(n) && n > seqTertinggi) seqTertinggi = n
    }

    let orderId = ''
    let snapResponse: SnapTokenResponse | null = null

    // Klaim order_id di DB DULU, baru panggil Midtrans.
    //
    // Urutan sebaliknya (panggil Midtrans dulu, simpan belakangan) bikin
    // transaksi ada di Midtrans tapi nggak tercatat di sini kalau prosesnya
    // mati di antaranya. Webhook-nya lalu 404 terus karena nggak nemu
    // order_id-nya — duit masuk, KTA nggak pernah terbit.
    //
    // Yang diklaim cuma kolom midtransOrderId; token diisi setelah Midtrans
    // balas. Kalau panggilan ke Midtrans gagal, klaimnya dilepas lagi biar
    // nggak ada order_id nyangkut tanpa transaksi.
    for (let attempt = 0; attempt < 5; attempt++) {
      const kandidat = `${orderPrefix}${String(seqTertinggi + 1 + attempt).padStart(3, '0')}-${ts}`

      try {
        await prisma.bulkPayment.update({
          where: { id: params.id },
          data: { midtransOrderId: kandidat }
        })
      } catch (err: any) {
        // P2002 = order_id ini udah dipakai baris lain, coba nomor berikutnya
        if (err?.code === 'P2002') continue
        throw err
      }

      orderId = kandidat
      break
    }

    if (!orderId) {
      throw new Error('Failed to allocate unique Midtrans order_id')
    }

    try {
      const transaction: MidtransTransaction = {
        transaction_details: {
          order_id: orderId,
          gross_amount: totalTagihan
        },
        item_details: itemDetails,
        customer_details: customerDetails,
        // >= Rp 500.000 cuma VA bank; di bawahnya boleh QRIS/e-wallet juga.
        // Dikunci di server biar nggak bisa dilewatin dari sisi client.
        enabled_payments: resolveEnabledPayments(totalTagihan)
      }

      console.log('Creating new Midtrans transaction:', orderId)
      snapResponse = await generateSnapToken(transaction)
    } catch (err) {
      // Midtrans nolak / nggak kebales — lepas klaimnya biar nggak ada
      // order_id yang nyangkut tanpa transaksi.
      await prisma.bulkPayment.update({
        where: { id: params.id },
        data: { midtransOrderId: null }
      }).catch(() => {})
      throw err
    }

    // Token disimpan setelah transaksi jadi. Kalau langkah ini gagal, order_id
    // tetap keklaim dan webhook masih bisa nemu barisnya — jadi lebih aman
    // daripada kegagalan di sisi Midtrans.
    try {
      await prisma.bulkPayment.update({
        where: { id: params.id },
        data: {
          midtransToken: snapResponse.token,
          midtransRedirectUrl: snapResponse.redirect_url
        }
      })
    } catch (err) {
      console.error('Gagal simpan token Midtrans (order_id tetap keklaim):', orderId, err)
    }

    return NextResponse.json({
      success: true,
      token: snapResponse.token,
      redirect_url: snapResponse.redirect_url,
      invoice_number: bulkPayment.invoiceNumber,
      order_id: orderId,
      amount: totalTagihan
    })

  } catch (error) {
    console.error('Generate Midtrans token error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
