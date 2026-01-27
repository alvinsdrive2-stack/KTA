import { NextRequest, NextResponse } from 'next/server'

const SIKI_API_TOKEN = process.env.SIKI_API_TOKEN || ''

// Cache SIKI index in memory
const sikiCache = {
  index: null as Map<string, string> | null,
  lastFetch: 0,
  CACHE_TTL: 60 * 60 * 1000, // 60 minutes
  fetching: null as Promise<Map<string, string>> | null, // Fetch lock
}

interface SIKIListItem {
  nik: string
  id_izin: string
}

interface SIKIDetail {
  status: string
  personal?: Array<{
    nama: string
    nik: string
  }>
  klasifikasi_kualifikasi?: Array<{
    jenjang: string
    subklasifikasi: string
    kualifikasi: string
  }>
}

async function getSikiIndex(): Promise<Map<string, string>> {
  // Return cached index if still valid
  if (sikiCache.index && Date.now() - sikiCache.lastFetch < sikiCache.CACHE_TTL) {
    console.log('[SIKI] Using cached index')
    return sikiCache.index
  }

  // If already fetching, wait for it
  if (sikiCache.fetching) {
    console.log('[SIKI] Already fetching, waiting...')
    return sikiCache.fetching
  }

  // Start fetching
  console.log('[SIKI] Fetching fresh index...')
  const startTime = Date.now()

  const fetchPromise = (async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (SIKI_API_TOKEN) {
        headers['token'] = SIKI_API_TOKEN
      }

      const res = await fetch('https://siki.pu.go.id/siki-api/v1/permohonan-skk', {
        headers,
        next: { revalidate: 3600 }, // Cache 1 hour
      })

      if (!res.ok) {
        throw new Error(`SIKI API error: ${res.status}`)
      }

      const { data }: { data: SIKIListItem[] } = await res.json()

      // Build Map for O(1) lookup
      const index = new Map<string, string>()
      data.forEach((item) => {
        index.set(item.nik, item.id_izin)
      })

      const elapsed = Date.now() - startTime
      console.log(`[SIKI] Index built in ${elapsed}ms (${data.length} records)`)

      sikiCache.index = index
      sikiCache.lastFetch = Date.now()

      return index
    } finally {
      // Clear fetching lock when done
      sikiCache.fetching = null
    }
  })()

  sikiCache.fetching = fetchPromise
  return fetchPromise
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { niks } = body

    if (!niks || !Array.isArray(niks)) {
      return NextResponse.json(
        { error: 'Invalid request. Expected niks array' },
        { status: 400 }
      )
    }

    // Filter valid NIKs
    const validNiks = niks.filter((n: string) => n && n.length >= 5)

    if (validNiks.length === 0) {
      return NextResponse.json(
        { error: 'No valid NIKs provided' },
        { status: 400 }
      )
    }

    // Get index
    const index = await getSikiIndex()

    // Build headers
    const detailHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (SIKI_API_TOKEN) {
      detailHeaders['token'] = SIKI_API_TOKEN
    }

    // Fetch all details in parallel
    const results = await Promise.all(
      validNiks.map(async (nik: string) => {
        const reqStart = Date.now()

        try {
          const idIzin = index.get(nik)

          if (!idIzin) {
            return {
              nik,
              error: 'NIK tidak ditemukan',
              timing: Date.now() - reqStart,
            }
          }

          const detailRes = await fetch(
            `https://siki.pu.go.id/siki-api/v1/permohonan-skk/${idIzin}`,
            {
              headers: detailHeaders,
              next: { revalidate: 300 },
            }
          )

          if (!detailRes.ok) {
            return {
              nik,
              error: `SIKI API error: ${detailRes.status}`,
              timing: Date.now() - reqStart,
            }
          }

          const detail: SIKIDetail = await detailRes.json()

          const jenjangList = detail.klasifikasi_kualifikasi
            ?.map((k) => parseInt(k.jenjang) || 0)
            .sort((a, b) => b - a) || []

          const maxJenjang = jenjangList[0] || 0

          return {
            status: 'success',
            nik,
            id_izin: idIzin,
            jenjang: maxJenjang,
            all_jenjang: jenjangList,
            personal: detail.personal?.[0] || null,
            klasifikasi: detail.klasifikasi_kualifikasi || [],
            timing: Date.now() - reqStart,
          }
        } catch (error) {
          return {
            nik,
            error: error instanceof Error ? error.message : 'Terjadi kesalahan',
            timing: Date.now() - reqStart,
          }
        }
      })
    )

    return NextResponse.json({
      results,
      total: results.length,
      found: results.filter((r: any) => r.status === 'success').length,
    })
  } catch (error) {
    console.error('[SIKI Bulk] Error:', error)
    return NextResponse.json(
      { error: 'Gagal memproses request', details: String(error) },
      { status: 500 }
    )
  }
}
