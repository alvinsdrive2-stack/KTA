import crypto from 'crypto'
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
  'other_qris',
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
  'echannel',
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

/**
 * Bentuk minimal Snap dari midtrans-client yang dipakai di sini — paket itu
 * nggak nyertakan deklarasi tipe, jadi method-nya didaftar manual.
 */
interface SnapApi {
  createTransaction(transaction: MidtransTransaction): Promise<{ token: string; redirect_url: string }>
  transaction: {
    status(orderId: string): Promise<Record<string, unknown>>
    notification(payload: Record<string, unknown>): Promise<{ order_id?: string; transaction_status?: string }>
  }
}

// Initialize Midtrans Snap API
let snapApi: SnapApi | null = null

function getSnapApi(): SnapApi {
  if (!snapApi) {
    // Lazy require disengaja: midtrans-client cuma CJS dan cukup di-load saat
    // pertama kali dipakai, jangan ikut module init.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const midtransClient = require('midtrans-client')

    const isProduction = process.env.MIDTRANS_ENVIRONMENT === 'production'

    snapApi = new midtransClient.Snap({
      isProduction,
      serverKey: process.env.MIDTRANS_SERVER_KEY || '',
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    }) as SnapApi

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
export async function getTransactionStatus(orderId: string): Promise<Record<string, unknown>> {
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
 * Verifikasi `signature_key` notifikasi Midtrans.
 *
 * Midtrans mengirim `signature_key` = SHA512 dari
 * `order_id + status_code + gross_amount + ServerKey` (digabung apa adanya,
 * tanpa pemisah). Bandingkan hash dari data notifikasi dengan nilai yang
 * dikirim; kalau beda, notifikasi bukan dari Midtrans.
 *
 * CATATAN PENTING: `snap.transaction.notification()` dari midtrans-client
 * BUKAN verifikasi signature — method itu cuma ambil `transaction_id` lalu
 * query status transaksi ke API Midtrans. Memakainya sebagai penentu
 * keabsahan berarti siapa pun yang tahu `order_id` bisa POST notifikasi
 * palsu `settlement` dan KTA-nya langsung terbit tanpa bayar.
 */
export function verifyNotificationSignature(notification: Record<string, unknown>): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!serverKey) {
    console.error('MIDTRANS_SERVER_KEY nggak di-set — notifikasi ditolak')
    return false
  }

  const orderId = notification.order_id
  const statusCode = notification.status_code
  const grossAmount = notification.gross_amount
  const signatureKey = notification.signature_key

  // Semua komponen wajib ada. Tanpa ini hash-nya nggak bisa dihitung, dan
  // notifikasi yang nggak bawa signature harus ditolak, bukan diloloskan.
  if (
    typeof orderId !== 'string' ||
    (typeof statusCode !== 'string' && typeof statusCode !== 'number') ||
    (typeof grossAmount !== 'string' && typeof grossAmount !== 'number') ||
    typeof signatureKey !== 'string'
  ) {
    console.error('Notifikasi Midtrans nggak lengkap: field signature wajib ada', {
      hasOrderId: orderId != null,
      hasStatusCode: statusCode != null,
      hasGrossAmount: grossAmount != null,
      hasSignatureKey: signatureKey != null,
    })
    return false
  }

  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`
  const expected = crypto.createHash('sha512').update(raw).digest('hex')

  const expectedBuf = Buffer.from(expected, 'utf8')
  const actualBuf = Buffer.from(signatureKey, 'utf8')

  // Panjang beda bikin timingSafeEqual melempar, jadi dicek dulu.
  if (expectedBuf.length !== actualBuf.length) {
    console.error('Signature notifikasi Midtrans nggak cocok (panjang beda)')
    return false
  }

  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    console.error('Signature notifikasi Midtrans nggak cocok')
    return false
  }

  return true
}

/**
 * Verifikasi notifikasi Midtrans secara utuh — signature dulu, baru tanya
 * status transaksi ke Midtrans sebagai lapis kedua.
 *
 * Lapis kedua berguna buat memastikan transaksi memang ada di sisi Midtrans,
 * tapi yang menentukan keabsahan tetap signature. Urutannya sengaja: request
 * dengan signature palsu ditolak tanpa perlu memanggil API Midtrans.
 */
export async function verifyNotification(notification: Record<string, unknown>): Promise<boolean> {
  if (!verifyNotificationSignature(notification)) {
    return false
  }

  try {
    const snap = getSnapApi()

    // Cocokkan juga ke Midtrans: transaksi harus benar-benar ada di sana.
    const verifiedNotification = await snap.transaction.notification(notification)

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
