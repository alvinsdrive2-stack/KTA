import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

// Token dari API SIKI
const SIKI_TOKEN = 'f3332337ac671c33262198340c2f7b579f7843775ecc425107f086956cbb2b1a9e96b0cc6f643d24'
const SIKI_API_URL = 'https://siki.pu.go.id/siki-api/v2/jabatan-kerja'

interface SIKIJabatanKerjaItem {
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

interface SIKIResponse {
  data?: SIKIJabatanKerjaItem[]
  success?: boolean
  message?: string
}

async function main() {
  console.log('🔄 Fetching data from SIKI API...')

  try {
    // Fetch data dari API SIKI
    const response = await fetch(SIKI_API_URL, {
      headers: {
        'token': SIKI_TOKEN,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`❌ Failed to fetch data: ${response.status} ${response.statusText}`)
      return
    }

    const jsonData: SIKIResponse = await response.json()

    if (!jsonData.data || !Array.isArray(jsonData.data)) {
      console.error('❌ Invalid response structure from SIKI API')
      console.log('Response:', JSON.stringify(jsonData, null, 2).substring(0, 500))
      return
    }

    console.log(`📊 Found ${jsonData.data.length} items from SIKI API`)

    // Save to JSON file for backup
    const jsonPath = 'data-jabatan-kerja.json'
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2))
    console.log(`💾 Saved data to ${jsonPath}`)

    // Check if table is empty
    const existingCount = await prisma.jabatanKerja.count()
    if (existingCount > 0) {
      console.log(`⚠️  Table has ${existingCount} existing rows. Please truncate first using: npm run db:truncate-jabatan-kerja`)
      return
    }

    console.log('✅ Table is empty, ready to insert data...')

    // Insert data in batches
    const batchSize = 100
    let inserted = 0

    for (let i = 0; i < jsonData.data.length; i += batchSize) {
      const batch = jsonData.data.slice(i, i + batchSize)

      await prisma.jabatanKerja.createMany({
        data: batch.map(item => ({
          lspIdKlasifikasi: String(item.lsp_id_klasifikasi || ''),
          klasifikasi: item.klasifikasi || '',
          klasifikasiEn: item.klasifikasi_en || null,
          lspSubKlasifikasiId: String(item.lsp_sub_klasifikasi_id || ''),
          subklasifikasi: item.subklasifikasi || '',
          subklasifikasiEn: item.subklasifikasi_en || null,
          lspKualifikasiId: String(item.lsp_kualifikasi_id || ''),
          kualifikasi: item.kualifikasi || '',
          kualifikasiEn: item.kualifikasi_en || null,
          idJabker: String(item.id_jabker || ''),
          idJabatanKerja: String(item.id_jabatan_kerja || ''),
          jabatanKerja: item.jabatan_kerja || '',
          workPosition: item.work_position || null,
          jenjangId: String(item.jenjang_id || ''),
          acuan: item.ACUAN || null,
          keterangan: item.KETERANGAN || null,
          status: item.Status || null,
        })),
        skipDuplicates: true,
      })

      inserted += batch.length
      console.log(`✅ Inserted ${inserted}/${jsonData.data.length} items`)
    }

    // Get summary stats
    const uniqueSubklasifikasi = await prisma.jabatanKerja.findMany({
      distinct: ['subklasifikasi'],
      select: { subklasifikasi: true },
      orderBy: { subklasifikasi: 'asc' },
    })

    const jenjangStats = await prisma.jabatanKerja.groupBy({
      by: ['jenjangId'],
      _count: {
        jenjangId: true,
      },
      orderBy: {
        jenjangId: 'asc',
      },
    })

    console.log(`\n📈 Summary:`)
    console.log(`   - Total items: ${inserted}`)
    console.log(`   - Unique subklasifikasi: ${uniqueSubklasifikasi.length}`)
    console.log(`   - Jenjang stats:`)
    jenjangStats.forEach(stat => {
      console.log(`     * Jenjang ${stat.jenjangId}: ${stat._count.jenjangId} items`)
    })
    console.log('\n✨ Done!')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
