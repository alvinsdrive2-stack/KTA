/**
 * Test regresi `generateNomorKTA()`: nomor yang diterbitkan harus unik walau
 * dipanggil bareng-bareng.
 *
 * Bug yang dijaga:
 * - Versi lama baca counter lalu tulis nilainya (`read-then-write`). Di
 *   `app/api/kta/bulk-download` seluruh PDF dibuat lewat `Promise.all`, jadi
 *   semua item membaca counter yang sama dan ngeklaim satu nomor. Karena
 *   `nomorKTA` `@unique`, semua yang kalah gagal insert, error-nya ketelen catch
 *   per-item, dan ZIP terkirim isi satu kartu. Terukur di DB: 6 KTA dipilih ->
 *   `['12.01.000001.pdf']` doang.
 * - Counter di 25 daerah ketinggalan di belakang nomor yang sudah terpakai, jadi
 *   nomor hasil increment bisa nabrak data lama.
 *
 * Double Prisma di sini niru dua sifat yang bikin bug-nya muncul: `update`
 * dengan `{ increment }` itu atomik, dan `update` dengan nilai mati menimpa
 * apa pun yang sudah ditulis (persis read-then-write yang lama).
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { generateNomorKTA } from '@/lib/kta-numbering'

interface DaerahState {
  id: string
  kodeDaerah: string
  lastSequenceAhli: number
  lastSequenceTeknisi: number
  lastSequenceOperator: number
}

type Field = 'lastSequenceAhli' | 'lastSequenceTeknisi' | 'lastSequenceOperator'

/** Bentuk argumen yang beneran dipakai kode produksi — bukan `any` bebas. */
interface IncrementValue {
  increment: number
}
interface UpdateArgs {
  data: Record<string, number | IncrementValue>
  where?: Record<string, unknown>
}
interface FindFirstArgs {
  where?: { nomorKTA?: string | { startsWith?: string } }
}

/**
 * `prisma` asli diganti method tiruan. Cast-nya ke `unknown` dulu supaya TypeScript
 * tetap nolak bentuk lain di file ini kalau mock-nya salah.
 */
const prismaTiruan = prisma as unknown as {
  daerah: { update: (args: UpdateArgs) => Promise<DaerahState>; updateMany: (args: UpdateArgs) => Promise<{ count: number }> }
  kTARequest: { findFirst: (args: FindFirstArgs) => Promise<{ id?: string; nomorKTA?: string } | null> }
}

function pasangDunia(daerahAwal: DaerahState, nomorTerpakai: string[] = []) {
  const daerah = { ...daerahAwal }
  const terpakai = new Set(nomorTerpakai)

  prismaTiruan.daerah = {
    async update(args) {
      for (const [key, value] of Object.entries(args?.data ?? {})) {
        if (!key.startsWith('lastSequence')) continue
        const field = key as Field
        daerah[field] =
          typeof value === 'object'
            ? daerah[field] + value.increment
            : value
      }
      return { ...daerah }
    },

    async updateMany(args) {
      for (const [key, value] of Object.entries(args?.data ?? {})) {
        if (!key.startsWith('lastSequence')) continue
        const field = key as Field
        const syarat = args?.where?.[key] as { lt?: number } | undefined
        if (typeof value !== 'number') continue
        if (syarat?.lt !== undefined) {
          if (daerah[field] < syarat.lt) daerah[field] = value
        } else {
          daerah[field] = value
        }
      }
      return { count: 1 }
    },
  }

  prismaTiruan.kTARequest = {
    async findFirst(args) {
      const nomor = args?.where?.nomorKTA
      if (typeof nomor === 'string') {
        return terpakai.has(nomor) ? { id: 'terpakai' } : null
      }
      // Pencarian nomor tertinggi: `startsWith` + urut menurun.
      const prefix = nomor?.startsWith
      if (typeof prefix === 'string') {
        const cocok = [...terpakai].filter((n) => n.startsWith(prefix)).sort().reverse()
        return cocok.length > 0 ? { nomorKTA: cocok[0] } : null
      }
      return null
    },
  }

  return { daerah, terpakai }
}

function daerahKosong(id: string, kodeDaerah: string): DaerahState {
  return { id, kodeDaerah, lastSequenceAhli: 0, lastSequenceTeknisi: 0, lastSequenceOperator: 0 }
}

beforeEach(() => {
  pasangDunia(daerahKosong('reset', '00'))
})

describe('generateNomorKTA — keunikan saat dipanggil paralel', () => {
  test('6 panggilan bersamaan dapat 6 nomor berbeda', async () => {
    const dunia = pasangDunia(daerahKosong('d1', '12'))

    const nomor = await Promise.all(
      Array.from({ length: 6 }, () => generateNomorKTA('d1', '7'))
    )

    assert.equal(new Set(nomor).size, 6, `nomor kembar: ${nomor.join(', ')}`)
    assert.deepEqual(
      [...nomor].sort((a, b) => a.localeCompare(b)),
      [
        '12.01.000001',
        '12.01.000002',
        '12.01.000003',
        '12.01.000004',
        '12.01.000005',
        '12.01.000006',
      ]
    )
    assert.equal(dunia.daerah.lastSequenceAhli, 6)
  })

  test('counter di belakang data: nomor yang sudah terpakai dilewati, bukan dipakai ulang', async () => {
    const dunia = pasangDunia(
      { ...daerahKosong('d1', '99'), lastSequenceAhli: 2129 },
      ['99.01.002130', '99.01.002131', '99.01.002132', '99.01.002133', '99.01.002134']
    )

    const nomor = await generateNomorKTA('d1', '7')

    assert.equal(nomor, '99.01.002135')
    assert.equal(dunia.daerah.lastSequenceAhli, 2135)
  })

  test('counter yang sudah lebih tinggi dari data nggak diturunkan', async () => {
    const dunia = pasangDunia(
      { ...daerahKosong('d1', '31'), lastSequenceAhli: 300 },
      ['31.01.000236']
    )

    const nomor = await generateNomorKTA('d1', '7')

    assert.equal(nomor, '31.01.000301')
    assert.equal(dunia.daerah.lastSequenceAhli, 301)
  })

  test('operator dan ahli naik di counter masing-masing', async () => {
    const dunia = pasangDunia(daerahKosong('d1', '16'))

    const ahli = await generateNomorKTA('d1', '7')
    const operator = await generateNomorKTA('d1', '1')

    assert.equal(ahli, '16.01.000001')
    assert.equal(operator, '16.03.000001')
    assert.equal(dunia.daerah.lastSequenceAhli, 1)
    assert.equal(dunia.daerah.lastSequenceOperator, 1)
  })
})
