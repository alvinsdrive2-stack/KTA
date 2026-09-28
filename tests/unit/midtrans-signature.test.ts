/**
 * Test unit verifikasi signature notifikasi Midtrans.
 *
 * Yang dijaga di sini bukan "fungsi jalan", tapi bahwa notifikasi PALSU
 * ditolak. Sebelum perbaikan, `verifyNotification()` cuma memanggil
 * `snap.transaction.notification()` dari midtrans-client — method itu TIDAK
 * memeriksa signature sama sekali (cuma ambil transaction_id lalu query status
 * ke Midtrans). Akibatnya siapa pun yang tahu `order_id` bisa POST notifikasi
 * `settlement` palsu dan KTA-nya terbit tanpa pembayaran.
 *
 * Server key di sini nilai sintetis, bukan key produksi.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import { verifyNotificationSignature } from '@/lib/midtrans'

const SERVER_KEY = 'SB-Mid-server-DUMMYKEY1234567890'
let originalKey: string | undefined

/** Bikin notifikasi sah dengan signature yang dihitung beneran. */
function signedNotification(overrides: Record<string, unknown> = {}) {
  const base = {
    order_id: 'KTA_GATENSI_2509_001',
    status_code: '200',
    gross_amount: '150000.00',
    transaction_status: 'settlement',
    ...overrides,
  }
  // sha512(order_id + status_code + gross_amount + serverKey), tanpa pemisah.
  const raw = `${base.order_id}${base.status_code}${base.gross_amount}${SERVER_KEY}`
  return {
    ...base,
    signature_key: crypto.createHash('sha512').update(raw).digest('hex'),
  }
}

describe('verifyNotificationSignature()', () => {
  before(() => {
    originalKey = process.env.MIDTRANS_SERVER_KEY
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY
  })

  after(() => {
    if (originalKey === undefined) delete process.env.MIDTRANS_SERVER_KEY
    else process.env.MIDTRANS_SERVER_KEY = originalKey
  })

  test('signature yang dihitung benar -> diterima', () => {
    assert.equal(verifyNotificationSignature(signedNotification()), true)
  })

  test('nominal diubah tapi signature lama -> DITOLAK', () => {
    // Skenario serangan: penyerang gedein nominal tanpa bisa bikin signature.
    const n = signedNotification()
    n.gross_amount = '999999999.00'
    assert.equal(verifyNotificationSignature(n), false)
  })

  test('order_id diubah tapi signature lama -> DITOLAK', () => {
    const n = signedNotification()
    n.order_id = 'KTA_GATENSI_2509_999'
    assert.equal(verifyNotificationSignature(n), false)
  })

  test('signature dikarang asal -> DITOLAK', () => {
    const n = signedNotification()
    n.signature_key = 'a'.repeat(128)
    assert.equal(verifyNotificationSignature(n), false)
  })

  test('signature_key nggak ada -> DITOLAK, bukan diloloskan', () => {
    const n = signedNotification() as Record<string, unknown>
    delete n.signature_key
    assert.equal(verifyNotificationSignature(n), false)
  })

  test('gross_amount hilang -> DITOLAK (nggak bisa dihitung, jangan diloloskan)', () => {
    const n = signedNotification() as Record<string, unknown>
    delete n.gross_amount
    assert.equal(verifyNotificationSignature(n), false)
  })

  test('status_code angka (bukan string) tetap dihitung sama', () => {
    // Midtrans kadang mengirim status_code sebagai angka.
    const expected = signedNotification()
    const numeric = { ...expected, status_code: 200, signature_key: '' }
    const raw = `${numeric.order_id}${numeric.status_code}${numeric.gross_amount}${SERVER_KEY}`
    numeric.signature_key = crypto.createHash('sha512').update(raw).digest('hex')
    assert.equal(verifyNotificationSignature(numeric), true)
  })

  test('server key belum di-set -> DITOLAK', () => {
    const saved = process.env.MIDTRANS_SERVER_KEY
    delete process.env.MIDTRANS_SERVER_KEY
    try {
      assert.equal(verifyNotificationSignature(signedNotification()), false)
    } finally {
      process.env.MIDTRANS_SERVER_KEY = saved
    }
  })

  test('signature valid tapi kepanjangan/pendek -> DITOLAK tanpa crash', () => {
    // timingSafeEqual melempar kalau panjang beda; pastikan ditangani.
    const n = signedNotification()
    n.signature_key = 'abc'
    assert.equal(verifyNotificationSignature(n), false)
  })
})
