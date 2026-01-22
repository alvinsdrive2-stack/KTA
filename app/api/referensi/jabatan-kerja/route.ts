import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Normalize string for comparison (trim, lowercase, remove extra spaces)
function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

// GET /api/referensi/jabatan-kerja?subklasifikasi=xxx&jenjang=9
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const subklasifikasi = searchParams.get('subklasifikasi')
    const jenjang = searchParams.get('jenjang')

    // Build where clause
    const where: any = {
      status: '1', // Only active records
    }

    if (subklasifikasi) {
      where.subklasifikasi = subklasifikasi
    }

    if (jenjang) {
      where.jenjangId = jenjang
    }

    // Fetch data
    const data = await prisma.jabatanKerja.findMany({
      where,
      orderBy: [
        { subklasifikasi: 'asc' },
        { jenjangId: 'desc' },
        { jabatanKerja: 'asc' },
      ],
      select: {
        id: true,
        lspIdKlasifikasi: true,
        klasifikasi: true,
        lspSubKlasifikasiId: true,
        subklasifikasi: true,
        lspKualifikasiId: true,
        kualifikasi: true,
        idJabker: true,
        idJabatanKerja: true,
        jabatanKerja: true,
        jenjangId: true,
        keterangan: true,
      },
    })

    // Deduplicate jabatanKerja case-insensitive with normalization
    const uniqueMap = new Map<string, typeof data[0]>()
    for (const item of data) {
      const normalizedKey = normalize(item.jabatanKerja)
      if (!uniqueMap.has(normalizedKey)) {
        uniqueMap.set(normalizedKey, item)
      }
    }

    return NextResponse.json({
      success: true,
      data: Array.from(uniqueMap.values()),
    })
  } catch (error) {
    console.error('Error fetching jabatan kerja:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/referensi/jabatan-kerja/subklasifikasi - Get unique subklasifikasi list
export async function GET_SUBKLASIFIKASI() {
  try {
    const subklasifikasiList = await prisma.jabatanKerja.findMany({
      where: { status: '1' },
      distinct: ['subklasifikasi'],
      select: {
        subklasifikasi: true,
        klasifikasi: true,
      },
      orderBy: { subklasifikasi: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: subklasifikasiList,
    })
  } catch (error) {
    console.error('Error fetching subklasifikasi:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
