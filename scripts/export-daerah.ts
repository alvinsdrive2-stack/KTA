import { prisma } from '../lib/prisma'

async function main() {
  const daerahList = await prisma.daerah.findMany({
    select: {
      id: true,
      namaDaerah: true,
      kodeDaerah: true,
      kodePropinsi: true,
    },
    orderBy: [
      { kodePropinsi: 'asc' },
      { namaDaerah: 'asc' }
    ]
  })

  console.log('DAERAH LIST:')
  console.log('No\tKodeProp\tNamaDaerah\t\tKodeDaerah')
  console.log('=' .repeat(80))

  daerahList.forEach((d, i) => {
    console.log(`${i + 1}\t${d.kodePropinsi}\t${d.namaDaerah}\t${d.kodeDaerah}`)
  })

  console.log('\n\nJSON FORMAT:')
  console.log(JSON.stringify(daerahList, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
