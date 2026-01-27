/**
 * Script untuk sync data Jabatan Kerja dari ASAP API ke table lookup_jabker
 * Usage: npx tsx scripts/sync-jabker-from-asap.ts
 */

import { prisma } from '../lib/prisma'

interface ASAPJabkerResponse {
  data: {
    jabatan_kerja: string
  } | {
    id: string
    kode_jabker: string
    jabatan_kerja: string
    // tambah field lain kalau perlu
  }[]
}

// Base URL ASAP API
const ASAP_BASE_URL = 'https://asap.lspgatensi.id/api'

/**
 * Fetch single jabatan kerja dari ASAP
 */
async function fetchJabkerFromASAP(kodeJabker: string): Promise<string | null> {
  try {
    const url = `${ASAP_BASE_URL}/jabker?kode_jabker=${kodeJabker}`
    console.log(`Fetching: ${url}`)

    const response = await fetch(url)

    if (!response.ok) {
      console.log(`  ✗ HTTP ${response.status}`)
      return null
    }

    const data = await response.json()

    // Check response structure
    if (data && data.data && data.data.jabatan_kerja) {
      return data.data.jabatan_kerja
    }

    return null
  } catch (error) {
    console.error(`  ✗ Error: ${error}`)
    return null
  }
}

/**
 * Fetch semua jabatan kerja dari ASAP
 */
async function fetchAllJabkerFromASAP(): Promise<Array<{ kodeJabker: string; jabatanKerja: string }>> {
  try {
    const url = `${ASAP_BASE_URL}/jabker`
    console.log(`Fetching all jabker from: ${url}`)

    const response = await fetch(url)

    if (!response.ok) {
      console.log(`  ✗ HTTP ${response.status}`)
      return []
    }

    const data = await response.json()

    // Handle ASAP API response structure: { status: true, count: N, data: [...] }
    let items: any[] = []

    if (data && data.data && Array.isArray(data.data)) {
      items = data.data
    } else if (data && Array.isArray(data)) {
      items = data
    }

    console.log(`  ✓ Got ${items.length} items from ASAP`)

    // Map to our format - prioritize id_jabatan_kerja as kode
    return items.map((item: any) => ({
      kodeJabker: item.id_jabatan_kerja || item.id_jabker || item.kodeJabker || '',
      jabatanKerja: item.jabatan_kerja || item.jabatanKerja || ''
    })).filter(item => item.kodeJabker && item.jabatanKerja) // Filter invalid entries

  } catch (error) {
    console.log(`  ✗ Error: ${error}`)
    return []
  }
}

/**
 * Sync jabatan kerja ke database
 */
async function syncJabkerToDB(kodeJabker: string, jabatanKerja: string) {
  try {
    // Upsert: create if not exists, update if exists
    await prisma.lookupJabker.upsert({
      where: { kodeJabker },
      update: { jabatanKerja },
      create: {
        kodeJabker,
        jabatanKerja
      }
    })
    return true
  } catch (error) {
    console.error(`  ✗ DB Error: ${error}`)
    return false
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('========================================')
  console.log('Sync Jabatan Kerja dari ASAP')
  console.log('========================================\n')

  // Fetch semua data dari ASAP
  console.log('📋 Fetching semua data dari ASAP...')
  const allJabker = await fetchAllJabkerFromASAP()

  if (allJabker.length === 0) {
    console.log('\n❌ Tidak ada data yang didapat dari ASAP')
    console.log('Pastikan endpoint https://asap.lspgatensi.id/api/jabker accessible')
    return
  }

  console.log(`✓ Dapat ${allJabker.length} data dari ASAP\n`)

  // Sync ke database
  console.log('💾 Syncing ke database...\n')

  let successCount = 0
  let errorCount = 0

  for (const item of allJabker) {
    const synced = await syncJabkerToDB(item.kodeJabker, item.jabatanKerja)
    if (synced) {
      successCount++
    } else {
      errorCount++
    }
  }

  console.log('\n========================================')
  console.log('✅ Sync Selesai!')
  console.log(`  Berhasil: ${successCount}`)
  console.log(`  Gagal:    ${errorCount}`)
  console.log(`  Total:    ${allJabker.length}`)
  console.log('========================================')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
