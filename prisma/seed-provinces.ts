import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Complete province data from API
const provinces = [
  { ID_Propinsi: "00", id_propinsi_dagri: "00", Nama: "Nasional" },
  { ID_Propinsi: "01", id_propinsi_dagri: "11", Nama: "Aceh" },
  { ID_Propinsi: "02", id_propinsi_dagri: "12", Nama: "Sumatera Utara" },
  { ID_Propinsi: "03", id_propinsi_dagri: "13", Nama: "Sumatera Barat" },
  { ID_Propinsi: "04", id_propinsi_dagri: "14", Nama: "Riau" },
  { ID_Propinsi: "05", id_propinsi_dagri: "15", Nama: "Jambi" },
  { ID_Propinsi: "06", id_propinsi_dagri: "16", Nama: "Sumatera Selatan" },
  { ID_Propinsi: "07", id_propinsi_dagri: "17", Nama: "Bengkulu" },
  { ID_Propinsi: "08", id_propinsi_dagri: "18", Nama: "Lampung" },
  { ID_Propinsi: "09", id_propinsi_dagri: "31", Nama: "DKI Jakarta" },
  { ID_Propinsi: "10", id_propinsi_dagri: "32", Nama: "Jawa Barat" },
  { ID_Propinsi: "11", id_propinsi_dagri: "33", Nama: "Jawa Tengah" },
  { ID_Propinsi: "12", id_propinsi_dagri: "34", Nama: "DI Yogyakarta" },
  { ID_Propinsi: "13", id_propinsi_dagri: "35", Nama: "Jawa Timur" },
  { ID_Propinsi: "14", id_propinsi_dagri: "61", Nama: "Kalimantan Barat" },
  { ID_Propinsi: "15", id_propinsi_dagri: "62", Nama: "Kalimantan Tengah" },
  { ID_Propinsi: "16", id_propinsi_dagri: "63", Nama: "Kalimantan Selatan" },
  { ID_Propinsi: "17", id_propinsi_dagri: "64", Nama: "Kalimantan Timur" },
  { ID_Propinsi: "18", id_propinsi_dagri: "71", Nama: "Sulawesi Utara" },
  { ID_Propinsi: "19", id_propinsi_dagri: "72", Nama: "Sulawesi Tengah" },
  { ID_Propinsi: "20", id_propinsi_dagri: "73", Nama: "Sulawesi Selatan" },
  { ID_Propinsi: "21", id_propinsi_dagri: "74", Nama: "Sulawesi Tenggara" },
  { ID_Propinsi: "22", id_propinsi_dagri: "51", Nama: "Bali" },
  { ID_Propinsi: "23", id_propinsi_dagri: "52", Nama: "Nusa Tenggara Barat" },
  { ID_Propinsi: "24", id_propinsi_dagri: "53", Nama: "Nusa Tenggara Timur" },
  { ID_Propinsi: "25", id_propinsi_dagri: "81", Nama: "Maluku" },
  { ID_Propinsi: "26", id_propinsi_dagri: "91", Nama: "Papua" },
  { ID_Propinsi: "27", id_propinsi_dagri: "82", Nama: "Maluku Utara" },
  { ID_Propinsi: "28", id_propinsi_dagri: "36", Nama: "Banten" },
  { ID_Propinsi: "29", id_propinsi_dagri: "75", Nama: "Gorontalo" },
  { ID_Propinsi: "30", id_propinsi_dagri: "19", Nama: "Kepulauan Bangka Belitung" },
  { ID_Propinsi: "31", id_propinsi_dagri: "21", Nama: "Kepulauan Riau" },
  { ID_Propinsi: "32", id_propinsi_dagri: "92", Nama: "Papua Barat" },
  { ID_Propinsi: "33", id_propinsi_dagri: "76", Nama: "Sulawesi Barat" },
  { ID_Propinsi: "34", id_propinsi_dagri: "65", Nama: "Kalimantan Utara" },
  { ID_Propinsi: "93", id_propinsi_dagri: "93", Nama: "Papua Selatan" },
  { ID_Propinsi: "94", id_propinsi_dagri: "94", Nama: "Papua Tengah" },
  { ID_Propinsi: "95", id_propinsi_dagri: "95", Nama: "Papua Pegunungan" },
  { ID_Propinsi: "96", id_propinsi_dagri: "96", Nama: "Papua Barat Daya" },
  { ID_Propinsi: "99", id_propinsi_dagri: "99", Nama: "Luar Negeri" }
]

async function main() {
  console.log('🌱 Starting province seeding...')

  // Create/update each province as daerah
  for (const province of provinces) {
    try {
      await prisma.daerah.upsert({
        where: {
          kodeDaerah: province.id_propinsi_dagri
        },
        update: {
          namaDaerah: province.Nama,
          kodePropinsi: province.id_propinsi_dagri,
          isActive: true
        },
        create: {
          namaDaerah: province.Nama,
          kodeDaerah: province.id_propinsi_dagri,
          kodePropinsi: province.id_propinsi_dagri,
          isActive: true
        }
      })

      console.log(`✅ Processed: ${province.Nama} (${province.id_propinsi_dagri})`)
    } catch (error) {
      console.error(`❌ Error processing ${province.Nama}:`, error)
    }
  }

  console.log('\n🎉 Province seeding completed!')

  // Display summary
  const totalDaerah = await prisma.daerah.count()
  const activeDaerah = await prisma.daerah.count({
    where: { isActive: true }
  })

  console.log(`\n📊 Summary:`)
  console.log(`   Total daerah: ${totalDaerah}`)
  console.log(`   Active daerah: ${activeDaerah}`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })