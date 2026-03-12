import { NextRequest, NextResponse } from 'next/server'

const SIKI_API_TOKEN = process.env.SIKI_API_TOKEN || ''

// Cache SIKI index in memory
const sikiCache = {
  index: null as Map<string, string> | null,
  lastFetch: 0,
  CACHE_TTL: 10 * 60 * 1000, // 10 minutes
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

  console.log('[SIKI] Fetching fresh index...')
  const startTime = Date.now()

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (SIKI_API_TOKEN) {
      headers['token'] = SIKI_API_TOKEN
    }

    // Fetch from all 3 index endpoints in parallel
    const endpoints = [
      'https://siki.pu.go.id/siki-api/v1/permohonan-skk',
      'https://siki.pu.go.id/siki-api/v1/permohonan-skk-fg',
      'https://siki.pu.go.id/siki-api/v1/permohonan-skk-balai',
    ]

    const responses = await Promise.allSettled(
      endpoints.map(url => fetch(url, { headers, next: { revalidate: 600 } }))
    )

    // Merge all successful responses
    const allData: SIKIListItem[] = []
    let hasError = false

    for (const result of responses) {
      if (result.status === 'fulfilled') {
        const res = result.value
        if (res.ok) {
          const { data }: { data: SIKIListItem[] } = await res.json()
          allData.push(...data)
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
    console.log(`[SIKI] Index built in ${elapsed}ms (${data.length} records)`)

    sikiCache.index = index
    sikiCache.lastFetch = Date.now()

    return index
  } catch (error) {
    console.error('[SIKI] Fetch error:', error)
    throw error
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { nik: string } }
) {
  const nik = params.nik

  if (!nik || nik.length < 5) {
    return NextResponse.json(
      { error: 'NIK tidak valid' },
      { status: 400 }
    )
  }

  try {
    // Get index and find id_izin
    const index = await getSikiIndex()
    const idIzin = index.get(nik)

    if (!idIzin) {
      return NextResponse.json(
        { error: 'NIK tidak ditemukan di database SIKI', nik },
        { status: 404 }
      )
    }

    // Fetch detail data from all 3 endpoints in parallel
    const detailHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (SIKI_API_TOKEN) {
      detailHeaders['token'] = SIKI_API_TOKEN
    }

    const endpoints = [
      `https://siki.pu.go.id/siki-api/v1/permohonan-skk/${idIzin}`,
      `https://siki.pu.go.id/siki-api/v1/permohonan-skk-fg/${idIzin}`,
      `https://siki.pu.go.id/siki-api/v1/permohonan-skk-balai/${idIzin}`,
    ]

    const responses = await Promise.allSettled(
      endpoints.map(url => fetch(url, { headers: detailHeaders, next: { revalidate: 300 } }))
    )

    // Find the first successful response
    let detail: SIKIDetail | null = null
    for (const result of responses) {
      if (result.status === 'fulfilled') {
        const res = result.value
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'success' && data.personal?.length > 0) {
            detail = data
            break
          }
        }
      }
    }

    if (!detail) {
      throw new Error('SIKI Detail API: No data found in any endpoint')
    }

    // Find highest jenjang
    const jenjangList = detail.klasifikasi_kualifikasi
      ?.map((k) => parseInt(k.jenjang) || 0)
      .sort((a, b) => b - a) || []

    const maxJenjang = jenjangList[0] || 0

    return NextResponse.json({
      status: 'success',
      nik,
      id_izin: idIzin,
      jenjang: maxJenjang,
      all_jenjang: jenjangList,
      personal: detail.personal?.[0] || null,
      klasifikasi: detail.klasifikasi_kualifikasi || [],
    })
  } catch (error) {
    console.error('[SIKI] Error:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data dari SIKI', details: String(error) },
      { status: 500 }
    )
  }
}
