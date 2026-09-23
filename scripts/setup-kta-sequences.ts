import { prisma } from '../lib/prisma'

/**
 * Set lastSequence KTA per daerah dari "nomor kta terakhir.docx".
 *
 * String nomor di bawah disalin persis dari doc (word/document.xml), sequence
 * diparse oleh kode — bukan ketik manual — biar salah ketik angka ketahuan.
 *
 * Aturan main:
 * - Update HANYA NAIK: max(nilai DB, nilai doc). Nggak pernah nurunin, karena
 *   nurunin sequence = risiko nomor KTA ganda.
 * - Daerah yang nggak ketemu di DB di-skip + dilaporin, nggak dibikin baru.
 * - Daerah yang nggak ada di doc (mis. Sumut, Riau, Bengkulu, dst.) nggak
 *   disentuh sama sekali.
 *
 * Anomali di doc, dan keputusan buat masing-masing (jangan diubah diam-diam):
 * - Lampung, Ahli tertulis "18.02.000067": segmen .02 itu jatah Teknisi, tapi
 *   labelnya Ahli. Diambil angkanya aja: Ahli=67, Teknisi=68. Script ngasih
 *   warning tiap segmen nggak cocok, tapi angka tetap dipakai.
 * - NTB Teknisi tertulis "52.02.0008 60" kepotong dua run di XML: digabung 860.
 * - Kalsel Operator tertulis "63.02.000001" (segmen .02): angka 1 buat Operator.
 * - Papua Operator tertulis "94.02.000000": 0, nggak ngubah apa-apa.
 * - Maluku (81), Sulbar (76), Sulut (71): semua "00", belum ada nomor — nggak
 *   masuk mapping, nggak disentuh.
 * - Kode Papua ngikutin fix_kode_daerah_papua.sql: Papua=94, Papua Barat=91,
 *   Papua Barat Daya=92.
 * - Pusat nomornya 99.x tapi barisnya kode '00' — ngikutin mapping lama file ini.
 * - K3 (98.x): baris kode '98'. Kalau belum ada di DB bakal ke-skip + kelapor.
 *
 * Pakai:
 *   npm run db:kta-sequences              tulis ke DB
 *   npm run db:kta-sequences -- --dry-run cuma tampilin diff, nggak nulis
 */

interface SequenceEntry {
  kode: string
  /** Kode yang muncul di segmen pertama nomor (beda dari `kode` cuma buat Pusat). */
  kodeDiNomor?: string
  nama: string
  ahli: string
  teknisi: string
  operator: string
}

const DARI_DOC: SequenceEntry[] = [
  { kode: '11', nama: 'Aceh', ahli: '11.01.000086', teknisi: '11.02.000137', operator: '11.03.000000' },
  { kode: '15', nama: 'Jambi', ahli: '15.01.000004', teknisi: '15.02.000036', operator: '15.03.000000' },
  { kode: '13', nama: 'Sumatera Barat', ahli: '13.01.000033', teknisi: '13.02.000130', operator: '13.03.000000' },
  { kode: '16', nama: 'Sumatera Selatan', ahli: '16.01.000156', teknisi: '16.02.000731', operator: '16.03.000013' },
  // Ahli tertulis 18.02.000067 di doc (segmen .02, harusnya .01) — angka 67 dipakai, lihat warning.
  { kode: '18', nama: 'Lampung', ahli: '18.02.000067', teknisi: '18.02.000068', operator: '18.03.000015' },
  { kode: '19', nama: 'Bangka Belitung', ahli: '19.01.000076', teknisi: '19.02.000163', operator: '19.03.000037' },
  { kode: '21', nama: 'Kepri', ahli: '21.01.000047', teknisi: '21.02.000254', operator: '21.03.000001' },
  { kode: '31', nama: 'DKI Jakarta', ahli: '31.01.000253', teknisi: '31.02.000442', operator: '31.03.000030' },
  { kode: '32', nama: 'Jawa Barat', ahli: '32.01.000263', teknisi: '32.02.000925', operator: '32.03.000065' },
  { kode: '33', nama: 'Jawa Tengah', ahli: '33.01.000409', teknisi: '33.02.001460', operator: '33.03.000016' },
  { kode: '34', nama: 'DI Yogyakarta', ahli: '34.01.000035', teknisi: '34.02.000194', operator: '34.03.000003' },
  { kode: '35', nama: 'Jawa Timur', ahli: '35.01.000213', teknisi: '35.02.001374', operator: '35.03.000033' },
  { kode: '36', nama: 'Banten', ahli: '36.01.000045', teknisi: '36.02.000267', operator: '36.03.000012' },
  { kode: '52', nama: 'NTB', ahli: '52.01.000141', teknisi: '52.02.000860', operator: '52.03.000000' },
  { kode: '53', nama: 'NTT', ahli: '53.01.000177', teknisi: '53.02.000312', operator: '53.03.000005' },
  { kode: '61', nama: 'Kalimantan Barat', ahli: '61.01.000117', teknisi: '61.02.000639', operator: '61.03.000015' },
  { kode: '62', nama: 'Kalimantan Tengah', ahli: '62.01.000000', teknisi: '62.02.000008', operator: '62.03.000004' },
  // Operator tertulis 63.02.000001 di doc (segmen .02, harusnya .03) — angka 1 dipakai, lihat warning.
  { kode: '63', nama: 'Kalimantan Selatan', ahli: '63.01.000220', teknisi: '63.02.000285', operator: '63.02.000001' },
  { kode: '64', nama: 'Kalimantan Timur', ahli: '64.01.000203', teknisi: '64.02.000986', operator: '00' },
  { kode: '72', nama: 'Sulawesi Tengah', ahli: '72.01.000029', teknisi: '72.02.000108', operator: '00' },
  { kode: '73', nama: 'Sulawesi Selatan', ahli: '73.01.000183', teknisi: '73.02.000382', operator: '73.03.000001' },
  { kode: '75', nama: 'Gorontalo', ahli: '75.01.000000', teknisi: '75.02.000004', operator: '75.03.000000' },
  { kode: '51', nama: 'Bali', ahli: '51.01.000144', teknisi: '51.02.000595', operator: '51.03.000072' },
  { kode: '91', nama: 'Papua Barat', ahli: '91.01.000037', teknisi: '91.02.000356', operator: '91.03.000000' },
  // Operator tertulis 94.02.000000 di doc (segmen .02, harusnya .03) — 0, nggak ngubah apa-apa.
  { kode: '94', nama: 'Papua', ahli: '94.01.000035', teknisi: '94.02.000270', operator: '94.02.000000' },
  { kode: '92', nama: 'Papua Barat Daya', ahli: '92.01.000001', teknisi: '92.02.000003', operator: '00' },
  { kode: '00', kodeDiNomor: '99', nama: 'Pusat', ahli: '99.01.002391', teknisi: '99.02.002963', operator: '99.03.000564' },
  { kode: '98', nama: 'K3', ahli: '98.01.000011', teknisi: '98.02.000006', operator: '98.03.000056' },
]

// Segmen jenjang yang bener: 01 = Ahli, 02 = Teknisi, 03 = Operator.
const KODE_JENJANG: Record<'ahli' | 'teknisi' | 'operator', string> = {
  ahli: '01',
  teknisi: '02',
  operator: '03',
}

/**
 * Parse "XX.YY.ZZZZZZ" jadi sequence. "00" artinya belum ada nomor -> 0.
 * Segmen yang nggak cocok cuma di-warning, nggak digagalin — keputusannya
 * udah dicatat di header file ini.
 */
function ambilSequence(
  nomor: string,
  entry: SequenceEntry,
  jenjang: 'ahli' | 'teknisi' | 'operator',
): number {
  const s = nomor.trim()
  if (s === '00' || s === '0' || s === '') return 0
  const cocok = s.match(/^(\d{2})\.(\d{2})\.(\d{6})$/)
  if (!cocok) {
    throw new Error(`format nomor nggak dikenal: "${nomor}" (${entry.nama} ${jenjang})`)
  }
  const kodeHarapan = entry.kodeDiNomor ?? entry.kode
  if (cocok[1] !== kodeHarapan || cocok[2] !== KODE_JENJANG[jenjang]) {
    console.log(
      `   ⚠️  segmen nggak cocok di doc: "${s}" buat ${entry.nama} ${jenjang} ` +
      `(harapan ${kodeHarapan}.${KODE_JENJANG[jenjang]}.xxxxxx) — angka tetap dipakai`,
    )
  }
  return parseInt(cocok[3], 10)
}

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log('🚀 Update lastSequence KTA dari "nomor kta terakhir.docx"\n')
  if (DRY_RUN) console.log('MODE DRY-RUN: cuma tampilin diff, nggak ada yang ditulis ke DB\n')

  let sukses = 0
  let tetap = 0
  let skip = 0
  let gagal = 0

  for (const entry of DARI_DOC) {
    try {
      const ahli = ambilSequence(entry.ahli, entry, 'ahli')
      const teknisi = ambilSequence(entry.teknisi, entry, 'teknisi')
      const operator = ambilSequence(entry.operator, entry, 'operator')

      const daerah = await prisma.daerah.findFirst({
        where: { OR: [{ kodeDaerah: entry.kode }, { kodePropinsi: entry.kode }] },
      })

      if (!daerah) {
        console.log(`⏭️  SKIP ${entry.kode} ${entry.nama}: nggak ada di tabel daerah (bikin manual dulu kalau perlu)`)
        skip++
        continue
      }

      const baru = {
        lastSequenceAhli: Math.max(daerah.lastSequenceAhli, ahli),
        lastSequenceTeknisi: Math.max(daerah.lastSequenceTeknisi, teknisi),
        lastSequenceOperator: Math.max(daerah.lastSequenceOperator, operator),
      }

      const berubah =
        baru.lastSequenceAhli !== daerah.lastSequenceAhli ||
        baru.lastSequenceTeknisi !== daerah.lastSequenceTeknisi ||
        baru.lastSequenceOperator !== daerah.lastSequenceOperator

      if (!berubah) {
        console.log(`➖ ${daerah.namaDaerah} (${daerah.kodeDaerah}): DB udah >= doc, nggak disentuh`)
        tetap++
        continue
      }

      if (!DRY_RUN) {
        await prisma.daerah.update({ where: { id: daerah.id }, data: baru })
      }

      console.log(
        `${DRY_RUN ? '🔍 [dry-run] ' : '✅ '}${daerah.namaDaerah} (${daerah.kodeDaerah}):\n` +
        `   Ahli:     ${daerah.lastSequenceAhli} -> ${baru.lastSequenceAhli}\n` +
        `   Teknisi:  ${daerah.lastSequenceTeknisi} -> ${baru.lastSequenceTeknisi}\n` +
        `   Operator: ${daerah.lastSequenceOperator} -> ${baru.lastSequenceOperator}`,
      )
      sukses++
    } catch (error) {
      console.error(`❌ ERROR ${entry.nama}:`, error)
      gagal++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 SUMMARY:')
  console.log(`   ✅ Diupdate: ${sukses}${DRY_RUN ? ' (dry-run, belum ditulis)' : ''}`)
  console.log(`   ➖ Tetap (DB udah >= doc): ${tetap}`)
  console.log(`   ⏭️  Skip (daerah nggak ada): ${skip}`)
  console.log(`   ❌ Error: ${gagal}`)
  console.log('='.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
