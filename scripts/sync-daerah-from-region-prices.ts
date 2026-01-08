import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Fetching data from database...\n')

  // 1. Get all Daerah
  const daerahList = await prisma.daerah.findMany({
    include: {
      regionPrices: true,
    },
  })

  console.log(`📊 Total Daerah in database: ${daerahList.length}`)
  console.log('Existing Daerah:')
  daerahList.forEach(d => {
    console.log(`  - ${d.kodeDaerah}: ${d.namaDaerah} (${d.regionPrices.length} region prices)`)
  })

  // 2. Get all RegionPrice
  const regionPrices = await prisma.regionPrice.findMany({
    include: {
      daerah: true,
    },
  })

  console.log(`\n📊 Total RegionPrice records: ${regionPrices.length}`)

  // 3. Check for orphan RegionPrices (no matching Daerah)
  const orphanRegionPrices = regionPrices.filter(rp => !rp.daerah)

  if (orphanRegionPrices.length > 0) {
    console.log(`\n⚠️  Found ${orphanRegionPrices.length} orphan RegionPrice records (no matching Daerah):`)
    orphanRegionPrices.forEach(rp => {
      console.log(`  - ID: ${rp.id}, daerahId: ${rp.daerahId}, harga: ${rp.hargaKta}, tahun: ${rp.tahun}`)
    })
  } else {
    console.log('\n✅ No orphan RegionPrice records found')
  }

  // 4. Get unique years from RegionPrice
  const uniqueYears = [...new Set(regionPrices.map(rp => rp.tahun))].sort((a, b) => b - a)
  console.log(`\n📅 Years in RegionPrice: ${uniqueYears.join(', ')}`)

  // 5. Summary by year
  console.log('\n📊 RegionPrice by year:')
  uniqueYears.forEach(year => {
    const count = regionPrices.filter(rp => rp.tahun === year).length
    const totalHarga = regionPrices
      .filter(rp => rp.tahun === year)
      .reduce((sum, rp) => sum + rp.hargaKta, 0)
    console.log(`  - ${year}: ${count} daerah, total harga: Rp ${totalHarga.toLocaleString('id-ID')}`)
  })

  // 6. Check for missing years
  const currentYear = new Date().getFullYear()
  const missingYears = []
  for (let y = currentYear; y >= currentYear - 5; y--) {
    if (!uniqueYears.includes(y)) {
      missingYears.push(y)
    }
  }

  if (missingYears.length > 0) {
    console.log(`\n⚠️  Missing years (last 5 years): ${missingYears.join(', ')}`)
  }

  console.log('\n' + '='.repeat(80))

  // Option to create missing Daerah for orphan RegionPrices
  if (orphanRegionPrices.length > 0) {
    console.log('\n❓ Do you want to create Daerah entries for orphan RegionPrices?')
    console.log('   Uncomment the code below to enable auto-creation\n')

    // Example code to create missing Daerah entries
    /*
    console.log('\n🔧 Creating missing Daerah entries...')

    const createdDaerah = []
    for (const rp of orphanRegionPrices) {
      // Generate a unique kodeDaerah from the daerahId
      const kodeDaerah = `AUTO-${rp.daerahId.substring(0, 8).toUpperCase()}`

      try {
        const newDaerah = await prisma.daerah.create({
          data: {
            id: rp.daerahId, // Use the existing daerahId
            kodeDaerah: kodeDaerah,
            namaDaerah: `Daerah ${kodeDaerah}`,
            alamat: 'Auto-generated from RegionPrice',
            isActive: true,
          },
        })
        createdDaerah.push(newDaerah)
        console.log(`  ✅ Created: ${kodeDaerah} - ${newDaerah.namaDaerah}`)
      } catch (error) {
        console.error(`  ❌ Failed to create daerah for daerahId ${rp.daerahId}:`, error)
      }
    }

    console.log(`\n✅ Created ${createdDaerah.length} new Daerah entries`)
    */
  }

  console.log('\n✨ Done!')
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
