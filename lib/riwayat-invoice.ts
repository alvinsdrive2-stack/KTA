/**
 * Aturan riwayat invoice: siapa lihat invoice apa, dan filter tanggal
 * dikonversi ke rentang waktu WIB.
 *
 * Semua fungsi di sini murni — nggak nyentuh database. Tujuannya biar aturan
 * role & batas tanggal bisa dites tanpa nyalain server.
 */

/** Rentang tanggal (YYYY-MM-DD), dua-duanya inklusif. Kosong = nggak dibatasi. */
export interface DateRangeInput {
  /** 'YYYY-MM-DD' — awal rentang, inklusif */
  start?: string | null
  /** 'YYYY-MM-DD' — akhir rentang, inklusif */
  end?: string | null
}

export interface DateRange {
  /** batas bawah (inklusif), undefined = tanpa batas */
  gte?: Date
  /** batas atas (inklusif), undefined = tanpa batas */
  lte?: Date
}

/** Format `YYYY-MM-DD` yang sah — termasuk tanggal nyata (2026-02-31 ditolak). */
function isTanggalSah(value: string): boolean {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!cocok) return false

  const [, y, m, d] = cocok
  const tahun = Number(y)
  const bulan = Number(m)
  const hari = Number(d)
  const probe = new Date(Date.UTC(tahun, bulan - 1, hari))

  return (
    probe.getUTCFullYear() === tahun &&
    probe.getUTCMonth() === bulan - 1 &&
    probe.getUTCDate() === hari
  )
}

/**
 * Ubah `start`/`end` (tanggal WIB, jam diabaikan) jadi rentang `DateTime`.
 *
 * Kenapa WIB dan bukan UTC: tanggal `2026-10-01` yang dipilih user maksudnya
 * "1 Oktober menurut kalender Jakarta". Kalau dipotong pakai jam 00:00 UTC,
 * invoice jam 05:00 WIB tanggal 1 justru kelewat (masih 30 Sep UTC). Jadi
 * batas bawah = 00:00 WIB hari itu, batas atas = 23:59:59.999 WIB hari itu.
 *
 * Nilai yang nggak sah diabaikan (anggap tanpa batas) — filter tanggal cacat
 * nggak boleh bikin halaman kosong tanpa penjelasan.
 */
export function buildDateRange({ start, end }: DateRangeInput): DateRange {
  const rentang: DateRange = {}

  if (start && isTanggalSah(start)) {
    rentang.gte = new Date(`${start}T00:00:00.000+07:00`)
  }
  if (end && isTanggalSah(end)) {
    rentang.lte = new Date(`${end}T23:59:59.999+07:00`)
  }

  return rentang
}

// ---------------------------------------------------------------- scope role

export interface ScopeUser {
  role: string
  daerahId?: string | null
}

/** Kode daerah Badan Pengurus Pusat — satu-satunya invoice yang boleh
 *  dilihat BPP di halaman riwayat.
 *
 *  Nilainya 99, bukan 00. Sebelumnya '00' — kode itu nggak ada di tabel
 *  daerah, jadi filter BPP selalu kosong. */
export const KODE_DAERAH_PUSAT = '99'

/**
 * Filter `BulkPayment` tambahan berdasarkan role.
 *
 * - DAERAH : cuma invoice daerahnya sendiri.
 * - PUSAT  : cuma invoice daerah Pusat (BPP). Angka BPD bukan urusan BPP.
 * - ADMIN / KEUANGAN : semua daerah.
 *
 * Role di luar daftar dapat `undefined` — caller yang harus menolak request,
 * bukan diam-diam ngasih data.
 */
export function buildRiwayatScope(user: ScopeUser): object | undefined {
  switch (user.role) {
    case 'DAERAH':
      // Tanpa daerahId, jangan sampai query tanpa filter ngasih semua invoice.
      return user.daerahId ? { daerahId: user.daerahId } : { id: '__tidak_ada__' }
    case 'PUSAT':
      return { daerah: { kodeDaerah: KODE_DAERAH_PUSAT } }
    case 'ADMIN':
    case 'KEUANGAN':
      return {}
    default:
      return undefined
  }
}

/**
 * BPP (role PUSAT) nggak boleh buka invoice daerah lain walaupun tahu id-nya.
 * ADMIN/KEUANGAN bebas, DAERAH dibatasi ke daerahnya sendiri.
 */
export function bolehLihatInvoice(
  user: ScopeUser,
  invoice: { daerahId: string; daerahKode?: string | null }
): boolean {
  switch (user.role) {
    case 'ADMIN':
    case 'KEUANGAN':
      return true
    case 'PUSAT':
      return invoice.daerahKode === KODE_DAERAH_PUSAT
    case 'DAERAH':
      return !!user.daerahId && user.daerahId === invoice.daerahId
    default:
      return false
  }
}
