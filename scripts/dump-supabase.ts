import pg from 'pg'
import fs from 'fs'
import path from 'path'

const { Client } = pg

// Supabase connection
const supabaseConfig = {
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.qwpkgobfxoehjazvaeyj',
  password: 'mpbKCeunSN5zuzyR',
}

const OUTPUT_DIR = path.join(process.cwd(), 'supabase-dump')

// Tabel-tabel yang mau di-dump
const TABLES = [
  'users',
  'sessions',
  'daerah',
  'region_prices',
  'subklasifikasi',
  'kta_requests',
  'kta_documents',
  'payments',
  'bulk_payments',
  'approvals',
  'qr_scans',
  'jabatan_kerja',
]

async function dumpTable(client: pg.Client, tableName: string) {
  console.log(`Dumping ${tableName}...`)

  // Query semua data dari tabel
  const result = await client.query(`SELECT * FROM "${tableName}"`)

  // Simpan ke JSON
  const filePath = path.join(OUTPUT_DIR, `${tableName}.json`)
  fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2))

  console.log(`  -> ${result.rows.length} rows saved to ${tableName}.json`)

  return result.rows.length
}

async function main() {
  console.log('Connecting to Supabase...')

  const client = new Client(supabaseConfig)
  await client.connect()

  // Buat folder output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  let totalRows = 0

  for (const table of TABLES) {
    try {
      const count = await dumpTable(client, table)
      totalRows += count
    } catch (error: any) {
      console.error(`  ERROR: ${error.message}`)
    }
  }

  await client.end()

  console.log(`\nDone! ${totalRows} total rows dumped to ${OUTPUT_DIR}`)
  console.log('\nFiles created:')
  TABLES.forEach(t => console.log(`  - supabase-dump/${t}.json`))
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
