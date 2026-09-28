import { NextRequest, NextResponse } from 'next/server'
import { checkUpgradeScenario } from '@/lib/kta-upgrade'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { nik, jenjang, subklasifikasi, daerahKode, sikiData } = await request.json()

    if (!nik || !jenjang) {
      return NextResponse.json(
        { error: 'NIK and jenjang are required' },
        { status: 400 }
      )
    }

    const result = await checkUpgradeScenario(
      nik,
      parseInt(jenjang),
      subklasifikasi || '',
      // Dipakai buat ngisi field kosong di KTA lama kalau permohonannya ditolak
      // karena jenjang. Nggak ada data SIKI = nggak ada yang di-backfill.
      sikiData,
      typeof daerahKode === 'string' && daerahKode.trim() !== '' ? daerahKode.trim() : undefined
    )

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Check upgrade error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
