import { NextRequest, NextResponse } from 'next/server'

const SIKI_API_TOKEN = process.env.SIKI_API_TOKEN || ''

// Cache SIKI index in memory
const sikiCache = {
  index: null as Map<string, string> | null,
  data: null as any[] | null,
  lastFetch: 0,
  CACHE_TTL: 60 * 60 * 1000, // 60 minutes
  fetching: null as Promise<{ data: any[]; index: Map<string, string> }> | null, // Fetch lock
}

interface SIKIListItem {
  nik: string
  id_izin: string
  id_lsp: string
  created_at: string
  updated_at: string
}

async function getSikiData(): Promise<{ data: SIKIListItem[]; cached: boolean }> {
  // Return cached data if still valid
  if (sikiCache.data && Date.now() - sikiCache.lastFetch < sikiCache.CACHE_TTL) {
    console.log('[SIKI] Using cached data')
    return { data: sikiCache.data, cached: true }
  }

  // If already fetching, wait for it
  if (sikiCache.fetching) {
    console.log('[SIKI] Already fetching, waiting...')
    const result = await sikiCache.fetching
    return { data: result.data, cached: false }
  }

  // Start fetching
  console.log('[SIKI] Fetching fresh data...')
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
        next: { revalidate: 3600 },
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
      console.log(`[SIKI] Data loaded in ${elapsed}ms (${data.length} records)`)

      sikiCache.data = data
      sikiCache.index = index
      sikiCache.lastFetch = Date.now()

      return { data, index }
    } finally {
      // Clear fetching lock when done
      sikiCache.fetching = null
    }
  })()

  sikiCache.fetching = fetchPromise
  const result = await fetchPromise
  return { data: result.data, cached: false }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const search = searchParams.get('search') || ''

    const { data, cached } = await getSikiData()

    // Filter by search (NIK or id_izin)
    let filteredData = data
    if (search) {
      const searchLower = search.toLowerCase()
      filteredData = data.filter(
        (item) =>
          item.nik.includes(searchLower) ||
          item.id_izin.toLowerCase().includes(searchLower)
      )
    }

    // Pagination
    const total = filteredData.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedData = filteredData.slice(startIndex, startIndex + limit)

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      meta: {
        cached,
        lastFetch: sikiCache.lastFetch,
        cacheExpiry: sikiCache.lastFetch + sikiCache.CACHE_TTL,
      },
    })
  } catch (error) {
    console.error('[SIKI Index] Error:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data SIKI', details: String(error) },
      { status: 500 }
    )
  }
}
