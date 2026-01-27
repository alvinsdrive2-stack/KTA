import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyNotification, mapPaymentStatus } from '@/lib/midtrans'

export const dynamic = 'force-dynamic'

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

    // Extract invoice number from order_id
    // order_id format: KTA-INV/LSP-GKK/2026/01-0001-1737345678900
    // Remove timestamp suffix (13 digit milliseconds)
    const invoiceNumber = order_id.replace(/-\d{13}$/, '')
    console.log(`Extracted invoice number: "${invoiceNumber}" from order_id: "${order_id}"`)

    // Find the bulk payment by invoice number
    console.log(`Looking up bulk payment with invoiceNumber: "${invoiceNumber}"`)
    const bulkPayment = await prisma.bulkPayment.findUnique({
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

    if (!bulkPayment) {
      console.error(`❌ Bulk payment not found for order: ${order_id} (invoice: ${invoiceNumber})`)
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

    console.log(`Updating payment ${invoiceNumber} to status: ${newStatus}`)

    // Update bulk payment status
    await prisma.bulkPayment.update({
      where: { invoiceNumber },
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

    // If payment is verified, update KTA request status to READY_TO_PRINT
    if (newStatus === 'VERIFIED') {
      const ktaRequestIds = bulkPayment.payments.map(p => p.ktaRequestId)

      await prisma.kTARequest.updateMany({
        where: {
          id: { in: ktaRequestIds }
        },
        data: {
          status: 'READY_TO_PRINT'
        }
      })

      console.log(`Updated ${ktaRequestIds.length} KTA requests to READY_TO_PRINT (Midtrans auto-verified)`)
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
