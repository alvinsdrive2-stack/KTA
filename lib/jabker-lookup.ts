/**
 * Helper functions untuk lookup Jabatan Kerja
 * Dari table lookup_jabker (lokal) bukan dari ASAP API
 */

import { prisma } from './prisma'

/**
 * Get jabatan kerja by kode from local table
 */
export async function getJabatanKerjaByKode(kodeJabker: string): Promise<string | null> {
  try {
    const result = await prisma.lookupJabker.findUnique({
      where: { kodeJabker },
      select: { jabatanKerja: true }
    })

    return result?.jabatanKerja || null
  } catch (error) {
    console.error(`Error looking up jabker ${kodeJabker}:`, error)
    return null
  }
}

/**
 * Get atau create jabatan kerja (fetch dari ASAP kalau nggak ada di lokal)
 * Ini hybrid approach: cek lokal dulu, kalau nggak ada baru fetch dari ASAP
 */
export async function getOrCreateJabatanKerja(kodeJabker: string): Promise<string> {
  // Cek lokal dulu
  const localResult = await getJabatanKerjaByKode(kodeJabker)
  if (localResult) {
    return localResult
  }

  // Kalau nggak ada, fetch dari ASAP
  try {
    const url = `https://asap.lspgatensi.id/api/jabker?kode_jabker=${kodeJabker}`
    const response = await fetch(url)

    if (response.ok) {
      const data = await response.json()

      if (data && data.data && data.data.jabatan_kerja) {
        const jabatanKerja = data.data.jabatan_kerja

        // Simpan ke lokal untuk next time
        await prisma.lookupJabker.create({
          data: {
            kodeJabker,
            jabatanKerja
          }
        })

        console.log(`✓ Cached new jabker: ${kodeJabker} → ${jabatanKerja}`)
        return jabatanKerja
      }
    }
  } catch (error) {
    console.error(`Failed to fetch jabker ${kodeJabker} from ASAP:`, error)
  }

  // Fallback: return kode jabker itu sendiri
  return kodeJabker
}

/**
 * Bulk sync jabatan kerja ke table lokal
 */
export async function syncJabatanKerjaBulk(jabkerList: Array<{ kodeJabker: string; jabatanKerja: string }>) {
  let synced = 0
  let failed = 0

  for (const item of jabkerList) {
    try {
      await prisma.lookupJabker.upsert({
        where: { kodeJabker: item.kodeJabker },
        update: { jabatanKerja: item.jabatanKerja },
        create: {
          kodeJabker: item.kodeJabker,
          jabatanKerja: item.jabatanKerja
        }
      })
      synced++
    } catch (error) {
      console.error(`Failed to sync ${item.kodeJabker}:`, error)
      failed++
    }
  }

  return { synced, failed }
}

/**
 * Get semua jabatan kerja dari lokal
 */
export async function getAllJabatanKerja() {
  return prisma.lookupJabker.findMany({
    orderBy: { kodeJabker: 'asc' }
  })
}

/**
 * Count jabatan kerja di lokal
 */
export async function countJabatanKerja() {
  return prisma.lookupJabker.count()
}
