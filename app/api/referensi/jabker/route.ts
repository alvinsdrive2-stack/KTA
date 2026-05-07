import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const API_URL = 'https://asap.lspgatensi.id/api/jabker'

// In-memory cache
let cache: { data: any[]; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

function transform(item: any) {
  return {
    id: item.id_jabker?.trim(),
    lspIdKlasifikasi: item.lsp_id_klasifikasi?.trim(),
    klasifikasi: item.klasifikasi?.trim(),
    lspSubKlasifikasiId: item.lsp_sub_klasifikasi_id?.trim(),
    subklasifikasi: item.subklasifikasi?.trim(),
    lspKualifikasiId: item.lsp_kualifikasi_id?.trim(),
    kualifikasi: item.kualifikasi?.trim(),
    idJabker: item.id_jabker?.trim(),
    idJabatanKerja: item.id_jabatan_kerja?.trim(),
    jabatanKerja: item.jabatan_kerja?.trim(),
    jenjangId: item.jenjang_id?.trim(),
    keterangan: item.KETERANGAN?.trim(),
  }
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cache.data })
    }

    const response = await fetch(API_URL, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`External API returned ${response.status}`)
    }

    const result = await response.json()

    if (!result.status || !Array.isArray(result.data)) {
      throw new Error('Invalid response from external API')
    }

    const data = result.data.map(transform)

    cache = { data, timestamp: Date.now() }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching jabker:', error)

    if (cache) {
      console.warn('Returning stale cache')
      return NextResponse.json({ success: true, data: cache.data })
    }

    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
