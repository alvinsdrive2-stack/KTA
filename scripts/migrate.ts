/**
 * Jalanin migrasi SQL di `prisma/*.sql` ke database MySQL.
 *
 * Kenapa ada runner, nggak cukup `mysql < file.sql`:
 *   - MySQL nggak punya `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
 *     (itu cuma ada di MariaDB), jadi file .sql di folder prisma isinya DDL polos.
 *     Yang ngurus "ini udah pernah jalan apa belum" itu runner ini.
 *   - `npm run db:migrate` jalan tanpa perlu install mysql-client di server.
 *
 * Aman diulang: perintah yang gagal karena objeknya udah ada dihitung skip, bukan
 * error. Yang bikin script berhenti cuma kegagalan beneran.
 *
 * Pakai:
 *   npm run db:migrate             jalanin semua
 *   npm run db:migrate -- --dry    cuma tampilin mau ngapain
 */
import { PrismaClient } from '@prisma/client'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

/**
 * Urutan migrasi. Sengaja eksplisit, bukan `readdir` — urutan alfabetis kebetulan
 * bener hari ini, tapi begitu ada migrasi baru yang butuh tabel dari migrasi lain,
 * urutan otomatis bakal salah tanpa kelihatan.
 */
const MIGRATIONS = [
  'add_must_change_password.sql',
  'add_invoice_price_snapshot.sql',
  'add_password_reset_token.sql',
]

/**
 * Kode error MySQL yang artinya "objeknya udah ada" — bukan gagal:
 *   1050 tabel udah ada
 *   1060 kolom udah ada
 *   1061 index udah ada
 *   1091 nggak bisa drop, objeknya nggak ada
 *   1826 nama constraint foreign key udah dipakai
 */
const SUDAH_ADA = new Set([1050, 1060, 1061, 1091, 1826])

/**
 * Ambil kode error MySQL dari error Prisma.
 *
 * Bentuknya beda-beda tergantung versi Prisma dan jenis query: kadang di
 * `meta.code` sebagai string ('1060'), kadang `errno` numerik, kadang cuma
 * nyempil di teks pesan. Dicek semua biar nggak salah nebak.
 */
function kodeMysql(error: unknown): number | null {
  const e = error as { meta?: { code?: unknown }; errno?: unknown; message?: unknown }
  const meta = e?.meta?.code
  if (typeof meta === 'number') return meta
  if (typeof meta === 'string' && /^\d+$/.test(meta)) return parseInt(meta, 10)
  if (typeof e?.errno === 'number') return e.errno
  const cocok = String(e?.message ?? '').match(/\b(1[0-9]{3}|2[0-9]{3})\b/)
  return cocok ? parseInt(cocok[1], 10) : null
}

/**
 * Pecah isi file .sql jadi per-perintah.
 *
 * Cuma bisa diandelin buat file di folder `prisma/`: komentarnya `--` di awal
 * baris, dan nggak ada titik-koma di dalam string. Kalau nanti nambah migrasi
 * yang nulis string berisi `;`, pemecah ini bakal salah — waktu itu baru diganti.
 */
function pecahPerintah(sql: string): string[] {
  return sql
    .split('\n')
    .filter((baris) => !baris.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Satu baris pertama perintah, dipotong — buat ditampilin di log. */
function ringkas(sql: string): string {
  const baris = sql.split('\n').map((b) => b.trim()).filter(Boolean).join(' ')
  return baris.length > 76 ? `${baris.slice(0, 73)}...` : baris
}

type Hasil = { dijalankan: number; dilewati: number }

async function jalaninFile(nama: string, dry: boolean): Promise<Hasil> {
  const path = join(process.cwd(), 'prisma', nama)

  console.log(`\n▸ ${nama}`)

  if (!existsSync(path)) {
    console.log('  ! file nggak ketemu — dilewati')
    return { dijalankan: 0, dilewati: 0 }
  }

  const perintah = pecahPerintah(readFileSync(path, 'utf8'))
  console.log(`  ${perintah.length} perintah ditemukan`)

  let dijalankan = 0
  let dilewati = 0

  for (const sql of perintah) {
    if (dry) {
      console.log(`  · ${ringkas(sql)}`)
      continue
    }

    try {
      await prisma.$executeRawUnsafe(sql)
      dijalankan++
      console.log(`  ✓ ${ringkas(sql)}`)
    } catch (error) {
      const kode = kodeMysql(error)

      if (kode !== null && SUDAH_ADA.has(kode)) {
        dilewati++
        console.log(`  - ${ringkas(sql)}  (udah ada, kode ${kode})`)
        continue
      }

      console.error(`\n  ✗ GAGAL`)
      console.error(`    perintah : ${ringkas(sql)}`)
      console.error(`    kode     : ${kode ?? 'nggak kebaca'}`)
      console.error(
        `    pesan    : ${(error as Error).message.split('\n').slice(0, 5).join('\n               ')}`
      )
      throw error
    }
  }

  return { dijalankan, dilewati }
}

/**
 * Yang harus ada di database setelah migrasi jalan. Dicek dengan query ke
 * information_schema — jadi ini beneran baca kondisi database, bukan nyimpulin
 * dari "tadi nggak ada error".
 */
const HARUS_ADA: Array<{ label: string; sql: string }> = [
  {
    label: 'users.mustChangePassword',
    sql: "SELECT COUNT(*) AS ada FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'mustChangePassword'",
  },
  {
    label: 'bulk_payments.totalHargaBase',
    sql: "SELECT COUNT(*) AS ada FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bulk_payments' AND COLUMN_NAME = 'totalHargaBase'",
  },
  {
    label: 'bulk_payments.diskonPersen',
    sql: "SELECT COUNT(*) AS ada FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bulk_payments' AND COLUMN_NAME = 'diskonPersen'",
  },
  {
    label: 'payments.hargaBaseSnapshot',
    sql: "SELECT COUNT(*) AS ada FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'hargaBaseSnapshot'",
  },
  {
    label: 'tabel password_reset_tokens',
    sql: "SELECT COUNT(*) AS ada FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_reset_tokens'",
  },
  {
    label: 'FK password_reset_tokens -> users',
    sql: "SELECT COUNT(*) AS ada FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'password_reset_tokens' AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
  },
]

async function verifikasi(): Promise<boolean> {
  console.log('\n▸ Verifikasi')

  let semuaAda = true

  for (const { label, sql } of HARUS_ADA) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ ada: bigint | number }>>(sql)
      const ada = Number(rows[0]?.ada ?? 0) > 0
      console.log(`  ${ada ? '✓' : '✗'} ${label}`)
      if (!ada) semuaAda = false
    } catch (error) {
      console.log(`  ✗ ${label} — query gagal: ${(error as Error).message.split('\n')[0]}`)
      semuaAda = false
    }
  }

  return semuaAda
}

async function main() {
  const dry = process.argv.includes('--dry')

  console.log(`\nMigrasi database — ${dry ? 'DRY RUN (nggak nulis apa-apa)' : 'JALAN'}`)

  let dijalankan = 0
  let dilewati = 0

  for (const nama of MIGRATIONS) {
    const hasil = await jalaninFile(nama, dry)
    dijalankan += hasil.dijalankan
    dilewati += hasil.dilewati
  }

  console.log(`\n▸ Ringkasan`)
  console.log(`  dijalankan : ${dijalankan}`)
  console.log(`  dilewati   : ${dilewati}`)

  if (dry) {
    console.log('\nDRY RUN — nggak ada yang berubah. Jalanin tanpa --dry buat beneran.\n')
    return
  }

  const lengkap = await verifikasi()

  if (!lengkap) {
    console.error('\n✗ Ada yang belum ada di database. Cek pesan error di atas.\n')
    process.exitCode = 1
    return
  }

  console.log('\n✓ Selesai. Semua kolom dan tabel yang dibutuhin udah ada.\n')
}

main()
  .catch((error) => {
    console.error('\n✗ Migrasi berhenti karena error di atas.\n')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
