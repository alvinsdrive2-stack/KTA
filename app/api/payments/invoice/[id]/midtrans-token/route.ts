import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import {
  generateSnapToken,
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

    // Calculate total from hargaFinal (already includes upgrade pricing and discount)
    const totalTagihan = bulkPayment.payments.reduce(
      (sum, p) => sum + (p.ktaRequest.hargaFinal || 0),
      0
    )

    // Build item details using hargaFinal (already has correct pricing for upgrades)
    const itemDetails: MidtransItemDetails[] = bulkPayment.payments.map((payment, index) => ({
      id: payment.ktaRequest.idIzin || `kta-${index + 1}`,
      price: Math.floor(payment.ktaRequest.hargaFinal || 0),
      quantity: 1,
      name: `KTA - ${payment.ktaRequest.nama}`.substring(0, 50)
    }))

    // Build customer details
    const customerDetails: MidtransCustomerDetails = {
      first_name: bulkPayment.submittedByUser.name.split(' ')[0] || 'User',
      last_name: bulkPayment.submittedByUser.name.split(' ').slice(1).join(' '),
      email: bulkPayment.submittedByUser.email
    }

    // Always generate unique order_id with timestamp to avoid conflicts
    // Midtrans only allows alphanumeric plus - _ ~ . in order_id, so strip others (e.g. slash in invoice number)
    const timestamp = Date.now()
    const sanitizedInvoiceNumber = bulkPayment.invoiceNumber.replace(
      /[^a-zA-Z0-9._~-]/g,
      '-'
    )
    const orderId = `${sanitizedInvoiceNumber}-${timestamp}`

    // Build transaction
    const transaction: MidtransTransaction = {
      transaction_details: {
        order_id: orderId,
        gross_amount: totalTagihan
      },
      item_details: itemDetails,
      customer_details: customerDetails
    }

    console.log('Creating new Midtrans transaction:', orderId)

    // Generate Snap token
    const snapResponse = await generateSnapToken(transaction)

    // Update bulk payment with Midtrans token
    await prisma.bulkPayment.update({
      where: { id: params.id },
      data: {
        midtransToken: snapResponse.token,
        midtransRedirectUrl: snapResponse.redirect_url
      }
    })

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
