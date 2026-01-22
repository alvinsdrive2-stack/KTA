import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface JabatanKerjaData {
  lsp_id_klasifikasi: string
  klasifikasi: string
  klasifikasi_en: string
  lsp_sub_klasifikasi_id: string
  subklasifikasi: string
  subklasifikasi_en: string
  lsp_kualifikasi_id: string
  kualifikasi: string
  kualifikasi_en: string
  id_jabker: string
  id_jabatan_kerja: string
  jabatan_kerja: string
  work_position: string
  jenjang_id: string
  ACUAN: string
  KETERANGAN: string
  Status: string
}

async function main() {
  console.log('🌱 Seeding JabatanKerja...')

  // Read JSON file
  const jsonPath = path.join(process.cwd(), 'data-jabatan-kerja.json')
  const fileContent = fs.readFileSync(jsonPath, 'utf-8')
  const jsonData = JSON.parse(fileContent)

  if (!jsonData.data || !Array.isArray(jsonData.data)) {
    console.error('❌ Invalid JSON structure')
    return
  }

  const jabatanKerjaData: JabatanKerjaData[] = jsonData.data
  console.log(`📊 Found ${jabatanKerjaData.length} items`)

  // Clear existing data
  await prisma.jabatanKerja.deleteMany({})
  console.log('🗑️  Cleared existing data')

  // Insert data in batches
  const batchSize = 100
  let inserted = 0

  for (let i = 0; i < jabatanKerjaData.length; i += batchSize) {
    const batch = jabatanKerjaData.slice(i, i + batchSize)

    await prisma.jabatanKerja.createMany({
      data: batch.map(item => ({
        lspIdKlasifikasi: item.lsp_id_klasifikasi || '',
        klasifikasi: item.klasifikasi || '',
        klasifikasiEn: item.klasifikasi_en || null,
        lspSubKlasifikasiId: item.lsp_sub_klasifikasi_id || '',
        subklasifikasi: item.subklasifikasi || '',
        subklasifikasiEn: item.subklasifikasi_en || null,
        lspKualifikasiId: item.lsp_kualifikasi_id || '',
        kualifikasi: item.kualifikasi || '',
        kualifikasiEn: item.kualifikasi_en || null,
        idJabker: item.id_jabker || '',
        idJabatanKerja: item.id_jabatan_kerja || '',
        jabatanKerja: item.jabatan_kerja || '',
        workPosition: item.work_position || null,
        jenjangId: item.jenjang_id || '',
        acuan: item.ACUAN || null,
        keterangan: item.KETERANGAN || null,
        status: item.Status || null,
      })),
      skipDuplicates: true,
    })

    inserted += batch.length
    console.log(`✅ Inserted ${inserted}/${jabatanKerjaData.length} items`)
  }

  // Get unique subklasifikasi for info
  const uniqueSubklasifikasi = await prisma.jabatanKerja.findMany({
    distinct: ['subklasifikasi'],
    select: { subklasifikasi: true },
    orderBy: { subklasifikasi: 'asc' },
  })

  console.log(`\n📈 Summary:`)
  console.log(`   - Total items: ${inserted}`)
  console.log(`   - Unique subklasifikasi: ${uniqueSubklasifikasi.length}`)
  console.log(`   - Jenjang range: 1-9`)
  console.log('\n✨ Done!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
