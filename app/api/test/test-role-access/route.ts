import { NextRequest, NextResponse } from 'next/server'

// Test different role/daerah combinations
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action, role, daerahId } = body

  const testScenarios = [
    {
      name: 'DAERAH with daerah assignment',
      role: 'DAERAH',
      daerahId: 'cmjh08p6n00061h8ckl91rfqr', // Nasional
      expectedBehavior: 'Hanya lihat KTA dari daerah Nasional'
    },
    {
      name: 'DAERAH without daerah assignment',
      role: 'DAERAH',
      daerahId: null,
      expectedBehavior: 'Tidak bisa lihat data sama sekali'
    },
    {
      name: 'PUSAT user',
      role: 'PUSAT',
      daerahId: null,
      expectedBehavior: 'Lihat semua KTA dari semua daerah'
    },
    {
      name: 'ADMIN user',
      role: 'ADMIN',
      daerahId: null,
      expectedBehavior: 'Lihat semua KTA dari semua daerah'
    }
  ]

  const scenario = testScenarios.find(s =>
    s.role === role && s.daerahId === daerahId
  )

  if (!scenario) {
    return NextResponse.json({
      error: 'Invalid test scenario',
      availableScenarios: testScenarios
    })
  }

  return NextResponse.json({
    scenario: scenario.name,
    role: scenario.role,
    daerahId: scenario.daerahId,
    expectedBehavior: scenario.expectedBehavior,
    message: `Scenario: ${scenario.name} - Expected: ${scenario.expectedBehavior}`
  })
}