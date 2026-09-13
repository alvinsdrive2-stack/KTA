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
 * Ambil sequence berikutnya buat daerah + jenjang tertentu, catat ke database,
 * balikin nomor KTA lengkap (`<kodeDaerah>.<kodeJenjang>.<sequence 6 digit>`).
 *
 * Perhatian: increment-nya read-then-write, jadi dua request bersamaan bisa
 * dapet sequence yang sama. Kolom `nomorKTA` di schema `@unique`, jadi yang
 * kalah bakal gagal insert — bukan bikin data ganda.
 */
export async function generateNomorKTA(daerahId: string, jenjang: string): Promise<string> {
  const jenjangNum = parseInt(jenjang, 10)
  const rule = JENJANG_RULES.find((r) => jenjangNum >= r.min && jenjangNum <= r.max)

  if (!rule) {
    throw new Error(`Invalid jenjang: ${jenjang}. Must be between 1-9.`)
  }

  const daerah = await prisma.daerah.findUnique({
    where: { id: daerahId },
    select: {
      kodeDaerah: true,
      lastSequenceAhli: true,
      lastSequenceTeknisi: true,
      lastSequenceOperator: true,
    },
  })

  if (!daerah) {
    throw new Error('Daerah not found')
  }

  const nextSequence = daerah[rule.field] + 1

  await prisma.daerah.update({
    where: { id: daerahId },
    data: { [rule.field]: nextSequence },
  })

  const sequence = String(nextSequence).padStart(6, '0')
  const nomorKTA = `${daerah.kodeDaerah}.${rule.code}.${sequence}`

  console.log(
    `Generated nomorKTA: ${nomorKTA} (daerah=${daerah.kodeDaerah}, jenjang=${jenjang}, category=${rule.label}, code=${rule.code}, sequence=${sequence})`
  )

  return nomorKTA
}
