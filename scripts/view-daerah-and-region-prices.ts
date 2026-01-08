import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(80))
  console.log('🔍 PULLING DATA FROM DATABASE')
  console.log('='.repeat(80))
  console.log()

  // 1. Get all Daerah
  console.log('📊 TABLE: DAERAH')
  console.log('-'.repeat(80))
  const daerahList = await prisma.daerah.findMany({
    include: {
      regionPrices: true,
    },
    orderBy: {
      kodeDaerah: 'asc',
    },
  })

  console.log(`Total records: ${daerahList.length}\n`)

  if (daerahList.length === 0) {
    console.log('  ⚠️  No records found!\n')
  } else {
    daerahList.forEach((d, index) => {
      console.log(`${index + 1}. Daerah Record:`)
      console.log(`   ID (cuid):       ${d.id}`)
      console.log(`   Kode Daerah:    ${d.kodeDaerah}`)
      console.log(`   Nama Daerah:    ${d.namaDaerah}`)
      console.log(`   Alamat:          ${d.alamat || 'NULL'}`)
      console.log(`   Telepon:         ${d.telepon || 'NULL'}`)
      console.log(`   Email:           ${d.email || 'NULL'}`)
      console.log(`   isActive:        ${d.isActive}`)
      console.log(`   Kode Propinsi:   ${d.kodePropinsi || 'NULL'}`)
      console.log(`   Diskon:          ${d.diskonPersen}%`)
      console.log(`   Created At:      ${d.createdAt.toISOString()}`)
      console.log(`   RegionPrices:    ${d.regionPrices.length} records`)

      if (d.regionPrices.length > 0) {
        console.log(`   └─ RegionPrice IDs:`)
        d.regionPrices.forEach(rp => {
          console.log(`      - ${rp.id} (tahun: ${rp.tahun}, harga: ${rp.hargaKta})`)
        })
      }
      console.log()
    })
  }

  // 2. Get all RegionPrice
  console.log()
  console.log('📊 TABLE: REGION_PRICE')
  console.log('-'.repeat(80))
  const regionPrices = await prisma.regionPrice.findMany({
    include: {
      daerah: true,
    },
    orderBy: [
      { tahun: 'desc' },
      { daerahId: 'asc' },
    ],
  })

  console.log(`Total records: ${regionPrices.length}\n`)

  // Group by daerahId for better readability
  const groupedByDaerah = new Map<string, typeof regionPrices>()
  regionPrices.forEach(rp => {
    if (!groupedByDaerah.has(rp.daerahId)) {
      groupedByDaerah.set(rp.daerahId, [])
    }
    groupedByDaerah.get(rp.daerahId)!.push(rp)
  })

  console.log(`Unique daerahId: ${groupedByDaerah.size}\n`)

  let index = 1
  for (const [daerahId, prices] of groupedByDaerah) {
    console.log(`${index}. daerahId: ${daerahId}`)
    console.log(`   Daerah exists: ${prices[0].daerah ? '✅ YES' : '❌ NO'}`)
    if (prices[0].daerah) {
      console.log(`   └─ Daerah info: ${prices[0].daerah.namaDaerah} (${prices[0].daerah.kodeDaerah})`)
    }

    console.log(`   RegionPrice records (${prices.length}):`)
    prices.forEach(rp => {
      console.log(`      - ID: ${rp.id}`)
      console.log(`        Tahun: ${rp.tahun}`)
      console.log(`        Harga: Rp ${rp.hargaKta.toLocaleString('id-ID')}`)
      console.log(`        isActive: ${rp.isActive}`)
      console.log(`        Created: ${rp.createdAt.toISOString()}`)
    })
    console.log()
    index++
  }

  // 3. Analysis
  console.log()
  console.log('='.repeat(80))
  console.log('📊 ANALYSIS')
  console.log('='.repeat(80))
  console.log()

  const daerahIdsInPrices = new Set(regionPrices.map(rp => rp.daerahId))
  const existingDaerahIds = new Set(daerahList.map(d => d.id))

  const missingDaerah = [...daerahIdsInPrices].filter(id => !existingDaerahIds.has(id))

  console.log(`Total Daerah records:        ${daerahList.length}`)
  console.log(`Total RegionPrice records:     ${regionPrices.length}`)
  console.log(`Unique daerahId in RegionPrice: ${daerahIdsInPrices.size}`)
  console.log(`Daerah IDs NOT in Daerah table: ${missingDaerah.length}\n`)

  if (missingDaerah.length > 0) {
    console.log('❌ Missing Daerah (need to be created):')
    missingDaerah.forEach(id => {
      const count = regionPrices.filter(rp => rp.daerahId === id).length
      console.log(`  - ${id} (${count} RegionPrice records)`)
    })
  } else {
    console.log('✅ All daerahId from RegionPrice exist in Daerah table!')
  }

  console.log()
  console.log('='.repeat(80))
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
