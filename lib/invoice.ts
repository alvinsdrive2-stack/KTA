import { prisma } from '@/lib/prisma'

const INVOICE_PREFIX = 'INV/KTA-GATENSI/'

// Format: INV/KTA-GATENSI/[yymm]/[urut-3digit-dari-001]
// Contoh: INV/KTA-GATENSI/2608/001
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const monthPrefix = `${INVOICE_PREFIX}${yy}${mm}/`

  const lastInvoice = await prisma.bulkPayment.findFirst({
    where: { invoiceNumber: { startsWith: monthPrefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true }
  })

  let sequence = 1
  if (lastInvoice?.invoiceNumber) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('/').pop() || '0', 10)
    if (!isNaN(lastSeq)) sequence = lastSeq + 1
  }

  return `${monthPrefix}${String(sequence).padStart(3, '0')}`
}

/**
 * Angka-angka duit satu invoice.
 *
 * Aturannya: invoice itu catatan tetap. Begitu invoice dibuat, nominalnya
 * dibekukan di `BulkPayment.totalNominal` + `Payment.jumlah`. Kalau diskon
 * daerah atau harga dasar berubah setelah itu, invoice TIDAK ikut berubah.
 *
 * Sebelum ini, PDF/Excel/halaman menghitung ulang dari `daerah.diskonPersen`
 * yang dibaca saat itu juga — jadi angka di layar beda sama yang ditagih.
 * Semua jalur sekarang lewat sini biar cuma ada satu jawaban.
 */
export interface InvoiceAmountLine {
  /** harga sebelum diskon untuk baris ini (pakai snapshot kalau ada) */
  effectiveHarga: number
  /** Payment.jumlah — nominal yang ditagih untuk baris ini, dibekukan saat invoice dibuat */
  jumlah: number
}

export interface InvoiceAmounts {
  /** total harga sebelum diskon */
  totalHargaBase: number
  /** persen diskon yang berlaku saat invoice dibuat */
  diskonPersen: number
  /** nominal diskon (porsi BPD) */
  diskonAmount: number
  /** yang harus dibayar — dibekukan, sumber kebenarannya `BulkPayment.totalNominal` */
  totalTagihan: number
  isFree: boolean
}

export function resolveInvoiceAmounts(
  invoice: {
    totalNominal: number
    totalHargaBase?: number | null
    diskonPersen?: number | null
  },
  lines: InvoiceAmountLine[]
): InvoiceAmounts {
  const totalHargaBase =
    invoice.totalHargaBase ?? lines.reduce((sum, l) => sum + (l.effectiveHarga || 0), 0)

  // totalNominal dibekukan saat invoice dibuat — ini yang ditagih, titik.
  const totalTagihan =
    invoice.totalNominal || lines.reduce((sum, l) => sum + (l.jumlah || 0), 0)

  const diskonAmount = Math.max(0, totalHargaBase - totalTagihan)

  // Invoice lama belum punya snapshot diskon: hitung dari selisih base vs tagihan.
  // JANGAN pakai daerah.diskonPersen yang sekarang — itu justru sumber driftnya.
  const diskonPersen =
    invoice.diskonPersen ??
    (totalHargaBase > 0 ? Math.round((diskonAmount / totalHargaBase) * 100) : 0)

  return {
    totalHargaBase,
    diskonPersen,
    diskonAmount,
    totalTagihan,
    isFree: diskonPersen >= 100,
  }
}

/** Harga baris sebelum diskon. Snapshot dulu, baru hitung dari hargaBase kalau belum ada. */
export function lineHargaBase(
  line: {
    hargaBaseSnapshot?: number | null
    ktaRequest: { hargaBase?: number | null; isUpgrade?: boolean | null }
  },
  previousKtaBase?: number | null
): number {
  if (line.hargaBaseSnapshot != null) return line.hargaBaseSnapshot

  const hargaBase = line.ktaRequest.hargaBase || 0
  if (line.ktaRequest.isUpgrade && previousKtaBase != null) {
    return hargaBase - previousKtaBase
  }
  return hargaBase
}

/**
 * Harga dasar per baris saat invoice dibuat (upgrade = selisih jenjang).
 * Dipakai endpoint pembuat invoice buat nulis snapshot.
 */
export async function computeHargaBaseSnapshot(
  ktaRequests: Array<{
    id: string
    hargaBase: number | null
    isUpgrade: boolean
    upgradeFromKtaId: string | null
  }>
): Promise<{ totalHargaBase: number; baseById: Record<string, number> }> {
  const upgradeFromIds = ktaRequests
    .filter((r) => r.isUpgrade && r.upgradeFromKtaId)
    .map((r) => r.upgradeFromKtaId as string)

  const prevBases = new Map<string, number>()
  if (upgradeFromIds.length > 0) {
    const prevKtas = await prisma.kTARequest.findMany({
      where: { id: { in: upgradeFromIds } },
      select: { id: true, hargaBase: true }
    })
    prevKtas.forEach((k) => prevBases.set(k.id, k.hargaBase || 0))
  }

  const baseById: Record<string, number> = {}
  let totalHargaBase = 0

  for (const req of ktaRequests) {
    const hargaBase = req.hargaBase || 0
    const prevBase =
      req.isUpgrade && req.upgradeFromKtaId
        ? prevBases.get(req.upgradeFromKtaId)
        : undefined

    const base = prevBase != null ? hargaBase - prevBase : hargaBase
    baseById[req.id] = base
    totalHargaBase += base
  }

  return { totalHargaBase, baseById }
}
