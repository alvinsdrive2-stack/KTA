import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_KTA_PRICE = 150000 // Rp 150.000

async function seedRegionPrices() {
  console.log('Seeding region prices...')

  // Get all daerah
  const daerahList = await prisma.daerah.findMany({
    select: {
      id: true,
      namaDaerah: true,
      kodeDaerah: true
    }
  })

  const currentYear = new Date().getFullYear()

  for (const daerah of daerahList) {
    // Check if price already exists for current year
    const existingPrice = await prisma.regionPrice.findFirst({
      where: {
        daerahId: daerah.id,
        tahun: currentYear
      }
    })

    if (!existingPrice) {
      await prisma.regionPrice.create({
        data: {
          daerahId: daerah.id,
          hargaKta: DEFAULT_KTA_PRICE,
          tahun: currentYear,
          isActive: true
        }
      })
      console.log(`Created price for ${daerah.namaDaerah} (${daerah.kodeDaerah}): Rp ${DEFAULT_KTA_PRICE.toLocaleString('id-ID')}`)
    } else {
      console.log(`Price already exists for ${daerah.namaDaerah} (${daerah.kodeDaerah})`)
    }
  }

  console.log('Region prices seeding completed!')
}

seedRegionPrices()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })