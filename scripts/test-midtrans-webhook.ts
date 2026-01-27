/**
 * Test script untuk Midtrans notification webhook
 * Jalankan dengan: npx tsx scripts/test-midtrans-webhook.ts
 */

import { prisma } from '../lib/prisma'

async function getBulkPayment() {
  // Cari bulk payment pending untuk test
  const bulkPayment = await prisma.bulkPayment.findFirst({
    where: { status: 'PENDING' },
    include: {
      payments: {
        include: {
          ktaRequest: {
            select: {
              id: true,
              nama: true,
              jenjang: true,
              daerahId: true
            }
          }
        }
      }
    }
  })

  if (!bulkPayment) {
    console.log('⚠️  Tidak ada bulk payment PENDING di database')
    console.log('Membuat dummy notification payload...\n')
    return null
  }

  console.log(`✅ Bulk payment ditemukan: ${bulkPayment.invoiceNumber}`)
  console.log(`   Total: ${bulkPayment.totalJumlah} KTA`)
  console.log(`   Nominal: Rp${bulkPayment.totalNominal.toLocaleString('id-ID')}\n`)

  return bulkPayment
}

async function sendTestNotification(bulkPayment: any) {
  const invoiceNumber = bulkPayment?.invoiceNumber || 'KTA-INV/LSP-GKK/2026/01-0001'

  // Simulate Midtrans notification payload
  const notification = {
    order_id: `${invoiceNumber}-${Date.now()}`,
    transaction_status: 'settlement',
    payment_type: 'qris',
    transaction_id: `test-tx-${Date.now()}`,
    fraud_status: 'accept',
    gross_amount: bulkPayment?.totalNominal || 500000,
    status_code: '200',
    signature_key: 'test-signature' // Ini akan fail verification, tapi bisa buat test logic
  }

  console.log('📤 Sending test notification to local webhook...')
  console.log('URL: http://localhost:3000/api/payments/midtrans-notification')
  console.log('\nPayload:')
  console.log(JSON.stringify(notification, null, 2))
  console.log('')

  try {
    const response = await fetch('http://localhost:3000/api/payments/midtrans-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification)
    })

    const result = await response.json()

    console.log('📥 Response:')
    console.log(`   Status: ${response.status}`)
    console.log(JSON.stringify(result, null, 2))

    if (response.ok) {
      console.log('\n✅ Test berhasil!')
    } else {
      console.log('\n❌ Test gagal')
      console.log('   Note: Signature verification expected to fail in test mode')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

async function main() {
  console.log('========================================')
  console.log('Midtrans Webhook Test')
  console.log('========================================\n')

  const bulkPayment = await getBulkPayment()

  // Pastikan server Next.js running di port 3000
  console.log('⚠️  Pastikan Next.js dev server running di http://localhost:3000')
  console.log('    Jalankan: npm run dev\n')

  await sendTestNotification(bulkPayment)

  await prisma.$disconnect()
}

main().catch(console.error)
