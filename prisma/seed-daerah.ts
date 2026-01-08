import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Data provinsi Indonesia lengkap
const PROVINSI_INDONESIA = [
  { kode: '00', nama: 'Nasional' },
  { kode: '11', nama: 'Aceh' },
  { kode: '12', nama: 'Sumatera Utara' },
  { kode: '13', nama: 'Sumatera Barat' },
  { kode: '14', nama: 'Riau' },
  { kode: '15', nama: 'Jambi' },
  { kode: '16', nama: 'Sumatera Selatan' },
  { kode: '17', nama: 'Bengkulu' },
  { kode: '18', nama: 'Lampung' },
  { kode: '19', nama: 'Kepulauan Bangka Belitung' },
  { kode: '21', nama: 'Kepulauan Riau' },
  { kode: '31', nama: 'DKI Jakarta' },
  { kode: '32', nama: 'Jawa Barat' },
  { kode: '33', nama: 'Jawa Tengah' },
  { kode: '34', nama: 'DI Yogyakarta' },
  { kode: '35', nama: 'Jawa Timur' },
  { kode: '36', nama: 'Banten' },
  { kode: '51', nama: 'Bali' },
  { kode: '52', nama: 'Nusa Tenggara Barat' },
  { kode: '53', nama: 'Nusa Tenggara Timur' },
  { kode: '61', nama: 'Kalimantan Barat' },
  { kode: '62', nama: 'Kalimantan Tengah' },
  { kode: '63', nama: 'Kalimantan Selatan' },
  { kode: '64', nama: 'Kalimantan Timur' },
  { kode: '65', nama: 'Kalimantan Utara' },
  { kode: '71', nama: 'Sulawesi Utara' },
  { kode: '72', nama: 'Sulawesi Tengah' },
  { kode: '73', nama: 'Sulawesi Selatan' },
  { kode: '74', nama: 'Sulawesi Tenggara' },
  { kode: '75', nama: 'Gorontalo' },
  { kode: '76', nama: 'Sulawesi Barat' },
  { kode: '81', nama: 'Maluku' },
  { kode: '82', nama: 'Maluku Utara' },
  { kode: '91', nama: 'Papua Barat' },
  { kode: '92', nama: 'Papua' },
  { kode: '93', nama: 'Papua Selatan' },
  { kode: '94', nama: 'Papua Tengah' },
  { kode: '95', nama: 'Papua Pegunungan' },
]

async function main() {
  console.log('🌍 Seeding Daerah (Provinsi Indonesia)\n')
  console.log('='.repeat(80))

  // Check current data
  const currentCount = await prisma.daerah.count()
  console.log(`\n📊 Current Daerah count: ${currentCount}`)

  if (currentCount > 0) {
    console.log('\n⚠️  Table is not empty!')
    console.log('Options:')
    console.log('  1. Delete all and reseed (clean)')
    console.log('  2. Keep existing and add missing (append)')
    console.log('  3. Cancel\n')

    // For automation, we'll use append mode
    console.log('Using APPEND mode (adding missing records only)...\n')
  }

  let created = 0
  let skipped = 0
  let updated = 0

  for (const provinsi of PROVINSI_INDONESIA) {
    try {
      // Check if exists
      const existing = await prisma.daerah.findFirst({
        where: {
          kodeDaerah: provinsi.kode,
        },
      })

      if (existing) {
        // Update if nama is different
        if (existing.namaDaerah !== provinsi.nama) {
          await prisma.daerah.update({
            where: { id: existing.id },
            data: {
              namaDaerah: provinsi.nama,
            },
          })
          console.log(`  ✏️  Updated: ${provinsi.kode} - ${provinsi.nama}`)
          updated++
        } else {
          console.log(`  ⏭️  Skipped: ${provinsi.kode} - ${provinsi.nama} (already exists)`)
          skipped++
        }
      } else {
        // Create new
        await prisma.daerah.create({
          data: {
            id: `DAERAH_${provinsi.kode}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            kodeDaerah: provinsi.kode,
            namaDaerah: provinsi.nama,
            alamat: null,
            telepon: null,
            email: null,
            isActive: true,
            kodePropinsi: provinsi.kode,
            diskonPersen: 0,
          },
        })
        console.log(`  ✅ Created: ${provinsi.kode} - ${provinsi.nama}`)
        created++
      }
    } catch (error: any) {
      console.error(`  ❌ Failed: ${provinsi.kode} - ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n📊 Summary:')
  console.log(`  ✅ Created: ${created}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)
  console.log(`  ✏️  Updated: ${updated}`)

  const finalCount = await prisma.daerah.count()
  console.log(`  📊 Total Daerah: ${finalCount}\n`)

  // Display all records
  const allDaerah = await prisma.daerah.findMany({
    orderBy: { kodeDaerah: 'asc' },
  })

  console.log('📋 All Daerah Records:')
  allDaerah.forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.kodeDaerah}: ${d.namaDaerah}`)
  })
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
