import type { PaymentStatus } from '@prisma/client'

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
  /** Batasi metode bayar yang muncul di Snap. Lihat `resolveEnabledPayments`. */
  enabled_payments?: string[]
}

/**
 * Ambang batas nominal buat boleh pakai QRIS / e-wallet.
 *
 * Di atas (dan pas) angka ini, cuma Virtual Account bank yang diizinkan —
 * limit QRIS per transaksi bikin pembayaran gede rawan gagal di tengah jalan.
 */
export const QRIS_MAX_AMOUNT = 500_000

/** Metode yang cuma boleh dipakai di bawah ambang batas. */
const NON_VA_PAYMENTS = [
  'qris',
  'gopay',
  'shopeepay',
  'akulaku',
  'kredivo',
  'bca_klikpay',
  'bri_epay',
  'cimb_clicks',
  'danamon_online',
]

/** Semua channel Virtual Account bank yang didukung Midtrans Snap. */
const VA_PAYMENTS = [
  'bca_va',
  'bni_va',
  'bri_va',
  'cimb_va',
  'permata_va',
  'other_va',
]

/**
 * Tentukan metode bayar yang ditampilkan Snap berdasarkan nominal tagihan.
 *
 * Dipakai di server saat bikin token, jadi batasannya nggak bisa dilewatin
 * dari sisi client.
 *
 * @param amount total tagihan dalam rupiah (bukan sen)
 */
export function resolveEnabledPayments(amount: number): string[] {
  // Nominal nggak valid / nol → serahkan ke default Midtrans, jangan dikunci
  // ke satu metode gara-gara data yang salah.
  if (!Number.isFinite(amount) || amount <= 0) return []

  if (amount >= QRIS_MAX_AMOUNT) return [...VA_PAYMENTS]

  return [...VA_PAYMENTS, ...NON_VA_PAYMENTS]
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
export function mapPaymentStatus(midtransStatus: string): PaymentStatus {
  switch (midtransStatus) {
    case 'capture':
    case 'settlement':
      return 'PAID'
    case 'pending':
      return 'PENDING'
    // Enum PaymentStatus cuma punya PENDING/PAID/VERIFIED/REJECTED.
    // Status gagal/refund di bawah ini dipetakan ke REJECTED.
    case 'deny':
    case 'cancel':
    case 'expire':
    case 'failure':
    case 'refund':
    case 'partial_refund':
      return 'REJECTED'
    default:
      return 'PENDING'
  }
}
