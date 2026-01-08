import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Sync Daerah from RegionPrice\n')

  // 1. Get all existing Daerah IDs
  const existingDaerah = await prisma.daerah.findMany({
    select: {
      id: true,
      kodeDaerah: true,
      namaDaerah: true,
    },
  })

  const existingDaerahMap = new Map(existingDaerah.map(d => [d.id, d]))
  const existingKodeDaerah = new Set(existingDaerah.map(d => d.kodeDaerah))

  console.log(`📊 Existing Daerah: ${existingDaerah.length}`)
  existingDaerah.forEach(d => {
    console.log(`  - ${d.id} (${d.kodeDaerah}): ${d.namaDaerah}`)
  })
  console.log()

  // 2. Get all unique daerahId from RegionPrice
  const regionPrices = await prisma.regionPrice.findMany({
    select: {
      daerahId: true,
      tahun: true,
      hargaKta: true,
      isActive: true,
    },
    orderBy: [{ tahun: 'desc' }, { daerahId: 'asc' }],
  })

  // Group by daerahId to get unique regions with their latest price
  const regionMap = new Map<string, any>()
  regionPrices.forEach(rp => {
    if (!regionMap.has(rp.daerahId)) {
      regionMap.set(rp.daerahId, {
        daerahId: rp.daerahId,
        hargaKta: rp.hargaKta,
        tahun: rp.tahun,
        isActive: rp.isActive,
        count: 1,
      })
    } else {
      const existing = regionMap.get(rp.daerahId)
      existing.count++
      // Keep the latest year's price
      if (rp.tahun > existing.tahun) {
        existing.hargaKta = rp.hargaKta
        existing.tahun = rp.tahun
      }
    }
  })

  const uniqueRegions = Array.from(regionMap.values())
  console.log(`📊 Unique daerahId in RegionPrice: ${uniqueRegions.length}`)

  // 3. Show all regions from RegionPrice
  console.log('\n🌍 Regions in RegionPrice:')
  uniqueRegions.forEach(r => {
    const exists = existingDaerahMap.has(r.daerahId)
    console.log(`  ${exists ? '✅' : '❌'} ${r.daerahId} - Rp ${r.hargaKta.toLocaleString('id-ID')} (${r.tahun}, ${r.count} records)`)
  })

  // 4. Find regions to create (daerahId not in existing Daerah)
  const regionsToCreate = uniqueRegions.filter(r => !existingDaerahMap.has(r.daerahId))

  console.log(`\n${'='.repeat(80)}`)
  console.log(`\n📋 Summary:`)
  console.log(`  - Existing Daerah: ${existingDaerah.length}`)
  console.log(`  - Unique daerahId in RegionPrice: ${uniqueRegions.length}`)
  console.log(`  - Need to create: ${regionsToCreate.length}`)

  if (regionsToCreate.length === 0) {
    console.log('\n✅ All daerahId from RegionPrice already exist in Daerah table!')
    return
  }

  console.log('\n🔧 Daerah records to create:')
  regionsToCreate.forEach(r => {
    console.log(`  - ${r.daerahId}`)
  })

  // 5. CREATE
  console.log(`\n${'='.repeat(80)}`)
  console.log('\n🔧 Creating Daerah records...\n')

  const created = []
  const skipped = []

  for (const region of regionsToCreate) {
    try {
      // Double check if already exists
      const alreadyExists = await prisma.daerah.findUnique({
        where: { id: region.daerahId }
      })

      if (alreadyExists) {
        skipped.push(region.daerahId)
        console.log(`  ⚠️  Skip: ${region.daerahId} (already exists)`)
        continue
      }

      // Check if kodeDaerah already exists
      const proposedKode = region.daerahId.substring(0, 12).toUpperCase()
      if (existingKodeDaerah.has(proposedKode)) {
        console.log(`  ⚠️  Skip: ${region.daerahId} (kodeDaerah '${proposedKode}' already exists)`)
        skipped.push(region.daerahId)
        continue
      }

      const newDaerah = await prisma.daerah.create({
        data: {
          id: region.daerahId,
          kodeDaerah: proposedKode,
          namaDaerah: `Daerah ${proposedKode}`,
          alamat: null,
          telepon: null,
          email: null,
          isActive: region.isActive ?? true,
          kodePropinsi: null,
          diskonPersen: 0,
        },
      })

      created.push(newDaerah)
      console.log(`  ✅ Created: ${newDaerah.kodeDaerah} - ${newDaerah.namaDaerah}`)
    } catch (error: any) {
      if (error.code === 'P2002') {
        skipped.push(region.daerahId)
        console.log(`  ⚠️  Skip: ${region.daerahId} (already exists - duplicate)`)
      } else {
        console.error(`  ❌ Failed: ${region.daerahId} - ${error.message}`)
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`\n✅ Successfully created: ${created.length}`)
  console.log(`⚠️  Skipped: ${skipped.length}`)
  console.log(`📊 Total Daerah now: ${existingDaerah.length + created.length}`)
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
