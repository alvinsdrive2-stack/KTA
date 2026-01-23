import { NextRequest, NextResponse } from 'next/server'
import { checkUpgradeScenario } from '@/lib/kta-upgrade'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { nik, jenjang, subklasifikasi } = await request.json()

    if (!nik || !jenjang) {
      return NextResponse.json(
        { error: 'NIK and jenjang are required' },
        { status: 400 }
      )
    }

    const result = await checkUpgradeScenario(
      nik,
      parseInt(jenjang),
      subklasifikasi || ''
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
