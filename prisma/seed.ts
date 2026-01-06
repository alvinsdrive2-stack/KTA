import { PrismaClient, UserRole, KTAStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Subklasifikasi data from SIKI
const SUBKLASIFIKASI_DATA = [
  { id_klasifikasi: 'AR', id_subklasifikasi: '01', kode_subklasifikasi: 'AR01', subklasifikasi: 'Arsitektural' },
  { id_klasifikasi: 'AR', id_subklasifikasi: '02', kode_subklasifikasi: 'AR02', subklasifikasi: 'Perencanaan Arsitektural' },
  { id_klasifikasi: 'AR', id_subklasifikasi: '03', kode_subklasifikasi: 'AR03', subklasifikasi: 'Pengawasan Arsitektural' },
  { id_klasifikasi: 'SI', id_subklasifikasi: '01', kode_subklasifikasi: 'SI01', subklasifikasi: 'Gedung' },
  { id_klasifikasi: 'SI', id_subklasifikasi: '02', kode_subklasifikasi: 'SI02', subklasifikasi: 'Jalan dan Jembatan' },
  { id_klasifikasi: 'SI', id_subklasifikasi: '03', kode_subklasifikasi: 'SI03', subklasifikasi: 'Sipil' },
  { id_klasifikasi: 'SI', id_subklasifikasi: '04', kode_subklasifikasi: 'SI04', subklasifikasi: 'Mekanikal' },
  { id_klasifikasi: 'SI', id_subklasifikasi: '05', kode_subklasifikasi: 'SI05', subklasifikasi: 'Elektrikal' },
  { id_klasifikasi: 'EL', id_subklasifikasi: '01', kode_subklasifikasi: 'EL01', subklasifikasi: 'Instalasi Penerangan' },
  { id_klasifikasi: 'EL', id_subklasifikasi: '02', kode_subklasifikasi: 'EL02', subklasifikasi: 'Instalasi Tenaga Listrik' },
  { id_klasifikasi: 'EL', id_subklasifikasi: '03', kode_subklasifikasi: 'EL03', subklasifikasi: 'Instalasi Tegangan Menengah' },
  { id_klasifikasi: 'EL', id_subklasifikasi: '04', kode_subklasifikasi: 'EL04', subklasifikasi: 'Instalasi Tegangan Tinggi' },
  { id_klasifikasi: 'ME', id_subklasifikasi: '01', kode_subklasifikasi: 'ME01', subklasifikasi: 'Mesin Umum' },
  { id_klasifikasi: 'ME', id_subklasifikasi: '02', kode_subklasifikasi: 'ME02', subklasifikasi: 'Pendingin Udara' },
  { id_klasifikasi: 'ME', id_subklasifikasi: '03', kode_subklasifikasi: 'ME03', subklasifikasi: 'Plumbing' },
  { id_klasifikasi: 'ME', id_subklasifikasi: '04', kode_subklasifikasi: 'ME04', subklasifikasi: 'Proteksi Kebakaran' },
  { id_klasifikasi: 'GE', id_subklasifikasi: '01', kode_subklasifikasi: 'GE01', subklasifikasi: 'Tanah' },
  { id_klasifikasi: 'GE', id_subklasifikasi: '02', kode_subklasifikasi: 'GE02', subklasifikasi: 'Batu Galian' },
  { id_klasifikasi: 'GE', id_subklasifikasi: '03', kode_subklasifikasi: 'GE03', subklasifikasi: 'Geoteknik' },
  { id_klasifikasi: 'KA', id_subklasifikasi: '01', kode_subklasifikasi: 'KA01', subklasifikasi: 'Jalan Raya' },
  { id_klasifikasi: 'KA', id_subklasifikasi: '02', kode_subklasifikasi: 'KA02', subklasifikasi: 'Jalan Tol' },
  { id_klasifikasi: 'KA', id_subklasifikasi: '03', kode_subklasifikasi: 'KA03', subklasifikasi: 'Jembatan' },
  { id_klasifikasi: 'KA', id_subklasifikasi: '04', kode_subklasifikasi: 'KA04', subklasifikasi: 'Jalan Layang' },
  { id_klasifikasi: 'KA', id_subklasifikasi: '05', kode_subklasifikasi: 'KA05', subklasifikasi: 'Terowongan' },
  { id_klasifikasi: 'SB', id_subklasifikasi: '01', kode_subklasifikasi: 'SB01', subklasifikasi: 'Bangunan Air' },
  { id_klasifikasi: 'SB', id_subklasifikasi: '02', kode_subklasifikasi: 'SB02', subklasifikasi: 'Irigasi' },
  { id_klasifikasi: 'SB', id_subklasifikasi: '03', kode_subklasifikasi: 'SB03', subklasifikasi: 'Pantai' },
  { id_klasifikasi: 'SB', id_subklasifikasi: '04', kode_subklasifikasi: 'SB04', subklasifikasi: 'Pelabuhan' },
  { id_klasifikasi: 'CU', id_subklasifikasi: '01', kode_subklasifikasi: 'CU01', subklasifikasi: 'Konstruksi Bangunan' },
  { id_klasifikasi: 'CU', id_subklasifikasi: '02', kode_subklasifikasi: 'CU02', subklasifikasi: 'Konstruksi Interior' },
  { id_klasifikasi: 'CU', id_subklasifikasi: '03', kode_subklasifikasi: 'CU03', subklasifikasi: 'Konstruksi Finishing' },
  { id_klasifikasi: 'CU', id_subklasifikasi: '04', kode_subklasifikasi: 'CU04', subklasifikasi: 'Konstruksi Atap' },
]

async function seedSubklasifikasi() {
  console.log('Seeding Subklasifikasi data...')

  for (const data of SUBKLASIFIKASI_DATA) {
    await prisma.subklasifikasi.upsert({
      where: { kodeSubklasifikasi: data.kode_subklasifikasi },
      update: {},
      create: {
        idKlasifikasi: data.id_klasifikasi,
        idSubklasifikasi: data.id_subklasifikasi,
        kodeSubklasifikasi: data.kode_subklasifikasi,
        subklasifikasi: data.subklasifikasi,
      },
    })
  }

  console.log(`Seeded ${SUBKLASIFIKASI_DATA.length} subklasifikasi records`)
}

async function main() {
  console.log('Start seeding...')

  // Seed Subklasifikasi first
  await seedSubklasifikasi()

  // Create Daerah
  const daerahJakarta = await prisma.daerah.upsert({
    where: { kodeDaerah: 'DKI-01' },
    update: {},
    create: {
      namaDaerah: 'DKI Jakarta',
      kodeDaerah: 'DKI-01',
      alamat: 'Jl. Medan Merdeka No. 1, Jakarta Pusat',
      telepon: '021-123456',
      email: 'jakarta@atk-indonesia.org',
    },
  })

  const daerahSurabaya = await prisma.daerah.upsert({
    where: { kodeDaerah: 'JTM-01' },
    update: {},
    create: {
      namaDaerah: 'Jawa Timur',
      kodeDaerah: 'JTM-01',
      alamat: 'Jl. Ahmad Yani No. 100, Surabaya',
      telepon: '031-123456',
      email: 'jawatimur@atk-indonesia.org',
    },
  })

  // Create Users
  const hashedPassword = await bcrypt.hash('password123', 10)

  const adminPusat = await prisma.user.upsert({
    where: { email: 'admin@pusat.com' },
    update: {},
    create: {
      name: 'Admin Pusat',
      email: 'admin@pusat.com',
      password: hashedPassword,
      role: 'PUSAT',
      isActive: true,
    },
  })

  const adminJakarta = await prisma.user.upsert({
    where: { email: 'jakarta@daerah.com' },
    update: {},
    create: {
      name: 'Admin Jakarta',
      email: 'jakarta@daerah.com',
      password: hashedPassword,
      role: 'DAERAH',
      daerahId: daerahJakarta.id,
      isActive: true,
    },
  })

  const adminSurabaya = await prisma.user.upsert({
    where: { email: 'surabaya@daerah.com' },
    update: {},
    create: {
      name: 'Admin Surabaya',
      email: 'surabaya@daerah.com',
      password: hashedPassword,
      role: 'DAERAH',
      daerahId: daerahSurabaya.id,
      isActive: true,
    },
  })

  // Create Region Prices
  const currentYear = new Date().getFullYear()

  await prisma.regionPrice.upsert({
    where: { daerahId_tahun: { daerahId: daerahJakarta.id, tahun: currentYear } },
    update: {},
    create: {
      daerahId: daerahJakarta.id,
      hargaKta: 150000, // Rp 150.000
      tahun: currentYear,
      isActive: true,
    },
  })

  await prisma.regionPrice.upsert({
    where: { daerahId_tahun: { daerahId: daerahSurabaya.id, tahun: currentYear } },
    update: {},
    create: {
      daerahId: daerahSurabaya.id,
      hargaKta: 125000, // Rp 125.000
      tahun: currentYear,
      isActive: true,
    },
  })

  // Create sample KTA Request (without regionPrice reference for now)
  const sampleKTA = await prisma.kTARequest.create({
    data: {
      idIzin: 'SKK-2024-001',
      daerahId: daerahJakarta.id,
      requestedBy: adminJakarta.id,
      nik: '3201011234560001',
      nama: 'John Doe',
      jabatanKerja: 'Ahli Teknik Bangunan',
      subklasifikasi: 'BG001',
      jenjang: 'Muda',
      noTelp: '08123456789',
      email: 'john.doe@example.com',
      alamat: 'Jl. Sudirman No. 123, Jakarta Pusat',
      tanggalDaftar: new Date('2024-01-15'),
      status: KTAStatus.APPROVED_BY_PUSAT,
      hargaRegion: 150000, // Default price
      pusatApprovedBy: adminPusat.id,
      pusatApprovedAt: new Date(),
      qrCodePath: '/uploads/qr-codes/sample-qr.png',
      kartuGeneratedPath: '/uploads/kta-cards/sample-kta.pdf',
    },
  })

  console.log('Seeding finished.')
  console.log('Created users:')
  console.log('- Admin Pusat: admin@pusat.com / password123')
  console.log('- Admin Jakarta: jakarta@daerah.com / password123')
  console.log('- Admin Surabaya: surabaya@daerah.com / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })