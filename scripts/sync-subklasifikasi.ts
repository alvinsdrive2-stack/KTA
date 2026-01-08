import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Data from SIKI API
const SIKI_SUBKLASIFIKASI = [
  { id_klasifikasi: "AR", id_subklasifikasi: "01", kode_subklasifikasi: "AR01", subklasifikasi: "Arsitektural" },
  { id_klasifikasi: "SI", id_subklasifikasi: "01", kode_subklasifikasi: "SI01", subklasifikasi: "Gedung" },
  { id_klasifikasi: "SI", id_subklasifikasi: "02", kode_subklasifikasi: "SI02", subklasifikasi: "Material" },
  { id_klasifikasi: "SI", id_subklasifikasi: "03", kode_subklasifikasi: "SI03", subklasifikasi: "Jalan" },
  { id_klasifikasi: "SI", id_subklasifikasi: "04", kode_subklasifikasi: "SI04", subklasifikasi: "Jembatan" },
  { id_klasifikasi: "SI", id_subklasifikasi: "05", kode_subklasifikasi: "SI05", subklasifikasi: "Landasan Udara" },
  { id_klasifikasi: "SI", id_subklasifikasi: "06", kode_subklasifikasi: "SI06", subklasifikasi: "Terowongan" },
  { id_klasifikasi: "SI", id_subklasifikasi: "07", kode_subklasifikasi: "SI07", subklasifikasi: "Bendung dan Bendungan" },
  { id_klasifikasi: "SI", id_subklasifikasi: "08", kode_subklasifikasi: "SI08", subklasifikasi: "Irigasi dan Rawa" },
  { id_klasifikasi: "SI", id_subklasifikasi: "09", kode_subklasifikasi: "SI09", subklasifikasi: "Sungai dan Pantai" },
  { id_klasifikasi: "SI", id_subklasifikasi: "10", kode_subklasifikasi: "SI10", subklasifikasi: "Air Tanah dan Air Baku" },
  { id_klasifikasi: "SI", id_subklasifikasi: "11", kode_subklasifikasi: "SI11", subklasifikasi: "Bangunan Air Minum" },
  { id_klasifikasi: "SI", id_subklasifikasi: "12", kode_subklasifikasi: "SI12", subklasifikasi: "Bangunan Air Limbah" },
  { id_klasifikasi: "SI", id_subklasifikasi: "13", kode_subklasifikasi: "SI13", subklasifikasi: "Bangunan Persampahan" },
  { id_klasifikasi: "SI", id_subklasifikasi: "14", kode_subklasifikasi: "SI14", subklasifikasi: "Drainase Perkotaan" },
  { id_klasifikasi: "SI", id_subklasifikasi: "15", kode_subklasifikasi: "SI15", subklasifikasi: "Geoteknik dan Pondasi" },
  { id_klasifikasi: "SI", id_subklasifikasi: "16", kode_subklasifikasi: "SI16", subklasifikasi: "Geodesi" },
  { id_klasifikasi: "SI", id_subklasifikasi: "17", kode_subklasifikasi: "SI17", subklasifikasi: "Jalan Rel" },
  { id_klasifikasi: "SI", id_subklasifikasi: "18", kode_subklasifikasi: "SI18", subklasifikasi: "Bangunan Menara" },
  { id_klasifikasi: "SI", id_subklasifikasi: "19", kode_subklasifikasi: "SI19", subklasifikasi: "Bangunan Pelabuhan" },
  { id_klasifikasi: "SI", id_subklasifikasi: "20", kode_subklasifikasi: "SI20", subklasifikasi: "Testing dan Analisis Teknik" },
  { id_klasifikasi: "SI", id_subklasifikasi: "21", kode_subklasifikasi: "SI21", subklasifikasi: "Bangunan Lepas Pantai" },
  { id_klasifikasi: "SI", id_subklasifikasi: "22", kode_subklasifikasi: "SI22", subklasifikasi: "Pembongkaran Bangunan" },
  { id_klasifikasi: "SI", id_subklasifikasi: "23", kode_subklasifikasi: "SI23", subklasifikasi: "Grouting" },
  { id_klasifikasi: "ME", id_subklasifikasi: "01", kode_subklasifikasi: "ME01", subklasifikasi: "Teknik Tata Udara dan Refrigasi" },
  { id_klasifikasi: "ME", id_subklasifikasi: "02", kode_subklasifikasi: "ME02", subklasifikasi: "Plumbing dan Pompa Mekanik" },
  { id_klasifikasi: "ME", id_subklasifikasi: "03", kode_subklasifikasi: "ME03", subklasifikasi: "Proteksi Kebakaran" },
  { id_klasifikasi: "ME", id_subklasifikasi: "04", kode_subklasifikasi: "ME04", subklasifikasi: "Transportasi Dalam Gedung" },
  { id_klasifikasi: "ME", id_subklasifikasi: "05", kode_subklasifikasi: "ME05", subklasifikasi: "Teknik Mekanikal" },
  { id_klasifikasi: "ME", id_subklasifikasi: "06", kode_subklasifikasi: "ME06", subklasifikasi: "Alat Berat" },
  { id_klasifikasi: "ME", id_subklasifikasi: "07", kode_subklasifikasi: "ME07", subklasifikasi: "Teknik Lifting" },
  { id_klasifikasi: "TL", id_subklasifikasi: "01", kode_subklasifikasi: "TL01", subklasifikasi: "Teknik Air Minum" },
  { id_klasifikasi: "TL", id_subklasifikasi: "02", kode_subklasifikasi: "TL02", subklasifikasi: "Teknik Lingkungan" },
  { id_klasifikasi: "TL", id_subklasifikasi: "03", kode_subklasifikasi: "TL03", subklasifikasi: "Teknik Air Limbah" },
  { id_klasifikasi: "TL", id_subklasifikasi: "04", kode_subklasifikasi: "TL04", subklasifikasi: "Teknik Perpipaan" },
  { id_klasifikasi: "TL", id_subklasifikasi: "05", kode_subklasifikasi: "TL05", subklasifikasi: "Teknik Persampahan" },
  { id_klasifikasi: "MP", id_subklasifikasi: "01", kode_subklasifikasi: "MP01", subklasifikasi: "Keselamatan Konstruksi" },
  { id_klasifikasi: "MP", id_subklasifikasi: "02", kode_subklasifikasi: "MP02", subklasifikasi: "Manajemen Konstruksi/Manajemen Proyek" },
  { id_klasifikasi: "MP", id_subklasifikasi: "03", kode_subklasifikasi: "MP03", subklasifikasi: "Hukum Kontrak Konstruksi" },
  { id_klasifikasi: "MP", id_subklasifikasi: "04", kode_subklasifikasi: "MP04", subklasifikasi: "Pengendalian Mutu Pekerjaan Konstruksi" },
  { id_klasifikasi: "MP", id_subklasifikasi: "05", kode_subklasifikasi: "MP05", subklasifikasi: "Estimasi Biaya Konstruksi" },
  { id_klasifikasi: "MP", id_subklasifikasi: "06", kode_subklasifikasi: "MP06", subklasifikasi: "Manajemen Aset Hasil Pekerjaan Konstruksi" },
  { id_klasifikasi: "AL", id_subklasifikasi: "01", kode_subklasifikasi: "AL01", subklasifikasi: "Arsitektur Lanskap" },
  { id_klasifikasi: "AL", id_subklasifikasi: "02", kode_subklasifikasi: "AL02", subklasifikasi: "Teknik Iluminasi" },
  { id_klasifikasi: "AL", id_subklasifikasi: "03", kode_subklasifikasi: "AL03", subklasifikasi: "Desain Interior" },
  { id_klasifikasi: "PW", id_subklasifikasi: "01", kode_subklasifikasi: "PW01", subklasifikasi: "Perencanaan Wilayah" },
  { id_klasifikasi: "PW", id_subklasifikasi: "02", kode_subklasifikasi: "PW02", subklasifikasi: "Perencanaan Kota (Urban Planning)" },
  { id_klasifikasi: "PW", id_subklasifikasi: "03", kode_subklasifikasi: "PW03", subklasifikasi: "Perancangan Kota (Urban Design)" },
  { id_klasifikasi: "SR", id_subklasifikasi: "01", kode_subklasifikasi: "SR01", subklasifikasi: "Investasi Infrastruktur" },
  { id_klasifikasi: "SR", id_subklasifikasi: "02", kode_subklasifikasi: "SR02", subklasifikasi: "Komputasi Konstruksi" },
  { id_klasifikasi: "SR", id_subklasifikasi: "03", kode_subklasifikasi: "SR03", subklasifikasi: "Peledakan" }
]

async function main() {
  console.log('🔄 Sync Subklasifikasi from SIKI\n')
  console.log('='.repeat(80))

  // Get existing subklasifikasi
  const existingSubklasifikasi = await prisma.subklasifikasi.findMany()
  const existingMap = new Map(existingSubklasifikasi.map(s => [s.kodeSubklasifikasi, s]))

  console.log(`📊 Existing Subklasifikasi: ${existingSubklasifikasi.length}`)
  console.log(`📊 SIKI Subklasifikasi: ${SIKI_SUBKLASIFIKASI.length}\n`)

  let created = 0
  let updated = 0
  let skipped = 0

  for (const siki of SIKI_SUBKLASIFIKASI) {
    try {
      const existing = existingMap.get(siki.kode_subklasifikasi)

      if (!existing) {
        // Create new
        await prisma.subklasifikasi.create({
          data: {
            idKlasifikasi: siki.id_klasifikasi,
            idSubklasifikasi: siki.id_subklasifikasi,
            kodeSubklasifikasi: siki.kode_subklasifikasi,
            subklasifikasi: siki.subklasifikasi,
          }
        })
        console.log(`  ✅ Created: ${siki.kode_subklasifikasi} - ${siki.subklasifikasi}`)
        created++
      } else {
        // Check if needs update
        const needsUpdate =
          existing.idKlasifikasi !== siki.id_klasifikasi ||
          existing.idSubklasifikasi !== siki.id_subklasifikasi ||
          existing.subklasifikasi !== siki.subklasifikasi

        if (needsUpdate) {
          await prisma.subklasifikasi.update({
            where: { id: existing.id },
            data: {
              idKlasifikasi: siki.id_klasifikasi,
              idSubklasifikasi: siki.id_subklasifikasi,
              subklasifikasi: siki.subklasifikasi,
            }
          })
          console.log(`  ✏️  Updated: ${siki.kode_subklasifikasi} - ${siki.subklasifikasi}`)
          updated++
        } else {
          skipped++
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Failed: ${siki.kode_subklasifikasi} - ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n📊 Summary:')
  console.log(`  ✅ Created: ${created}`)
  console.log(`  ✏️  Updated: ${updated}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)

  const finalCount = await prisma.subklasifikasi.count()
  console.log(`  📊 Total Subklasifikasi: ${finalCount}`)

  // Show all records by klasifikasi
  console.log('\n📋 All Records by Klasifikasi:')
  const allRecords = await prisma.subklasifikasi.findMany({
    orderBy: [{ idKlasifikasi: 'asc' }, { idSubklasifikasi: 'asc' }]
  })

  const groupedByKlasifikasi = new Map<string, typeof allRecords>()
  allRecords.forEach(record => {
    if (!groupedByKlasifikasi.has(record.idKlasifikasi)) {
      groupedByKlasifikasi.set(record.idKlasifikasi, [])
    }
    groupedByKlasifikasi.get(record.idKlasifikasi)!.push(record)
  })

  for (const [klasifikasi, records] of groupedByKlasifikasi) {
    console.log(`\n  ${klasifikasi} (${records.length} records):`)
    records.forEach(r => {
      console.log(`    - ${r.kodeSubklasifikasi}: ${r.subklasifikasi}`)
    })
  }
  console.log()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
