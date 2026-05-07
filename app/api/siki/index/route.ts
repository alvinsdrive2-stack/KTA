import { NextRequest, NextResponse } from 'next/server'
import { fetchSikiWithFallback } from '@/lib/siki-api'

export const dynamic = 'force-dynamic'

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
      // Fetch from all 3 index endpoints in parallel with token fallback
      const endpoints = [
        'https://siki.pu.go.id/siki-api/v1/permohonan-skk',
        'https://siki.pu.go.id/siki-api/v1/permohonan-skk-fg',
        'https://siki.pu.go.id/siki-api/v1/permohonan-skk-balai',
      ]

      const responses = await Promise.allSettled(
        endpoints.map(url => fetchSikiWithFallback(url, { next: { revalidate: 3600 } }))
      )

      // Merge all successful responses
      const allData: SIKIListItem[] = []
      let hasError = false

      for (const result of responses) {
        if (result.status === 'fulfilled' && result.value) {
          const res = result.value.response
          if (res.ok) {
            const { data: endpointData }: { data: SIKIListItem[] } = await res.json()
            allData.push(...endpointData)
          } else {
            hasError = true
          }
        } else {
          hasError = true
        }
      }

      // If all failed, throw error
      if (allData.length === 0 && hasError) {
        throw new Error('SIKI API error: All index endpoints failed')
      }

      const { data } = { data: allData }

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
    const { searchParams } = req.nextUrl
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
