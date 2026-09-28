/**
 * Test unit `lib/siki-fields.ts`.
 *
 * Fokus: nilai yang dikembalikan buat kolom yang SIKI-nya NGGAK lengkap.
 *
 * Bug yang dijaga di sini: `deriveSikiFields()` dulu selalu balikin `''` buat
 * jenjang/noTelp/email/alamat yang kosong. Prisma nge-skip field bernilai
 * `undefined` tapi IKUT MENULIS field bernilai `''` — jadi refresh SIKI yang
 * responsnya nggak lengkap menimpa jenjang yang udah bener jadi string kosong,
 * dan `generateNomorKTA()` langsung gagal (`parseInt('')` = NaN).
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { deriveSikiFields, isLocalUpload, resolveKtpUrl, resolveFotoUrl } from '@/lib/siki-fields'

/** sikiApi palsu — nama selalu ketemu, biar fokusnya ke nilai field. */
function apiPalsu(namaSub = 'Instalasi Listrik', namaJab = 'Teknisi Listrik') {
  return {
    getSubklasifikasiName: async () => namaSub,
    getJabatanKerjaByCode: async () => namaJab,
  }
}

/**
 * Ganti `prisma.subklasifikasi` langsung di objek double.
 *
 * Pola ini sama dengan `backfill-fotodata.test.ts` — `pasangTabel()` nggak
 * kebaca dari dalam `lib/siki-fields.ts` (module-nya ke-load lewat jalur alias
 * `@/lib/prisma` yang beda dari yang di-resolve hook), jadi mengganti method
 * di objek yang sama adalah satu-satunya cara yang terbukti kebaca.
 */
function pasangSubklasifikasi() {
  const d = prisma as unknown as Record<string, unknown>
  d.subklasifikasi = {
    findUnique: async () => ({
      id: 'sub-1',
      kodeSubklasifikasi: 'IL001',
      subklasifikasi: 'Instalasi Listrik',
    }),
    update: async (args: { data: Record<string, unknown> }) => ({ id: 'sub-1', ...args.data }),
    create: async (args: { data: Record<string, unknown> }) => ({ id: 'sub-1', ...args.data }),
  }
}

describe('deriveSikiFields() — field kosong jangan jadi string kosong', () => {
  // Dipasang di tiap test, bukan lewat beforeEach: memasangnya di dalam test
  // bikin urutannya jelas dan nggak ketergantungan pada hook runner.
  const siap = () => pasangSubklasifikasi()

  test('SIKI nggak kirim jenjang -> undefined, BUKAN "" ', async () => {
    siap()
    const hasil = await deriveSikiFields({ nik: '3201', nama: 'Budi' }, apiPalsu())
    assert.equal(hasil.jenjang, undefined)
    assert.notEqual(hasil.jenjang, '')
  })

  test('SIKI nggak kirim noTelp/email/alamat -> undefined, bukan "" ', async () => {
    siap()
    const hasil = await deriveSikiFields({ nik: '3201', nama: 'Budi' }, apiPalsu())
    assert.equal(hasil.noTelp, undefined)
    assert.equal(hasil.email, undefined)
    assert.equal(hasil.alamat, undefined)
  })

  test('jenjang "0" tetap diteruskan (falsy tapi nilai sah)', async () => {
    siap()
    // `|| ''` dulu bikin "0" hilang; `??` mempertahankannya.
    const hasil = await deriveSikiFields(
      { nik: '3201', nama: 'Budi', jenjang: '0' },
      apiPalsu()
    )
    assert.equal(hasil.jenjang, '0')
  })

  test('jenjang angka dikonversi ke string (schema nyimpen String)', async () => {
    siap()
    const hasil = await deriveSikiFields(
      { nik: '3201', nama: 'Budi', jenjang: 5 },
      apiPalsu()
    )
    assert.equal(hasil.jenjang, '5')
  })

  test('jenjang dari klasifikasi_kualifikasi dipakai, bukan jenjang root', async () => {
    siap()
    const hasil = await deriveSikiFields(
      {
        nik: '3201',
        nama: 'Budi',
        jenjang: '1',
        klasifikasi_kualifikasi: [
          { id_jabatan_kerja: 'J1', subklasifikasi: 'IL001', klasifikasi: 'IL', jenjang: '7' },
        ],
      },
      apiPalsu()
    )
    assert.equal(hasil.jenjang, '7')
  })

  test('data null -> semua field nullable undefined, nggak crash', async () => {
    siap()
    const hasil = await deriveSikiFields(null, apiPalsu())
    assert.equal(hasil.jenjang, undefined)
    assert.equal(hasil.nik, undefined)
    assert.equal(hasil.nama, undefined)
    assert.equal(hasil.noTelp, undefined)
    assert.equal(hasil.email, undefined)
    assert.equal(hasil.alamat, undefined)
  })
})

describe('resolveKtpUrl() — upload manual nggak boleh ketimpa', () => {
  test('SIKI nggak kirim apa-apa -> nilai lama dipertahankan', () => {
    assert.equal(resolveKtpUrl('/uploads/ktp/a.jpg', null), '/uploads/ktp/a.jpg')
    assert.equal(resolveKtpUrl('/uploads/ktp/a.jpg', undefined), '/uploads/ktp/a.jpg')
  })

  test('nilai lama hasil upload manual -> URL SIKI diabaikan', () => {
    assert.equal(
      resolveKtpUrl('/uploads/ktp/a.jpg', 'https://siki/x.jpg'),
      '/uploads/ktp/a.jpg'
    )
  })

  test('nilai lama masih URL SIKI -> URL baru diterima', () => {
    assert.equal(
      resolveKtpUrl('https://siki/old.jpg', 'https://siki/new.jpg'),
      'https://siki/new.jpg'
    )
  })

  test('nilai lama kosong -> URL SIKI diterima', () => {
    assert.equal(resolveKtpUrl(null, 'https://siki/new.jpg'), 'https://siki/new.jpg')
  })
})

describe('resolveFotoUrl() — foto SELALU ikut SIKI kecuali null', () => {
  test('URL SIKI baru menang walau yang lama upload manual', () => {
    // Beda sengaja dari KTP: foto sering berganti di SIKI.
    assert.equal(
      resolveFotoUrl('/uploads/foto/a.jpg', 'https://siki/new.jpg'),
      'https://siki/new.jpg'
    )
  })

  test('SIKI balikin null -> nilai lama dipertahankan', () => {
    assert.equal(resolveFotoUrl('/uploads/foto/a.jpg', null), '/uploads/foto/a.jpg')
  })
})

describe('isLocalUpload()', () => {
  test('path relatif = upload lokal', () => {
    assert.equal(isLocalUpload('/uploads/ktp/a.jpg'), true)
  })

  test('URL http = bukan upload lokal', () => {
    assert.equal(isLocalUpload('https://siki/x.jpg'), false)
  })

  test('null / string kosong = bukan upload lokal', () => {
    assert.equal(isLocalUpload(null), false)
    assert.equal(isLocalUpload(''), false)
  })
})
