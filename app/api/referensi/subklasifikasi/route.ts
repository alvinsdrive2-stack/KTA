import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Normalize string for comparison (trim, lowercase, remove extra spaces)
function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

// GET /api/referensi/subklasifikasi - Get unique subklasifikasi list (case-insensitive)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const klasifikasi = searchParams.get('klasifikasi')

    const where: any = {}

    if (klasifikasi) {
      where.klasifikasi = klasifikasi
    }

    const subklasifikasiList = await prisma.jabatanKerja.findMany({
      where,
      select: {
        subklasifikasi: true,
        klasifikasi: true,
      },
      orderBy: { subklasifikasi: 'asc' },
    })

    // Deduplicate case-insensitive with normalization
    const uniqueMap = new Map<string, { subklasifikasi: string; klasifikasi: string }>()
    for (const item of subklasifikasiList) {
      const normalizedKey = normalize(item.subklasifikasi)
      if (!uniqueMap.has(normalizedKey)) {
        uniqueMap.set(normalizedKey, item)
      }
    }

    return NextResponse.json({
      success: true,
      data: Array.from(uniqueMap.values()),
    })
  } catch (error) {
    console.error('Error fetching subklasifikasi:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
