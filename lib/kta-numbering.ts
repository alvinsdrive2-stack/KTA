/**
 * Generator nomor KTA — satu-satunya sumber.
 *
 * Sebelumnya fungsi ini disalin di 4 route (`kta/bulk-download`,
 * `kta/[id]/generate-pdf`, `payments/midtrans-notification`, `payments/verify`).
 * Logikanya masih sama, tapi udah mulai beda detail — dan karena ini yang
 * nerbitin nomor identitas anggota, drift di sini artinya dua alur bisa
 * ngeklaim sequence yang sama.
 */
import { prisma } from './prisma'

type SequenceField = 'lastSequenceAhli' | 'lastSequenceTeknisi' | 'lastSequenceOperator'

interface JenjangRule {
  min: number
  max: number
  code: string
  label: string
  field: SequenceField
}

/** Format nomor: 1-3 Operator (03), 4-6 Teknisi/Analis (02), 7-9 Ahli (01). */
const JENJANG_RULES: JenjangRule[] = [
  { min: 1, max: 3, code: '03', label: 'Operator', field: 'lastSequenceOperator' },
  { min: 4, max: 6, code: '02', label: 'Teknisi/Analis', field: 'lastSequenceTeknisi' },
  { min: 7, max: 9, code: '01', label: 'Ahli', field: 'lastSequenceAhli' },
]

/**
 * Berapa kali boleh nyoba ulang sebelum menyerah. Satu putaran cukup buat
 * drift biasa (counter cuma ketinggalan beberapa puluh), putaran kedua jaga-jaga
 * kalau ada request lain yang naik duluan di antara cek dan lompat.
 */
const MAX_ATTEMPTS = 3

const P2025 = 'P2025'

/**
 * Ambil sequence berikutnya buat daerah + jenjang tertentu, catat ke database,
 * balikin nomor KTA lengkap (`<kodeDaerah>.<kodeJenjang>.<sequence 6 digit>`).
 *
 * Naikkan counter pakai `{ increment: 1 }` — satu statement UPDATE, jadi dua
 * request barengan nggak mungkin dapet angka yang sama. Versi sebelumnya baca
 * counter dulu baru tulis, dan itu bikin seluruh batch paralel (lihat
 * `app/api/kta/bulk-download`) ngeklaim satu nomor yang sama. Karena `nomorKTA`
 * `@unique`, semua yang kalah gagal insert.
 *
 * Nomor yang ternyata sudah terpakai artinya counter di belakang data — pernah
 * kejadian di 25 daerah, jadi bukan kasus teoretis. Kalau ketemu, counter
 * dilompatkan ke nomor tertinggi yang sudah ada, bukan dicoba satu-satu.
 */
export async function generateNomorKTA(daerahId: string, jenjang: string): Promise<string> {
  const jenjangNum = parseInt(jenjang, 10)
  const rule = JENJANG_RULES.find((r) => jenjangNum >= r.min && jenjangNum <= r.max)

  if (!rule) {
    throw new Error(`Invalid jenjang: ${jenjang}. Must be between 1-9.`)
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const daerah = await naikkanCounter(daerahId, rule)
    const nomorKTA = formatNomor(daerah.kodeDaerah, rule.code, daerah[rule.field])

    const terpakai = await prisma.kTARequest.findFirst({
      where: { nomorKTA },
      select: { id: true },
    })
    if (!terpakai) {
      console.log(
        `Generated nomorKTA: ${nomorKTA} (daerah=${daerah.kodeDaerah}, jenjang=${jenjang}, category=${rule.label}, code=${rule.code})`
      )
      return nomorKTA
    }

    console.warn(
      `nomorKTA ${nomorKTA} sudah terpakai — counter daerah ${daerah.kodeDaerah} ` +
        `di belakang data. Lompat ke nomor tertinggi.`
    )
    await lompatKeNomorTertinggi(daerahId, daerah.kodeDaerah, rule)
  }

  throw new Error(
    `Gagal dapet nomorKTA unik buat daerah ${daerahId} jenjang ${jenjang} setelah ${MAX_ATTEMPTS} percobaan`
  )
}

async function naikkanCounter(
  daerahId: string,
  rule: JenjangRule
): Promise<{ kodeDaerah: string } & Record<SequenceField, number>> {
  try {
    return await prisma.daerah.update({
      where: { id: daerahId },
      data: { [rule.field]: { increment: 1 } },
      select: {
        kodeDaerah: true,
        lastSequenceAhli: true,
        lastSequenceTeknisi: true,
        lastSequenceOperator: true,
      },
    })
  } catch (error) {
    // Prisma nggak nemu barisnya = daerah nggak ada. Pemanggil lama dapat pesan
    // yang sama, jadi kontraknya nggak berubah.
    if ((error as { code?: string } | null)?.code === P2025) {
      throw new Error('Daerah not found')
    }
    throw error
  }
}

/**
 * Naikkan counter ke nomor tertinggi yang sudah terpakai buat daerah + jenjang
 * ini. Dibatasi `updateMany` dengan syarat counter masih lebih kecil, jadi kalau
 * request lain sudah naik lebih tinggi duluan, nilainya nggak diturunkan.
 */
async function lompatKeNomorTertinggi(
  daerahId: string,
  kodeDaerah: string,
  rule: JenjangRule
): Promise<void> {
  const prefix = `${kodeDaerah}.${rule.code}.`

  // Nomor sequence di-pad 6 digit, jadi urutan leksikografis = urutan angka.
  const terakhir = await prisma.kTARequest.findFirst({
    where: { nomorKTA: { startsWith: prefix } },
    orderBy: { nomorKTA: 'desc' },
    select: { nomorKTA: true },
  })

  const sequence = parseInt(terakhir?.nomorKTA?.slice(prefix.length) ?? '', 10)
  if (!Number.isFinite(sequence)) return

  await prisma.daerah.updateMany({
    where: { id: daerahId, [rule.field]: { lt: sequence } },
    data: { [rule.field]: sequence },
  })
}

function formatNomor(kodeDaerah: string, kodeJenjang: string, sequence: number): string {
  return `${kodeDaerah}.${kodeJenjang}.${String(sequence).padStart(6, '0')}`
}
