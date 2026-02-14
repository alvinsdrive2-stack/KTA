import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { sikiApi } from '@/lib/siki-api'

export const dynamic = 'force-dynamic'

const SIKI_API_TOKEN = process.env.SIKI_API_TOKEN || ''

interface SIKIListItem {
  nik: string
  id_izin: string
}

// Cache SIKI index
const sikiCache = {
  index: null as Map<string, string> | null,
  lastFetch: 0,
  CACHE_TTL: 10 * 60 * 1000, // 10 minutes
}

async function getSikiIndex(): Promise<Map<string, string>> {
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

    const res = await fetch('https://siki.pu.go.id/siki-api/v1/permohonan-skk', {
      headers,
      next: { revalidate: 600 },
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
  } catch (error) {
    console.error('[SIKI] Fetch error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN can bulk fetch
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { daerahId, limit } = body

    // Find KTA records that need sync:
    // 1. idIzin is null (need to fetch from SIKI index)
    // 2. idIzin exists but fotoUrl or ktpUrl is null (can directly fetch from SIKI API)
    const baseClause: any = {
      OR: [
        { idIzin: null },
        { AND: [{ idIzin: { not: null } }, { OR: [{ fotoUrl: null }, { ktpUrl: null }] }] }
      ]
    }

    if (daerahId) {
      baseClause.daerahId = daerahId
    }

    // Add limit if provided
    const take = limit && limit > 0 ? Math.min(limit, 100) : 50 // Max 100 records per request

    const ktaRecords = await prisma.kTARequest.findMany({
      where: baseClause,
      select: {
        id: true,
        nik: true,
        nama: true,
        daerahId: true,
        idIzin: true,
      },
      take,
    })

    if (ktaRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada record yang perlu di-sync',
        data: {
          total: 0,
          updated: 0,
          notFound: 0,
          results: [],
        }
      })
    }

    console.log(`[Bulk SIKI] Processing ${ktaRecords.length} records`)

    // Get SIKI index for records without idIzin
    const sikiIndex = await getSikiIndex()

    // Process each record
    const results = []
    let updatedCount = 0
    let notFoundCount = 0
    let withPhotoCount = 0
    let skippedCount = 0

    for (const kta of ktaRecords) {
      try {
        let idIzin = kta.idIzin
        let needIdIzinLookup = false

        // Case 1: No idIzin - need to fetch from SIKI index
        if (!idIzin) {
          idIzin = sikiIndex.get(kta.nik)
          needIdIzinLookup = true

          if (!idIzin) {
            // Not found in SIKI - set status to READY_TO_PRINT so KTA can be downloaded
            await prisma.kTARequest.update({
              where: { id: kta.id },
              data: { status: 'READY_TO_PRINT' }
            })
            results.push({
              id: kta.id,
              nik: kta.nik,
              nama: kta.nama,
              status: 'not_found',
              idIzin: null
            })
            notFoundCount++
            continue
          }

          // Check if idIzin already exists in another record
          const existingRecord = await prisma.kTARequest.findFirst({
            where: {
              idIzin: idIzin,
              id: { not: kta.id }
            },
            select: { id: true, nama: true }
          })

          if (existingRecord) {
            console.log(`[Bulk SIKI] Duplicate idIzin ${idIzin} for NIK ${kta.nik}. Already exists in record ${existingRecord.id}`)
            results.push({
              id: kta.id,
              nik: kta.nik,
              nama: kta.nama,
              status: 'duplicate',
              idIzin: idIzin,
              error: `idIzin already exists in record ${existingRecord.id}`
            })
            skippedCount++
            continue
          }
        }

        // Case 2: Has idIzin or just fetched it - fetch full data from SIKI API
        let fotoUrl = null
        let ktpUrl = null
        let sikiFetchSuccess = false

        try {
          const sikiData = await sikiApi.getPekerjaByIdIzin(idIzin)

          if (sikiData?.success && sikiData?.data) {
            const data = sikiData.data
            sikiFetchSuccess = true

            fotoUrl = data.fotoUrl || null
            ktpUrl = data.ktpUrl || null

            console.log(`[Bulk SIKI] Fetched data for ${kta.nik}: foto=${!!fotoUrl}, ktp=${!!ktpUrl}`)

            // Build update data - include idIzin only if we're setting it for the first time
            const updateData: any = {
              nama: data.nama,
              nik: data.nik,
              jabatanKerja: data.jabatan,
              jenjang: data.jenjang,
              subklasifikasi: data.subklasifikasi,
              noTelp: data.telp,
              email: data.email,
              alamat: data.alamat,
              fotoUrl: fotoUrl,
              ktpUrl: ktpUrl,
              status: 'READY_TO_PRINT'
            }

            // Only set idIzin if we just fetched it (was null before)
            if (needIdIzinLookup) {
              updateData.idIzin = idIzin
            }

            await prisma.kTARequest.update({
              where: { id: kta.id },
              data: updateData
            })

            if (fotoUrl && ktpUrl) {
              withPhotoCount++
            }
          }
        } catch (sikiError) {
          console.error(`[Bulk SIKI] Error fetching data for idIzin ${idIzin}:`, sikiError)
        }

        results.push({
          id: kta.id,
          nik: kta.nik,
          nama: kta.nama,
          status: sikiFetchSuccess ? 'updated' : 'partial',
          idIzin: idIzin,
          hasFoto: !!fotoUrl,
          hasKtp: !!ktpUrl,
        })
        updatedCount++
      } catch (err) {
        console.error(`Error processing KTA ${kta.id}:`, err)
        results.push({
          id: kta.id,
          nik: kta.nik,
          nama: kta.nama,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memproses ${ktaRecords.length} record. ${updatedCount} diupdate (${withPhotoCount} dengan foto & KTP), ${skippedCount} duplikat/dilewati, ${notFoundCount} tidak ditemukan di SIKI`,
      data: {
        total: ktaRecords.length,
        updated: updatedCount,
        skipped: skippedCount,
        withPhotos: withPhotoCount,
        notFound: notFoundCount,
        results,
      }
    })

  } catch (error) {
    console.error('[Bulk SIKI] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to get stats
export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const daerahId = searchParams.get('daerahId')

    // Count records that need sync: idIzin is null OR (idIzin exists but foto/ktp is null)
    const baseClause: any = {
      OR: [
        { idIzin: null },
        { AND: [{ idIzin: { not: null } }, { OR: [{ fotoUrl: null }, { ktpUrl: null }] }] }
      ]
    }

    if (daerahId) {
      baseClause.daerahId = daerahId
    }

    const count = await prisma.kTARequest.count({
      where: baseClause
    })

    return NextResponse.json({
      success: true,
      data: {
        count,
        message: count > 0
          ? `Terdapat ${count} record yang perlu di-sync dengan SIKI`
          : 'Semua record sudah lengkap'
      }
    })

  } catch (error) {
    console.error('[Bulk SIKI Stats] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
