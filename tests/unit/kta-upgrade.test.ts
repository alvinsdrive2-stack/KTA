/**
 * Test unit `lib/kta-upgrade.ts` — `checkUpgradeScenario()`.
 *
 * Aturan bisnis yang diuji (sumber: `docs/ARCHITECTURE.md` + komentar modul):
 * 1. Pengecekan NIK GLOBAL, kecuali daerah kode '98' — bebas DUA ARAH.
 * 2. Kategori jenjang: 1-3 Operator, 4-6 Teknisi, 7-9 Ahli.
 * 3. Jenjang sama -> ditolak. Downgrade -> ditolak. Naik -> boleh.
 * 4. Ada permohonan pending -> ditolak total.
 * 5. Harga: jenjang >= 7 = 300rb, selain itu 100rb; upgrade bayar selisihnya.
 *
 * `@/lib/prisma` di-mock lewat hook resolve `tsx` (lihat `tests/unit/setup/mock-loader.mjs`).
 * Test nggak nyentuh database sama sekali.
 */
import { prisma } from '@/lib/prisma'
import { checkUpgradeScenario, getJenjangCategory, JENJANG_LABEL } from '@/lib/kta-upgrade'
import { describe, test, expect } from './helpers/assert'

// ---------------------------------------------------------------- test double

const STATUS_PENDING = [
  'DRAFT',
  'FETCHED_FROM_SIKI',
  'EDITED',
  'WAITING_PAYMENT',
  'UPGRADE_PENDING',
  'READY_FOR_PUSAT',
]

interface KtaLike {
  id: string
  nik: string
  jenjang: string
  status: string
  nama?: string
  jabatanKerja?: string
  subklasifikasi?: string | null
  subklasifikasiId?: string | null
  noTelp?: string
  email?: string
  alamat?: string
  ktpUrl?: string | null
  fotoUrl?: string | null
  fotoData?: string | null
  kodeDaerah?: string
}

interface Panggilan {
  where: Record<string, any>
  orderBy?: Record<string, any>
}

/**
 * Mock `prisma` minimal tapi jujur: `findFirst` beneran nge-filter pakai `where`
 * yang dikirim fungsi — termasuk `status.in` dan `daerah.kodeDaerah`/`isNot`.
 * Kalau di sini cuma balikin array mentah, test filter daerah jadi hampa.
 */
function buatMockPrisma(data: KtaLike[]) {
  const panggilan: Panggilan[] = []

  const cocok = (row: KtaLike, where: Record<string, any>): boolean => {
    if (where.nik !== undefined && row.nik !== where.nik) return false

    if (where.status?.in && !where.status.in.includes(row.status)) return false

    const d = where.daerah
    if (d) {
      if (d.kodeDaerah !== undefined && row.kodeDaerah !== d.kodeDaerah) return false
      if (d.isNot?.kodeDaerah !== undefined && row.kodeDaerah === d.isNot.kodeDaerah) return false
    }

    return true
  }

  const client = {
    kTARequest: {
      async findFirst(args: Panggilan) {
        panggilan.push(args)
        const hasil = data.filter((row) => cocok(row, args.where))
        if (args.orderBy?.jenjang === 'desc') {
          // Prisma nge-sort `jenjang` (String) secara leksikografis, bukan numerik.
          // Ditiru apa adanya — lihat catatan di daftar temuan audit.
          hasil.sort((a, b) => (a.jenjang < b.jenjang ? 1 : a.jenjang > b.jenjang ? -1 : 0))
        }
        return hasil[0] ?? null
      },

      async findUnique(args: { where: { id: string } }) {
        panggilan.push({ where: args.where as Record<string, any> })
        return data.find((row) => row.id === args.where.id) ?? null
      },

      async update(args: { where: { id: string }; data: Record<string, unknown> }) {
        panggilan.push({ where: args.where as Record<string, any> })
        const row = data.find((r) => r.id === args.where.id)
        if (row) Object.assign(row, args.data)
        return row
      },
    },

    subklasifikasi: {
      async findUnique() {
        return null
      },
      async create() {
        throw new Error('mock: create subklasifikasi nggak diharapkan di test ini')
      },
      async update() {
        throw new Error('mock: update subklasifikasi nggak diharapkan di test ini')
      },
    },

    daerah: {
      async findUnique() {
        return null
      },
    },

    /** Ganti isi dataset antar-test tanpa bikin client baru. */
    __setData(rows: KtaLike[]) {
      data.length = 0
      data.push(...rows)
    },
    __panggilan: panggilan,
  }

  return client
}

const mockPrisma = buatMockPrisma([])
;(prisma as any).kTARequest = mockPrisma.kTARequest
;(prisma as any).subklasifikasi = mockPrisma.subklasifikasi
;(prisma as any).daerah = mockPrisma.daerah

/** Reset dataset tiap test — mock-nya singleton, jadi wajib. */
function pakaiData(rows: KtaLike[]) {
  mockPrisma.__setData(rows)
  mockPrisma.__panggilan.length = 0
}

const kta = (over: Partial<KtaLike> = {}): KtaLike => ({
  id: 'kta-1',
  nik: '3201010101010001',
  jenjang: '2',
  status: 'PRINTED',
  kodeDaerah: '32',
  ...over,
})

// ------------------------------------------------------------------- kategori

describe('getJenjangCategory() — batas kategori', () => {
  const kasus: [number | string, string, string][] = [
    [1, 'OPERATOR', 'batas bawah Operator'],
    [3, 'OPERATOR', 'batas atas Operator'],
    [4, 'TEKNISI', 'batas bawah Teknisi'],
    [6, 'TEKNISI', 'batas atas Teknisi'],
    [7, 'AHLI', 'batas bawah Ahli'],
    [9, 'AHLI', 'batas atas Ahli'],
  ]

  for (const [input, harap, label] of kasus) {
    test(`${label}: ${input} -> ${harap}`, async () => {
      expect.toBe(getJenjangCategory(input), harap, label)
    })
  }

  test("string '5' diparse sama kayak number 5", async () => {
    expect.toBe(getJenjangCategory('5'), 'TEKNISI')
  })

  test('label kategori seragam (dipakai UI, bukan perbandingan)', async () => {
    expect.toEqual(
      JENJANG_LABEL,
      { OPERATOR: 'Operator', TEKNISI: 'Teknisi/Analis', AHLI: 'Ahli' },
      'label'
    )
  })
})

// ----------------------------------------------------------- skenario upgrade

describe('checkUpgradeScenario() — tidak ada KTA lama', () => {
  test('NIK belum punya KTA sama sekali -> boleh, isUpgrade false, bayar penuh', async () => {
    pakaiData([])
    const r = await checkUpgradeScenario('111', 2, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, true, 'canUpgrade')
    expect.toBe(r.isUpgrade, false, 'isUpgrade')
    expect.toBe(r.existingKta, null, 'existingKta')
    expect.toBe(r.hargaUpgrade, 100000, 'hargaUpgrade jenjang 2')
  })

  test('permohonan baru jenjang 8 -> harga penuh 300rb', async () => {
    pakaiData([])
    const r = await checkUpgradeScenario('111', 8, 'SK-01', null, '32')

    expect.toBe(r.hargaBaru, 300000, 'hargaBaru')
    expect.toBe(r.hargaUpgrade, 300000, 'hargaUpgrade')
  })
})

describe('checkUpgradeScenario() — permohonan pending memblokir', () => {
  for (const status of STATUS_PENDING) {
    test(`status ${status} -> ditolak, alasannya nyebut status itu`, async () => {
      pakaiData([kta({ status, jenjang: '5' })])
      const r = await checkUpgradeScenario('3201010101010001', 8, 'SK-01', null, '32')

      expect.toBe(r.canUpgrade, false, 'canUpgrade')
      expect.toContain(String(r.reason), status, 'reason')
      expect.toBe(r.hargaUpgrade, 0, 'hargaUpgrade nggak dihitung kalau ditolak')
    })
  }

  test('KTA lama PRINTED + ada DRAFT baru -> tetap ditolak (pending menang)', async () => {
    pakaiData([
      kta({ id: 'lama', status: 'PRINTED', jenjang: '2' }),
      kta({ id: 'baru', status: 'DRAFT', jenjang: '8' }),
    ])
    const r = await checkUpgradeScenario('3201010101010001', 8, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, false, 'canUpgrade')
    expect.toBe(r.existingKta?.id, 'baru', 'yang dilaporin permohonan yang lagi diproses')
  })

  test('status yang nggak dianggap pending (WAITING_PAYMENT gagal? tidak) — REJECTED nggak memblokir', async () => {
    pakaiData([kta({ status: 'REJECTED', jenjang: '2' })])
    const r = await checkUpgradeScenario('3201010101010001', 3, 'SK-01', null, '32')

    // REJECTED bukan KTA terbit, jadi dianggap nggak ada KTA lama.
    expect.toBe(r.canUpgrade, true, 'canUpgrade')
    expect.toBe(r.existingKta, null, 'existingKta')
  })
})

describe('checkUpgradeScenario() — jenjang sama / downgrade / naik', () => {
  test('jenjang sama -> ditolak, hargaUpgrade 0, reason nyebut jenjangnya', async () => {
    pakaiData([kta({ jenjang: '5', status: 'PRINTED' })])
    const r = await checkUpgradeScenario('3201010101010001', 5, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, false, 'canUpgrade')
    expect.toBe(r.isUpgrade, false, 'isUpgrade')
    expect.toBe(r.hargaUpgrade, 0, 'hargaUpgrade')
    expect.toContain(String(r.reason), 'jenjang yang sama', 'reason')
  })

  test('downgrade kategori sama (5 -> 4) -> ditolak, reason nyebut downgrade', async () => {
    pakaiData([kta({ jenjang: '5', status: 'PRINTED' })])
    const r = await checkUpgradeScenario('3201010101010001', 4, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, false, 'canUpgrade')
    expect.toContain(String(r.reason), 'downgrade', 'reason')
  })

  test('downgrade lintas kategori (Ahli 8 -> Operator 2) -> ditolak', async () => {
    pakaiData([kta({ jenjang: '8', status: 'PRINTED' })])
    const r = await checkUpgradeScenario('3201010101010001', 2, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, false, 'canUpgrade')
    expect.toContain(String(r.reason), 'downgrade', 'reason')
  })

  test('naik di kategori sama (2 -> 3, Operator) -> boleh, harga 0', async () => {
    pakaiData([kta({ jenjang: '2', status: 'PRINTED' })])
    const r = await checkUpgradeScenario('3201010101010001', 3, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, true, 'canUpgrade')
    expect.toBe(r.isUpgrade, true, 'isUpgrade')
    expect.toBe(r.hargaBaru, 100000, 'hargaBaru')
    expect.toBe(r.hargaLama, 100000, 'hargaLama')
    expect.toBe(r.hargaUpgrade, 0, 'upgrade dalam kategori sama gratis')
  })

  test('naik lintas kategori (Teknisi 6 -> Ahli 7) -> boleh, bayar selisih 200rb', async () => {
    pakaiData([kta({ jenjang: '6', status: 'PRINTED' })])
    const r = await checkUpgradeScenario('3201010101010001', 7, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, true, 'canUpgrade')
    expect.toBe(r.hargaBaru, 300000, 'hargaBaru')
    expect.toBe(r.hargaLama, 100000, 'hargaLama')
    expect.toBe(r.hargaUpgrade, 200000, 'selisih')
  })

  test('naik jauh (Operator 1 -> Ahli 9) -> boleh, selisih 200rb', async () => {
    pakaiData([kta({ jenjang: '1', status: 'PRINTED' })])
    const r = await checkUpgradeScenario('3201010101010001', 9, 'SK-01', null, '32')

    expect.toBe(r.hargaUpgrade, 200000, 'selisih')
  })

  test('KTA lama READY_TO_PRINT juga dihitung sebagai KTA terbit', async () => {
    pakaiData([kta({ jenjang: '2', status: 'READY_TO_PRINT' })])
    const r = await checkUpgradeScenario('3201010101010001', 3, 'SK-01', null, '32')

    expect.toBe(r.isUpgrade, true, 'isUpgrade')
    expect.toBe(r.hargaUpgrade, 0, 'selisih dalam kategori sama')
  })

  test('harga upgrade nggak pernah negatif buat kombinasi naik 1-9', async () => {
    for (let lama = 1; lama <= 9; lama++) {
      for (let baru = lama + 1; baru <= 9; baru++) {
        pakaiData([kta({ jenjang: String(lama), status: 'PRINTED' })])
        const r = await checkUpgradeScenario('3201010101010001', baru, 'SK-01', null, '32')
        if (r.hargaUpgrade < 0) {
          throw new Error(`naik ${lama} -> ${baru} bikin hargaUpgrade negatif (${r.hargaUpgrade})`)
        }
      }
    }
  })
})

describe("checkUpgradeScenario() — pengecualian daerah kode '98'", () => {
  test('pengajuan DI 98, KTA lama di daerah lain -> boleh (98 nggak diblokir)', async () => {
    pakaiData([kta({ jenjang: '5', status: 'PRINTED', kodeDaerah: '32' })])
    const r = await checkUpgradeScenario('3201010101010001', 7, 'SK-01', null, '98')

    expect.toBe(r.canUpgrade, true, 'canUpgrade')
    expect.toBe(r.isUpgrade, false, 'dianggap permohonan baru, bukan upgrade')
  })

  test('pengajuan di 98, KTA lama juga di 98 -> aturan jenjang normal tetap jalan', async () => {
    // Yang diuji di sini: KTA lama DI 98 tetap kebaca (nggak ikut dikecualikan),
    // jadi perbandingan jenjangnya jalan. Naik 5 -> 7 itu upgrade sah, jadi
    // `canUpgrade` justru HARUS true — yang penting `existingKta` ketemu dan
    // harganya dihitung sebagai selisih, bukan harga penuh.
    pakaiData([kta({ jenjang: '5', status: 'PRINTED', kodeDaerah: '98' })])
    const r = await checkUpgradeScenario('3201010101010001', 7, 'SK-01', null, '98')

    expect.toBe(r.canUpgrade, true, 'upgrade sah 5 -> 7')
    expect.toBe(r.isUpgrade, true, 'kehitung upgrade, bukan permohonan baru')
    expect.toBe(r.oldJenjang, 5, 'KTA lama di 98 kebaca')
    expect.toBe(r.hargaUpgrade, 200000, 'bayar selisih, bukan harga penuh')
  })

  test('pengajuan di 98, KTA lama juga di 98, jenjang SAMA -> tetap ditolak', async () => {
    // Ini sisi yang bikin pengecualian 98 nggak bocor: orang nggak bisa ngajuin
    // jenjang sama berulang kali cuma karena daerahnya 98.
    pakaiData([kta({ jenjang: '5', status: 'PRINTED', kodeDaerah: '98' })])
    const r = await checkUpgradeScenario('3201010101010001', 5, 'SK-01', null, '98')

    expect.toBe(r.canUpgrade, false, 'jenjang sama tetap ditolak')
  })

  test('pengajuan di daerah lain, KTA lama di 98 -> boleh (arah sebaliknya)', async () => {
    pakaiData([kta({ jenjang: '8', status: 'PRINTED', kodeDaerah: '98' })])
    const r = await checkUpgradeScenario('3201010101010001', 2, 'SK-01', null, '32')

    // Kalau KTA 98-nya ikut kebaca, ini bakal ditolak sebagai downgrade.
    expect.toBe(r.canUpgrade, true, 'canUpgrade')
    expect.toBe(r.existingKta, null, 'KTA di 98 diabaikan')
  })

  test("pengajuan di daerah lain, KTA lama di '981' -> TIDAK dibebaskan (bukan kode 98)", async () => {
    // '981' itu kode daerah lain yang kebetulan diawali 98 — harus tetap diblokir.
    pakaiData([kta({ jenjang: '8', status: 'PRINTED', kodeDaerah: '981' })])
    const r = await checkUpgradeScenario('3201010101010001', 2, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, false, 'canUpgrade')
    expect.toContain(String(r.reason), 'downgrade', 'reason')
  })

  test('pending di 98 nggak ngeblokir pengajuan di daerah lain', async () => {
    pakaiData([kta({ jenjang: '2', status: 'DRAFT', kodeDaerah: '98' })])
    const r = await checkUpgradeScenario('3201010101010001', 3, 'SK-01', null, '32')

    expect.toBe(r.canUpgrade, true, 'canUpgrade')
  })

  test('daerahKode nggak dikirim -> perilaku lama: lintas semua daerah tanpa pengecualian', async () => {
    pakaiData([kta({ jenjang: '8', status: 'PRINTED', kodeDaerah: '98' })])
    const r = await checkUpgradeScenario('3201010101010001', 2, 'SK-01', null, undefined)

    expect.toBe(r.canUpgrade, false, 'canUpgrade')
    expect.toBe(r.existingKta?.id, 'kta-1', 'KTA 98 ikut kebaca kalau filter daerah nggak dikirim')
  })

  test('daerahKode null -> sama kayak nggak dikirim', async () => {
    pakaiData([kta({ jenjang: '8', status: 'PRINTED', kodeDaerah: '98' })])
    const r = await checkUpgradeScenario('3201010101010001', 2, 'SK-01', null, null)

    expect.toBe(r.canUpgrade, false, 'canUpgrade')
  })
})

describe('checkUpgradeScenario() — pemilihan KTA lama', () => {
  test('jenjang dikonversi ke number buat perbandingan, bukan dibandingin sebagai string', async () => {
    // '9' vs '10' secara leksikografis '10' < '9'. Kalau perbandingannya string,
    // tes ini bakal salah hitung.
    pakaiData([kta({ jenjang: '9', status: 'PRINTED' })])
    const r = await checkUpgradeScenario('3201010101010001', 10, 'SK-01', null, '32')

    expect.toBe(r.oldJenjang, 9, 'oldJenjang number, bukan string')
  })
})
