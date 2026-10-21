import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return formatDateWib(date)
}

export function formatDateTime(date: Date | string): string {
  return formatDateTimeWib(date)
}

/**
 * Kunci tanggal `YYYY-MM-DD` buat grouping per hari, patokan WIB.
 * Sebelumnya disalin di 3 route dashboard.
 */
export function formatDateKey(date: Date): string {
  const { year, month, day } = getWibParts(date)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Kunci bulan `YYYY-MM` buat grouping per bulan, patokan WIB.
 * Sebelumnya disalin di 3 route dashboard.
 */
export function formatDateKeyMonth(date: Date): string {
  const { year, month } = getWibParts(date)
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Zona waktu buat semua tanggal yang dicetak ke dokumen resmi (invoice PDF,
 * Excel, dashboard). Dipatok eksplisit, bukan ngikutin zona server.
 *
 * Kenapa penting: `toLocaleString('id-ID')` tanpa `timeZone` pakai zona mesin.
 * Laptop developer WIB jadi kelihatan bener, tapi server bisa UTC — jam
 * invoice di PDF meleset 7 jam tanpa ada yang sadar.
 */
export const ZONA_WAKTU_WIB = 'Asia/Jakarta'

/** Offset WIB dalam menit (+7 jam). Dipakai buat geser epoch ke "dinding" WIB. */
const WIB_OFFSET_MINUTES = 7 * 60

/**
 * Salinan Date yang komponen UTC-nya = komponen dinding WIB.
 *
 * Triknya: geser epoch +7 jam, lalu baca pakai getter UTC. Hasilnya Date
 * tiruan yang "tanggal/jamnya WIB", aman dipakai buat getFullYear/getMonth/
 * getDate tanpa peduli zona mesin. Jangan disimpan ke DB.
 */
function toWibWallClock(date: Date | string): Date {
  return new Date(new Date(date).getTime() + WIB_OFFSET_MINUTES * 60 * 1000)
}

/** Komponen tanggal WIB (tahun, bulan 0-11, tanggal). */
export function getWibParts(date: Date | string): { year: number; month: number; day: number } {
  const d = toWibWallClock(date)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() }
}

/** Awal hari WIB (00:00:00.000 WIB) sebagai Date absolut. */
export function startOfWibDay(date: Date | string): Date {
  const { year, month, day } = getWibParts(date)
  return new Date(Date.UTC(year, month, day) - WIB_OFFSET_MINUTES * 60 * 1000)
}

/** Akhir hari WIB (23:59:59.999 WIB) sebagai Date absolut. */
export function endOfWibDay(date: Date | string): Date {
  return new Date(startOfWibDay(date).getTime() + 24 * 60 * 60 * 1000 - 1)
}

/** Awal bulan WIB (tanggal 1, 00:00 WIB) sebagai Date absolut. */
export function startOfWibMonth(date: Date | string, monthOffset = 0): Date {
  const { year, month } = getWibParts(date)
  return new Date(Date.UTC(year, month + monthOffset, 1) - WIB_OFFSET_MINUTES * 60 * 1000)
}

/** Awal tahun WIB (1 Januari 00:00 WIB) buat tahun berjalan dari `date`. */
export function startOfWibYear(date: Date | string): Date {
  const { year } = getWibParts(date)
  return new Date(Date.UTC(year, 0, 1) - WIB_OFFSET_MINUTES * 60 * 1000)
}

/**
 * Ganti `d` dengan `base` yang digeser `amount` satuan kalender WIB.
 *
 * Dipakai buat rentang \"N hari/bulan/tahun ke belakang\" di dashboard. Pola
 * lama `d.setDate(d.getDate() - 7)` ngambil komponen tanggal dari zona mesin,
 * jadi di server UTC batas rentangnya meleset 7 jam dari kalender WIB.
 */
export function shiftWibDate(
  date: Date | string,
  amount: { days?: number; months?: number; years?: number }
): Date {
  const { year, month, day } = getWibParts(date)
  return new Date(Date.UTC(
    year + (amount.years ?? 0),
    month + (amount.months ?? 0),
    day + (amount.days ?? 0)
  ) - WIB_OFFSET_MINUTES * 60 * 1000)
}

/** Tambah tahun dengan patokan komponen WIB, bukan zona mesin. */
export function addYearsWib(date: Date | string, years: number): Date {
  const { year, month, day } = getWibParts(date)
  return new Date(Date.UTC(year + years, month, day) - WIB_OFFSET_MINUTES * 60 * 1000)
}

/**
 * Rentang filter dari query `YYYY-MM-DD`, dipatok WIB.
 *
 * Dulu tiap route nulis `new Date(startDate)` + `end.setHours(23,59,59,999)`.
 * `new Date('2026-10-01')` itu 00:00 **UTC**, dan `setHours` ngikutin zona
 * mesin — jadi rentangnya bergeser 7 jam tergantung host. Semua route filter
 * tanggal sekarang lewat sini biar jawabannya satu.
 */
export function buildWibRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): { gte?: Date; lte?: Date } | undefined {
  if (!startDate && !endDate) return undefined
  const range: { gte?: Date; lte?: Date } = {}
  if (startDate) range.gte = startOfWibDay(startDate)
  if (endDate) range.lte = endOfWibDay(endDate)
  return range
}

/** Tanggal + jam WIB, format panjang: "20 Oktober 2026 14.05". */
export function formatDateTimeWib(date: Date | string): string {
  return new Date(date).toLocaleString('id-ID', {
    timeZone: ZONA_WAKTU_WIB,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Tanggal + jam WIB, format ringkas tabel: "20 Okt 2026, 14.05". */
export function formatDateTimeWibShort(date: Date | string): string {
  return new Date(date).toLocaleString('id-ID', {
    timeZone: ZONA_WAKTU_WIB,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Tanggal WIB tanpa jam: "20 Oktober 2026". */
export function formatDateWib(date: Date | string): string {
  return new Date(date).toLocaleDateString('id-ID', {
    timeZone: ZONA_WAKTU_WIB,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Invoice number pakai slash (INV/KTA-GATENSI/2608/001) — amankan buat nama file download
export function safeInvoiceFilename(invoiceNumber: string): string {
  return invoiceNumber.replace(/[^a-zA-Z0-9._~-]/g, '-')
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function calculateExpiryDate(issueDate: Date, years: number = 3): Date {
  const expiryDate = new Date(issueDate)
  expiryDate.setFullYear(expiryDate.getFullYear() + years)
  return expiryDate
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    FETCHED_FROM_SIKI: 'bg-blue-100 text-blue-800',
    EDITED: 'bg-yellow-100 text-yellow-800',
    WAITING_PAYMENT: 'bg-orange-100 text-orange-800',
    READY_FOR_PUSAT: 'bg-purple-100 text-purple-800',
    APPROVED_BY_PUSAT: 'bg-green-100 text-green-800',
    READY_TO_PRINT: 'bg-cyan-100 text-cyan-800',
    PRINTED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
  }

  return statusColors[status] || 'bg-gray-100 text-gray-800'
}

export function getPaymentStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-blue-100 text-blue-800',
    VERIFIED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  }

  return statusColors[status] || 'bg-gray-100 text-gray-800'
}