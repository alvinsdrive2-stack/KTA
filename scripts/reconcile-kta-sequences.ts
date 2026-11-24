/**
 * Rekonsiliasi `lastSequence*` per daerah dengan nomor KTA yang BENERAN sudah
 * terpakai di database.
 *
 * Kenapa perlu: counter sequence di 25 daerah pernah ketinggalan di belakang
 * data (contoh Pusat/99: counter 2129 padahal nomor terpakai sudah 2134).
 * `generateNomorKTA()` sekarang pulih sendiri saat ketemu nomor terpakai, tapi
 * pemulihan itu baru jalan kalau ada yang download — dan tiap pemulihan
 * melompat satu nomor. Script ini menutup selisihnya sekaligus, tanpa perlu
 * ada yang menerbitkan KTA baru dulu.
 *
 * Aturan main:
 * - HANYA NAIK: nilai baru = max(counter sekarang, nomor tertinggi di data).
 *   Nurunin counter = risiko nomor ganda, jadi itu nggak pernah dilakukan.
 * - Nomor urut di-pad 6 digit, jadi urutan teks = urutan angka.
 * - Nggak bikin atau menghapus baris apa pun; yang disentuh cuma counter daerah.
 *
 * Pakai:
 *   npx tsx scripts/reconcile-kta-sequences.ts --dry-run   cuma tampilin diff
 *   npx tsx scripts/reconcile-kta-sequences.ts             tulis ke DB
 */
import { prisma } from '../lib/prisma'

const DRY_RUN = process.argv.includes('--dry-run')

type SequenceField = 'lastSequenceAhli' | 'lastSequenceTeknisi' | 'lastSequenceOperator'

const KATEGORI: { field: SequenceField; kode: string; label: string }[] = [
  { field: 'lastSequenceAhli', kode: '01', label: 'Ahli' },
  { field: 'lastSequenceTeknisi', kode: '02', label: 'Teknisi/Analis' },
  { field: 'lastSequenceOperator', kode: '03', label: 'Operator' },
]

async function sequenceTertinggi(kodeDaerah: string, kodeJenjang: string): Promise<number> {
  const prefix = `${kodeDaerah}.${kodeJenjang}.`
  const baris = await prisma.kTARequest.findFirst({
    where: { nomorKTA: { startsWith: prefix } },
    orderBy: { nomorKTA: 'desc' },
    select: { nomorKTA: true },
  })
  if (!baris?.nomorKTA) return 0
  const angka = parseInt(baris.nomorKTA.slice(prefix.length), 10)
  return Number.isFinite(angka) ? angka : 0
}

async function main() {
  console.log('🚀 Rekonsiliasi lastSequence KTA dari data yang sudah terbit\n')
  if (DRY_RUN) console.log('MODE DRY-RUN: cuma tampilin diff, nggak ada yang ditulis ke DB\n')

  const daerahList = await prisma.daerah.findMany({
    select: {
      id: true,
      kodeDaerah: true,
      namaDaerah: true,
      lastSequenceAhli: true,
      lastSequenceTeknisi: true,
      lastSequenceOperator: true,
    },
    orderBy: { kodeDaerah: 'asc' },
  })

  let diupdate = 0
  let tetap = 0

  for (const daerah of daerahList) {
    const data: Partial<Record<SequenceField, number>> = {}
    const rincian: string[] = []

    for (const kategori of KATEGORI) {
      const sekarang = daerah[kategori.field]
      const tertinggi = await sequenceTertinggi(daerah.kodeDaerah, kategori.kode)
      if (tertinggi > sekarang) {
        data[kategori.field] = tertinggi
        rincian.push(`   ${kategori.label}: ${sekarang} -> ${tertinggi}`)
      }
    }

    if (rincian.length === 0) {
      tetap++
      continue
    }

    if (!DRY_RUN) {
      await prisma.daerah.update({ where: { id: daerah.id }, data })
    }

    console.log(`${DRY_RUN ? '🔍 [dry-run] ' : '✅ '}${daerah.namaDaerah} (${daerah.kodeDaerah}):`)
    console.log(rincian.join('\n'))
    diupdate++
  }

  console.log('\n' + '='.repeat(60))
  console.log(`   ${DRY_RUN ? 'Akan diupdate' : 'Diupdate'}: ${diupdate}${DRY_RUN ? ' (belum ditulis)' : ''}`)
  console.log(`   Tetap (counter sudah di depan data): ${tetap}`)
  console.log('='.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
