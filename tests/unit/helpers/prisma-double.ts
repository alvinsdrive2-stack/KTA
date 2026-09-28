/**
 * Double buat `lib/prisma` — dipasang ke `globalThis.__KTA_PRISMA_DOUBLE__`
 * supaya kebaca oleh `setup/prisma-hook.mjs`.
 *
 * Dua mode, tergantung test-nya:
 *
 * 1. `pasangTabel('kTARequest', { findFirst, ... })` — ganti method tertentu
 *    dengan fungsi bikinan test. Dipakai buat test yang butuh mock yang benar-
 *    benar nyaring data (misal niru `where.status.in`).
 *
 * 2. `pasangDaerah(rows)` / `pasangNomorKTA(...)` — shortcut siap pakai buat
 *    test `kta-numbering`.
 *
 * Ini BUKAN mock yang bisa dipakai buat nguji filter Prisma asli — Prisma nggak
 * dijalankan. Yang diuji adalah keputusan di kode aplikasi (fungsi mana yang
 * dipanggil, `where` apa yang dikirim, hasilnya diapain), bukan kemampuan
 * Prisma. Test yang butuh query nyata harus jadi integration test — lihat
 * "Celah cakupan" di audit.
 */

type Method = (...args: any[]) => any

const double: Record<string, any> = {
  $connect: async () => {},
  $disconnect: async () => {},
  $transaction: async (arg: any) => (typeof arg === 'function' ? arg(double) : arg),
  $queryRaw: async () => [],
  $executeRaw: async () => 0,
}

const namaTabel = ['kTARequest', 'subklasifikasi', 'daerah', 'user', 'invoice', 'payment']

for (const nama of namaTabel) {
  double[nama] = {
    findFirst: async () => {
      throw new Error(`mock prisma: ${nama}.findFirst dipanggil tanpa dipasang`)
    },
    findUnique: async () => {
      throw new Error(`mock prisma: ${nama}.findUnique dipanggil tanpa dipasang`)
    },
    findMany: async () => {
      throw new Error(`mock prisma: ${nama}.findMany dipanggil tanpa dipasang`)
    },
    create: async () => {
      throw new Error(`mock prisma: ${nama}.create dipanggil tanpa dipasang`)
    },
    update: async () => {
      throw new Error(`mock prisma: ${nama}.update dipanggil tanpa dipasang`)
    },
    updateMany: async () => {
      throw new Error(`mock prisma: ${nama}.updateMany dipanggil tanpa dipasang`)
    },
    count: async () => {
      throw new Error(`mock prisma: ${nama}.count dipanggil tanpa dipasang`)
    },
    delete: async () => {
      throw new Error(`mock prisma: ${nama}.delete dipanggil tanpa dipasang`)
    },
  }
}

/** Ganti satu atau beberapa method di satu tabel. */
export function pasangTabel(nama: string, method: Record<string, Method>): void {
  if (!double[nama]) {
    throw new Error(`mock prisma: tabel "${nama}" nggak dikenal`)
  }
  Object.assign(double[nama], method)
}

/** Balikin objek double mentah — buat assert isi `where` yang dikirim kode. */
export function doubleMentah(): Record<string, any> {
  return double
}

/** Reset ke kondisi "semua method nggak dipasang". Dipanggil di `beforeEach`. */
export function resetDouble(): void {
  for (const nama of namaTabel) {
    for (const key of Object.keys(double[nama])) {
      double[nama][key] = async () => {
        throw new Error(`mock prisma: ${nama}.${key} dipanggil tanpa dipasang`)
      }
    }
  }
}

// `daerah` di schema punya `lastSequence*` Int NOT NULL default 0 — mock harus
// niru default itu, soalnya `generateNomorKTA` baca `row[field] + 1` langsung.
interface DaerahRow {
  id: string
  kodeDaerah: string
  namaDaerah?: string
  lastSequenceAhli?: number
  lastSequenceTeknisi?: number
  lastSequenceOperator?: number
}

/**
 * Pasang `prisma.daerah` dengan state di memori.
 *
 * `update` beneran ngubah state-nya, jadi test bisa manggil `generateNomorKTA`
 * dua kali buat NIK/daerah sama dan lihat sequence-nya naik — bukan dua kali
 * nomor yang sama.
 */
export function pasangDaerah(rows: DaerahRow[]): {
  rows: DaerahRow[]
  panggilan: { findUnique: any[]; update: any[] }
} {
  const state = rows.map((r) => ({
    lastSequenceAhli: 0,
    lastSequenceTeknisi: 0,
    lastSequenceOperator: 0,
    ...r,
  }))
  const panggilan = { findUnique: [] as any[], update: [] as any[] }

  pasangTabel('daerah', {
    async findUnique(args: any) {
      panggilan.findUnique.push(args)
      const row = state.find((r) => r.id === args?.where?.id)
      if (!row) return null
      // `select` dihormati: kode aplikasi minta kolom tertentu aja.
      if (args?.select) {
        const hasil: Record<string, unknown> = {}
        for (const key of Object.keys(args.select)) {
          if (args.select[key]) hasil[key] = (row as Record<string, unknown>)[key]
        }
        return hasil
      }
      return row
    },

    async update(args: any) {
      panggilan.update.push(args)
      const row = state.find((r) => r.id === args?.where?.id)
      if (!row) throw new Error(`mock prisma: daerah ${args?.where?.id} nggak ada`)
      Object.assign(row, args.data)
      return row
    },
  })

  return { rows: state, panggilan }
}

// Pasang ke global SEBELUM module `@/lib/prisma` pertama kali di-resolve.
;(globalThis as any).__KTA_PRISMA_DOUBLE__ = double

export const prisma = double
export default double
