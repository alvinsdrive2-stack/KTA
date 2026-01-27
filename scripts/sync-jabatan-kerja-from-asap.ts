import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ASAP_API_URL = 'https://asap.lspgatensi.id/api/jabker?versi=188'

interface ASAPJabatanKerjaItem {
  id_jabker?: string
  id_jabatan_kerja?: string
  jabatan_kerja?: string
  work_position?: string
  jenjang_id?: string
  klasifikasi?: string
  subklasifikasi?: string
  kualifikasi?: string
  // Add other fields as needed based on actual API response
}

interface ASAPResponse {
  data?: ASAPJabatanKerjaItem[]
  status?: string
  message?: string
}

async function main() {
  console.log('🔄 Step 1: Truncating jabatan_kerja table...')

  try {
    // Truncate table
    await prisma.jabatanKerja.deleteMany({})
    console.log('✅ Table truncated successfully')
  } catch (error) {
    console.error('❌ Failed to truncate table:', error)
    throw error
  }

  console.log('\n🔄 Step 2: Fetching data from ASAP API...')

  try {
    // Fetch data dari API ASAP
    const response = await fetch(ASAP_API_URL, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`❌ Failed to fetch data: ${response.status} ${response.statusText}`)
      return
    }

    const jsonData: ASAPResponse = await response.json()

    if (!jsonData.data || !Array.isArray(jsonData.data)) {
      console.error('❌ Invalid response structure from ASAP API')
      console.log('Response:', JSON.stringify(jsonData, null, 2).substring(0, 1000))
      return
    }

    console.log(`📊 Found ${jsonData.data.length} items from ASAP API`)

    // Log sample data for debugging
    console.log('\n📝 Sample data (first item):')
    console.log(JSON.stringify(jsonData.data[0], null, 2))

    // Insert data in batches
    const batchSize = 100
    let inserted = 0

    for (let i = 0; i < jsonData.data.length; i += batchSize) {
      const batch = jsonData.data.slice(i, i + batchSize)

      await prisma.jabatanKerja.createMany({
        data: batch.map(item => ({
          idJabker: String(item.id_jabker || ''),
          idJabatanKerja: String(item.id_jabatan_kerja || ''),
          jabatanKerja: item.jabatan_kerja || '',
          workPosition: item.work_position || null,
          jenjangId: String(item.jenjang_id || ''),
          klasifikasi: item.klasifikasi || '',
          subklasifikasi: item.subklasifikasi || '',
          kualifikasi: item.kualifikasi || '',
          // Set other fields to null/empty as needed
          lspIdKlasifikasi: '',
          klasifikasiEn: null,
          lspSubKlasifikasiId: '',
          subklasifikasiEn: null,
          lspKualifikasiId: '',
          kualifikasiEn: null,
          acuan: null,
          keterangan: null,
          status: null,
        })),
        skipDuplicates: true,
      })

      inserted += batch.length
      console.log(`✅ Inserted ${inserted}/${jsonData.data.length} items`)
    }

    // Get summary stats
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
