// Type definitions for Midtrans
export interface MidtransTransactionDetails {
  order_id: string
  gross_amount: number
}

export interface MidtransItemDetails {
  id: string
  price: number
  quantity: number
  name: string
}

export interface MidtransCustomerDetails {
  first_name: string
  last_name?: string
  email: string
  phone?: string
}

export interface MidtransTransaction {
  transaction_details: MidtransTransactionDetails
  item_details?: MidtransItemDetails[]
  customer_details: MidtransCustomerDetails
  credit_card?: {
    secure?: boolean
  }
}

export interface SnapTokenResponse {
  token: string
  redirect_url: string
}

// Initialize Midtrans Snap API
let snapApi: any = null

function getSnapApi(): any {
  if (!snapApi) {
    const midtransClient = require('midtrans-client')

    const isProduction = process.env.MIDTRANS_ENVIRONMENT === 'production'

    snapApi = new midtransClient.Snap({
      isProduction,
      serverKey: process.env.MIDTRANS_SERVER_KEY || '',
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    })

    console.log('Midtrans Snap API initialized:', {
      isProduction,
      hasServerKey: !!process.env.MIDTRANS_SERVER_KEY,
      hasClientKey: !!process.env.MIDTRANS_CLIENT_KEY,
    })
  }

  return snapApi
}

/**
 * Generate Snap Token for payment
 */
export async function generateSnapToken(
  transaction: MidtransTransaction
): Promise<SnapTokenResponse> {
  try {
    const snap = getSnapApi()

    console.log('Generating Snap token for order:', transaction.transaction_details.order_id)

    const response = await snap.createTransaction(transaction)

    console.log('Snap token generated successfully:', {
      orderId: transaction.transaction_details.order_id,
      hasToken: !!response.token,
      hasRedirectUrl: !!response.redirect_url,
    })

    return {
      token: response.token,
      redirect_url: response.redirect_url,
    }
  } catch (error) {
    console.error('Error generating Snap token:', error)
    throw new Error('Failed to generate payment token')
  }
}

/**
 * Get transaction status from Midtrans
 */
export async function getTransactionStatus(orderId: string): Promise<any> {
  try {
    const snap = getSnapApi()
    const status = await snap.transaction.status(orderId)
    return status
  } catch (error) {
    console.error('Error getting transaction status:', error)
    throw new Error('Failed to get transaction status')
  }
}

/**
 * Verify Midtrans notification signature
 */
export async function verifyNotification(notification: any): Promise<boolean> {
  try {
    const snap = getSnapApi()

    // Midtrans library handles signature verification
    // If the notification signature is invalid, this will throw an error
    const verifiedNotification = snap.transaction.notification(notification)

    console.log('Notification verified successfully:', {
      orderId: verifiedNotification.order_id,
      transactionStatus: verifiedNotification.transaction_status,
    })

    return true
  } catch (error) {
    console.error('Notification verification failed:', error)
    return false
  }
}

/**
 * Map Midtrans payment status to our internal status
 */
export function mapPaymentStatus(midtransStatus: string): string {
  switch (midtransStatus) {
    case 'capture':
    case 'settlement':
      return 'PAID'
    case 'pending':
      return 'PENDING'
    case 'deny':
    case 'cancel':
    case 'expire':
    case 'failure':
      return 'FAILED'
    case 'refund':
      return 'REFUNDED'
    case 'partial_refund':
      return 'PARTIALLY_REFUNDED'
    default:
      return 'PENDING'
  }
}
