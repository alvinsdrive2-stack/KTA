/**
 * Test unit `lib/riwayat-invoice.ts` + formatter WIB di `lib/utils.ts`.
 *
 * Yang diuji:
 * 1. Rentang tanggal dibaca sebagai hari WIB, bukan hari UTC.
 * 2. Tanggal cacat diabaikan, bukan bikin query dari tahun 1970.
 * 3. Scope role: BPP cuma invoice daerah Pusat, BPD cuma daerahnya sendiri.
 * 4. `bolehLihatInvoice` nutup celah "tahu id-nya, jadi kebuka".
 * 5. Jam yang dicetak ke invoice patuh WIB walau mesin jalan di UTC.
 */
import {
  buildDateRange,
  buildRiwayatScope,
  bolehLihatInvoice,
  KODE_DAERAH_PUSAT,
} from '@/lib/riwayat-invoice'
import { formatDateTimeWib, formatDateTimeWibShort, formatDateWib } from '@/lib/utils'
import { describe, test, expect } from './helpers/assert'

describe('buildDateRange() — batas hari WIB', () => {
  test('start = 00:00 WIB, bukan 00:00 UTC', () => {
    const { gte } = buildDateRange({ start: '2026-10-01' })
    expect.toBe(gte?.toISOString(), '2026-09-30T17:00:00.000Z')
  })

  test('end = 23:59:59.999 WIB, jadi invoice sore hari ikut masuk', () => {
    const { lte } = buildDateRange({ end: '2026-10-01' })
    expect.toBe(lte?.toISOString(), '2026-10-01T16:59:59.999Z')
  })

  test('invoice jam 05:00 WIB tanggal 1 masih kehitung tanggal 1', () => {
    const { gte, lte } = buildDateRange({ start: '2026-10-01', end: '2026-10-01' })
    // 2026-10-01 05:00 WIB === 2026-09-30 22:00 UTC
    const invoice = new Date('2026-09-30T22:00:00.000Z')
    expect.toBeTrue(
      invoice >= (gte as Date) && invoice <= (lte as Date),
      'invoice 05:00 WIB di luar rentang tanggal 1 Oktober'
    )
  })

  test('kosong = tanpa batas', () => {
    const rentang = buildDateRange({})
    expect.toBe(rentang.gte, undefined)
    expect.toBe(rentang.lte, undefined)
  })

  test('tanggal cacat diabaikan, bukan bikin batas aneh', () => {
    expect.toBe(buildDateRange({ start: '2026-02-31' }).gte, undefined, '31 Feb harus ditolak')
    expect.toBe(buildDateRange({ start: '01-10-2026' }).gte, undefined, 'format salah harus ditolak')
    expect.toBe(buildDateRange({ start: '' }).gte, undefined, 'string kosong harus diabaikan')
  })

  test('start lebih besar dari end dibikin apa adanya — hasilnya kosong, itu wajar', () => {
    const { gte, lte } = buildDateRange({ start: '2026-10-20', end: '2026-10-01' })
    expect.toBeTrue((gte as Date) > (lte as Date))
  })
})

describe('buildRiwayatScope()', () => {
  test('BPP (PUSAT) cuma invoice daerah Pusat', () => {
    expect.toEqual(
      buildRiwayatScope({ role: 'PUSAT', daerahId: 'd-pusat' }),
      { daerah: { kodeDaerah: KODE_DAERAH_PUSAT } }
    )
  })

  test('DAERAH cuma invoice daerahnya', () => {
    expect.toEqual(
      buildRiwayatScope({ role: 'DAERAH', daerahId: 'd-aceh' }),
      { daerahId: 'd-aceh' }
    )
  })

  test('DAERAH tanpa daerahId nggak dapat semua invoice', () => {
    const scope = buildRiwayatScope({ role: 'DAERAH', daerahId: null }) as { id?: string }
    expect.toBeNonEmpty(scope.id, 'scope DAERAH tanpa daerah harus kosong, bukan {}')
  })

  test('ADMIN & KEUANGAN lintas daerah', () => {
    expect.toEqual(buildRiwayatScope({ role: 'ADMIN' }), {})
    expect.toEqual(buildRiwayatScope({ role: 'KEUANGAN' }), {})
  })

  test('role nggak dikenal = undefined (caller wajib nolak)', () => {
    expect.toBe(buildRiwayatScope({ role: 'TAMU' }), undefined)
  })
})

describe('bolehLihatInvoice()', () => {
  const invoicePusat = { daerahId: 'd-pusat', daerahKode: '99' }
  const invoiceAceh = { daerahId: 'd-aceh', daerahKode: '11' }

  test('kode daerah Pusat = 99 (bukan 00)', () => {
    expect.toBe(KODE_DAERAH_PUSAT, '99')
  })

  test('kode daerah Pusat = 99 (bukan 00)', () => {
    expect.toBe(KODE_DAERAH_PUSAT, '99')
  })

  test('BPP boleh lihat invoice Pusat', () => {
    expect.toBeTrue(bolehLihatInvoice({ role: 'PUSAT', daerahId: 'd-pusat' }, invoicePusat))
  })

  test('BPP DITOLAK buka invoice BPD walau tahu id-nya', () => {
    expect.toBeFalse(bolehLihatInvoice({ role: 'PUSAT', daerahId: 'd-pusat' }, invoiceAceh))
  })

  test('BPD cuma boleh invoice daerahnya sendiri', () => {
    expect.toBeTrue(bolehLihatInvoice({ role: 'DAERAH', daerahId: 'd-aceh' }, invoiceAceh))
    expect.toBeFalse(bolehLihatInvoice({ role: 'DAERAH', daerahId: 'd-aceh' }, invoicePusat))
  })

  test('ADMIN & KEUANGAN bebas', () => {
    expect.toBeTrue(bolehLihatInvoice({ role: 'ADMIN' }, invoiceAceh))
    expect.toBeTrue(bolehLihatInvoice({ role: 'KEUANGAN' }, invoiceAceh))
  })
})

describe('format WIB — jam di invoice nggak ikut zona mesin', () => {
  // 07:05 UTC = 14:05 WIB
  const contoh = '2026-10-20T07:05:00.000Z'

  test('formatDateTimeWib = tanggal + jam WIB', () => {
    const hasil = formatDateTimeWib(contoh)
    expect.toContain(hasil, '14.05', 'jam harus 14.05 WIB')
    expect.toContain(hasil, '2026')
  })

  test('formatDateTimeWibShort ikut WIB', () => {
    expect.toContain(formatDateTimeWibShort(contoh), '14.05')
  })

  test('formatDateWib: 23:30 UTC sudah tanggal besoknya di WIB', () => {
    const hasil = formatDateWib('2026-10-20T23:30:00.000Z')
    expect.toContain(hasil, '21', 'tanggal harus geser ke 21 karena WIB')
  })
})
