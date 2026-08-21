import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import {
  generateSnapToken,
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

    // Generate order_id: KTA_GATENSI_yymm_000 (sequential per month)
    // Midtrans only allows alphanumeric plus - _ ~ . in order_id
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const orderPrefix = `KTA_GATENSI_${yy}${mm}_`

    let orderId = ''
    let persisted = false
    let snapResponse: SnapTokenResponse

    for (let attempt = 0; attempt < 5; attempt++) {
      const lastOrder = await prisma.bulkPayment.findMany({
        where: { midtransOrderId: { startsWith: orderPrefix } },
        orderBy: { midtransOrderId: 'desc' },
        take: 1,
        select: { midtransOrderId: true }
      })

      let seq = 1
      if (lastOrder.length > 0 && lastOrder[0].midtransOrderId) {
        const lastSeq = parseInt(lastOrder[0].midtransOrderId.split('_').pop() || '0', 10)
        seq = lastSeq + 1
      }

      orderId = `${orderPrefix}${String(seq).padStart(3, '0')}`

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

      snapResponse = await generateSnapToken(transaction)

      // Persist midtransOrderId so the sequence is not reused
      try {
        await prisma.bulkPayment.update({
          where: { id: params.id },
          data: {
            midtransToken: snapResponse.token,
            midtransRedirectUrl: snapResponse.redirect_url,
            midtransOrderId: orderId
          }
        })
        persisted = true
        break
      } catch (err: any) {
        // Unique constraint violation -> retry with next sequence
        if (err?.code === 'P2002') continue
        throw err
      }
    }

    if (!persisted || !orderId) {
      throw new Error('Failed to allocate unique Midtrans order_id')
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
