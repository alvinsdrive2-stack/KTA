import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { resolveInvoiceAmounts } from '@/lib/invoice'
import {
  generateSnapToken,
  getTransactionStatus,
  isDeadTransactionStatus,
  MidtransApiError,
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

    // Order_id ikut nomor invoice, bukan urutan sendiri.
    //
    // InvoiceNumber: INV/KTA-GATENSI/2610/093  ->  KTA_GATENSI_2610_093
    // Midtrans cuma nerima alphanumeric plus - _ ~ . jadi '/' dibuang dan
    // prefix "INV" dibongkar.
    //
    // Dulu sequence-nya dihitung sendiri dari jumlah row yang udah punya
    // midtransOrderId — hasilnya beda sama nomor invoice (invoice 093 dapet
    // order 107). Sekarang sumbernya cuma satu: invoiceNumber.
    const invoiceNumber = bulkPayment.invoiceNumber || ''
    const m = invoiceNumber.match(/^INV\/KTA-GATENSI\/(\d{4})\/(\d+)$/)
    if (!m) {
      return NextResponse.json(
        { error: `Nomor invoice tidak valid untuk Midtrans: ${invoiceNumber}` },
        { status: 400 }
      )
    }
    const orderBase = `KTA_GATENSI_${m[1]}_${m[2]}`
    const ts = Math.floor(Date.now() / 1000)

    let orderId = ''
    let snapResponse: SnapTokenResponse | null = null

    // One invoice = one order_id. Kalau sebelumnya sudah pernah dibuat
    // dengan format yang sama, pakai ulang biar nggak ada dua transaksi
    // untuk tagihan yang sama.
    //
    // Order_id versi lama (format sequence beda) tetap dibiarkan apa adanya
    // karena transaksinya mungkin masih hidup di Midtrans — webhook masih
    // perlu nemu baris ini lewat order_id itu.
    const existingOrder = bulkPayment.midtransOrderId
    let claimedThisRequest = false
    if (existingOrder && existingOrder.startsWith(`${orderBase}-`)) {
      orderId = existingOrder
    } else if (existingOrder) {
      console.warn(
        `midtransOrderId ${bulkPayment.id} (${existingOrder}) tidak sesuai invoice ${invoiceNumber}, tetap dipakai`
      )
      orderId = existingOrder
    } else {
      // Klaim order_id di DB DULU, baru panggil Midtrans.
      //
      // Urutan sebaliknya (panggil Midtrans dulu, simpan belakangan) bikin
      // transaksi ada di Midtrans tapi nggak tercatat di sini kalau prosesnya
      // mati di antaranya. Webhook-nya lalu 404 terus karena nggak nemu
      // order_id-nya — duit masuk, KTA nggak pernah terbit.
      //
      // Bentrok (P2002) berarti ada invoice lain dengan nomor yang sama —
      // itu data yang salah, bukan hal yang bisa di-retry pakai nomor lain.
      const kandidat = `${orderBase}-${ts}`
      try {
        await prisma.bulkPayment.update({
          where: { id: params.id },
          data: { midtransOrderId: kandidat }
        })
      } catch (err) {
        if ((err as { code?: string })?.code === 'P2002') {
          return NextResponse.json(
            { error: `Order ID ${kandidat} sudah dipakai invoice lain` },
            { status: 409 }
          )
        }
        throw err
      }
      orderId = kandidat
      claimedThisRequest = true
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
      // Order_id lama ditolak karena transaksinya sudah pernah dibuat di
      // Midtrans. Ini yang bikin invoice mentok 400 selamanya: order_id
      // disimpan di DB lalu dipakai ulang, padahal Snap cuma nerima satu
      // transaksi per order_id.
      //
      // Kalau transaksi lamanya sudah mati (expire/deny/cancel/failure),
      // order_id itu bebas — klaim nomor baru dan coba sekali lagi.
      // Kalau masih hidup (pending/settlement), JANGAN bikin nomor baru:
      // itu bikin dua tagihan aktif untuk satu invoice.
      if (err instanceof MidtransApiError && err.isOrderIdTaken) {
        let status: unknown = null
        try {
          const s = await getTransactionStatus(orderId)
          status = s.transaction_status
        } catch (statusErr) {
          // Gagal nanya status bukan alasan bikin nomor baru — lebih baik
          // user lihat pesan jelas daripada dapat tagihan dobel.
          console.error('Gagal cek status transaksi lama:', statusErr instanceof Error ? statusErr.message : statusErr)
        }

        if (isDeadTransactionStatus(status)) {
          const newOrderId = `${orderBase}-${Math.floor(Date.now() / 1000)}`
          await prisma.bulkPayment.update({
            where: { id: params.id },
            data: { midtransOrderId: newOrderId }
          })
          console.log('Order lama sudah mati, klaim order baru:', newOrderId)

          const retry: MidtransTransaction = {
            transaction_details: { order_id: newOrderId, gross_amount: totalTagihan },
            item_details: itemDetails,
            customer_details: customerDetails,
            enabled_payments: resolveEnabledPayments(totalTagihan)
          }
          snapResponse = await generateSnapToken(retry)
          orderId = newOrderId
          claimedThisRequest = true
        } else {
          return NextResponse.json(
            {
              error:
                'Invoice ini sudah punya transaksi Midtrans yang masih aktif. ' +
                'Buka link pembayaran yang lama, atau tunggu sampai transaksi itu kedaluwarsa.'
            },
            { status: 409 }
          )
        }
      } else {
        // Midtrans nolak / nggak kebales — lepas klaimnya biar nggak ada
        // order_id yang nyangkut tanpa transaksi. Cuma kalau order_id itu
        // memang baru diklaim request ini; kalau dipakai ulang, jangan
        // dihapus.
        if (claimedThisRequest) {
          await prisma.bulkPayment.update({
            where: { id: params.id },
            data: { midtransOrderId: null }
          }).catch(() => {})
        }
        throw err
      }
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
      // err di sini sudah MidtransApiError — udah dibersihkan, tanpa header
      // Authorization. Jangan log objek aslinya.
      console.error('Gagal simpan token Midtrans (order_id tetap keklaim):', orderId, err instanceof Error ? err.message : err)
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
    console.error('Generate Midtrans token error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
