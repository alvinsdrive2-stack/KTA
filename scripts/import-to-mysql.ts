import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const DUMP_DIR = path.join(process.cwd(), 'supabase-dump')

// Urutan import penting karena foreign key
const TABLES_ORDER = [
  { name: 'daerah', model: 'daerah' },
  { name: 'users', model: 'user' },
  { name: 'region_prices', model: 'regionPrice' },
  { name: 'subklasifikasi', model: 'subklasifikasi' },
  { name: 'jabatan_kerja', model: 'jabatanKerja' },
  { name: 'kta_requests', model: 'kTARequest' },
  { name: 'kta_documents', model: 'kTADocument' },
  { name: 'payments', model: 'payment' },
  { name: 'bulk_payments', model: 'bulkPayment' },
  { name: 'approvals', model: 'approval' },
  { name: 'sessions', model: 'session' },
  { name: 'qr_scans', model: 'qRScan' },
]

// Convert snake_case to camelCase untuk Prisma
function toCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  }

  const newObj: any = {}
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    newObj[camelKey] = toCamelCase(obj[key])
  }
  return newObj
}

// Convert Date string to Date object
function convertDates(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(convertDates)
  }

  const newObj: any = {}
  for (const key in obj) {
    const value = obj[key]
    // Cek field yang biasanya DateTime
    if (typeof value === 'string' &&
        (key.includes('At') || key.includes('Date') || key === 'expires') &&
        !isNaN(Date.parse(value))) {
      newObj[key] = new Date(value)
    } else {
      newObj[key] = convertDates(value)
    }
  }
  return newObj
}

async function importTable(tableName: string, modelName: string) {
  console.log(`Importing ${tableName}...`)

  const filePath = path.join(DUMP_DIR, `${tableName}.json`)

  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP: File not found`)
    return 0
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  if (data.length === 0) {
    console.log(`  SKIP: No data`)
    return 0
  }

  let successCount = 0
  let errorCount = 0

  // @ts-ignore - dynamic model access
  const model = prisma[modelName]

  for (const row of data) {
    try {
      // Convert snake_case ke camelCase dan dates
      const converted = convertDates(toCamelCase(row))

      // Cek khusus untuk field BigInt
      if (converted.expires) {
        converted.expires = BigInt(converted.expires)
      }

      // Create dengan ID spesifik dari Supabase
      await model.create({
        data: converted,
      })

      successCount++
    } catch (error: any) {
      // Skip duplicate errors
      if (error.code === 'P2002') {
        // console.log(`  SKIP: Duplicate (${row.email || row.id})`)
      } else {
        console.error(`  ERROR: ${error.message}`)
        errorCount++
      }
    }
  }

  console.log(`  -> ${successCount} imported, ${errorCount} errors`)
  return successCount
}

async function main() {
  console.log('Starting import to MySQL...\n')

  let totalImported = 0

  for (const table of TABLES_ORDER) {
    try {
      const count = await importTable(table.name, table.model)
      totalImported += count
    } catch (error: any) {
      console.error(`FATAL ERROR for ${table.name}:`, error.message)
    }
  }

  console.log(`\nDone! ${totalImported} total rows imported to MySQL`)
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
