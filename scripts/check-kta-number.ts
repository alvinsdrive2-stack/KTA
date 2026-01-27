import { prisma } from '../lib/prisma'

async function checkLatestKTA() {
  const kta = await prisma.kTARequest.findFirst({
    where: {
      nomorKTA: { not: null }
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      nama: true,
      nomorKTA: true,
      jenjang: true,
      status: true,
      updatedAt: true,
      daerah: {
        select: {
          namaDaerah: true,
          kodeDaerah: true
        }
      }
    }
  })

  if (!kta) {
    console.log('⚠️  Belum ada KTA dengan nomorKTA')
    return
  }

  console.log('========================================')
  console.log('KTA Terbaru dengan Nomor:')
  console.log('========================================')
  console.log(`Nama:      ${kta.nama}`)
  console.log(`No KTA:    ${kta.nomorKTA}`)
  console.log(`Jenjang:   ${kta.jenjang}`)
  console.log(`Daerah:    ${kta.daerah.namaDaerah} (${kta.daerah.kodeDaerah})`)
  console.log(`Status:    ${kta.status}`)
  console.log(`Updated:   ${kta.updatedAt.toLocaleString('id-ID')}`)
  console.log('========================================')
}

checkLatestKTA()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
