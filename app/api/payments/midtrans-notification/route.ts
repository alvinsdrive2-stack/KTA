import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyNotification, mapPaymentStatus } from '@/lib/midtrans'
import { QRCodeGenerator } from '@/lib/qr-generator'
import { generateNomorKTA } from '@/lib/kta-numbering'

export const dynamic = 'force-dynamic'

// Helper function to prepare KTA for print
async function prepareKTAForPrint(ktaId: string) {
  console.log(`📄 Preparing KTA for print: ${ktaId}`)

  try {
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: ktaId },
      select: {
        id: true,
        nomorKTA: true,
        daerahId: true,
        jenjang: true,
        nama: true,
        nik: true,
        status: true,
        qrCodePath: true
      }
    })

    if (!ktaRequest) {
      throw new Error('KTA not found')
    }

    if (ktaRequest.nomorKTA && ktaRequest.status === 'READY_TO_PRINT') {
      console.log(`⏭️  KTA ${ktaId} already ready: ${ktaRequest.nomorKTA}`)
      return
    }

    let nomorKTA = ktaRequest.nomorKTA
    if (!nomorKTA) {
      console.log(`🔢 Generating nomorKTA for daerahId=${ktaRequest.daerahId}, jenjang=${ktaRequest.jenjang}`)
      nomorKTA = await generateNomorKTA(ktaRequest.daerahId, ktaRequest.jenjang)
      console.log(`✅ Generated nomorKTA for ${ktaRequest.nama}: ${nomorKTA}`)
    }

    let qrCodePath = ktaRequest.qrCodePath
    if (!qrCodePath) {
      qrCodePath = await QRCodeGenerator.generateKTAQR({
        nik: ktaRequest.nik,
      })
    }

    await prisma.kTARequest.update({
      where: { id: ktaId },
      data: {
        nomorKTA,
        qrCodePath,
        status: 'READY_TO_PRINT'
      }
    })

    console.log(`💾 Updated KTA ${ktaId} - ready to print`)
  } catch (error) {
    console.error(`❌ Error preparing KTA ${ktaId}:`, error)
    throw error
  }
}

/**
 * Midtrans Payment Notification Handler (Webhook)
 * This endpoint receives payment status updates from Midtrans
 */
export async function POST(request: NextRequest) {
  try {
    // Get notification data from request body
    const notification = await request.json()

    console.log('========================================')
    console.log('MIDTRANS NOTIFICATION RECEIVED')
    console.log('========================================')
    console.log('Raw notification:', JSON.stringify(notification, null, 2))

    // Verify notification signature
    console.log('Verifying notification signature...')
    const isValid = await verifyNotification(notification)
    if (!isValid) {
      console.error('❌ Invalid notification signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      )
    }
    console.log('✓ Notification signature valid')

    // Extract data from notification
    const { order_id, transaction_status, payment_type, transaction_id, fraud_status } = notification

    // Find the bulk payment by midtransOrderId (new format: KTA_GATENSI_yymm_000)
    console.log(`Looking up bulk payment with midtransOrderId: "${order_id}"`)
    let bulkPayment = await prisma.bulkPayment.findUnique({
      where: { midtransOrderId: order_id },
      include: {
        payments: true,
        submittedByUser: {
          select: {
            role: true
          }
        }
      }
    })

    // Backward compat: legacy order_id format was {invoiceNumber}-{timestamp}
    if (!bulkPayment) {
      // Timestamp di order_id lama itu detik (10 digit), bukan 13 digit
      // milidetik. Dua-duanya dicoba biar order lama tetap ketemu.
      const invoiceNumber = order_id.replace(/-\d{10,13}$/, '')
      console.log(`Not found by order_id, trying legacy invoiceNumber: "${invoiceNumber}"`)
      bulkPayment = await prisma.bulkPayment.findUnique({
        where: { invoiceNumber },
        include: {
          payments: true,
          submittedByUser: {
            select: {
              role: true
            }
          }
        }
      })
    }

    // Jaring terakhir: cocokkan lewat transaction_id Midtrans.
    //
    // Ini buat baris yang order_id-nya ketuker (pernah kejadian: invoice 001
    // nyimpen order_id milik transaksi lain, jadi webhook nggak nemu apa-apa
    // padahal transaksinya ada). transaction_id nggak pernah kita generate
    // sendiri — dia dikasih Midtrans dan unik per transaksi.
    if (!bulkPayment && transaction_id) {
      console.log(`Not found by order_id/invoiceNumber, trying midtransTransactionId: "${transaction_id}"`)
      bulkPayment = await prisma.bulkPayment.findFirst({
        where: { midtransTransactionId: transaction_id },
        include: {
          payments: true,
          submittedByUser: {
            select: {
              role: true
            }
          }
        }
      })
    }

    if (!bulkPayment) {
      console.error(`❌ Bulk payment not found for order: ${order_id}`)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    console.log(`✓ Found bulk payment: ${bulkPayment.id}, current status: ${bulkPayment.status}`)
    console.log(`✓ Submitted by user role: ${bulkPayment.submittedByUser.role}`)

    // Map Midtrans status to internal status
    let newStatus = mapPaymentStatus(transaction_status)
    console.log(`Mapped transaction_status "${transaction_status}" to "${newStatus}"`)

    // Handle fraud status for capture transactions
    if (transaction_status === 'capture' && fraud_status === 'challenge') {
      newStatus = 'PENDING'
    } else if (transaction_status === 'capture' && fraud_status === 'accept') {
      // Midtrans payments are automatically VERIFIED
      newStatus = 'VERIFIED'
      console.log(`Payment status set to: ${newStatus} (Midtrans auto-verified)`)
    } else if (newStatus === 'PAID') {
      // For settlement status, Midtrans payments are automatically VERIFIED
      newStatus = 'VERIFIED'
      console.log(`Payment status set to: ${newStatus} (Midtrans auto-verified)`)
    }

    console.log(`Updating payment ${order_id} to status: ${newStatus}`)

    // Update bulk payment status
    await prisma.bulkPayment.update({
      where: { id: bulkPayment.id },
      data: {
        status: newStatus,
        midtransTransactionId: transaction_id,
        midtransPaymentType: payment_type,
        verifiedAt: newStatus === 'VERIFIED' ? new Date() : null,
        verifiedBy: newStatus === 'VERIFIED' ? bulkPayment.submittedBy : null // Auto-verify for Midtrans payments
      }
    })

    // Update all related payment records
    await prisma.payment.updateMany({
      where: { bulkPaymentId: bulkPayment.id },
      data: {
        statusPembayaran: newStatus,
        paidAt: newStatus === 'VERIFIED' ? new Date() : null
      }
    })

    // If payment is verified, generate nomorKTA and update KTA request status to READY_TO_PRINT
    if (newStatus === 'VERIFIED') {
      const ktaRequestIds = bulkPayment.payments.map(p => p.ktaRequestId)

      console.log(`🎨 Preparing ${ktaRequestIds.length} KTA(s) for print (Midtrans verified)...`)
      let succeeded = 0
      let failed = 0

      for (const ktaId of ktaRequestIds) {
        try {
          // Update tanggalDaftar to today when payment is verified via Midtrans
          await prisma.kTARequest.update({
            where: { id: ktaId },
            data: { tanggalDaftar: new Date() }
          })
          await prepareKTAForPrint(ktaId)
          succeeded++
        } catch (error) {
          console.error(`❌ Failed to prepare KTA ${ktaId}:`, error)
          failed++
        }
      }

      console.log(`✅ Prepared ${succeeded} KTA(s) for print${failed > 0 ? ` (${failed} failed)` : ''} (Midtrans verified)`)
    }

    return NextResponse.json({
      success: true,
      message: 'Notification processed successfully'
    })

  } catch (error) {
    console.error('Midtrans notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
