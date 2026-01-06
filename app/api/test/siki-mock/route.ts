import { NextRequest, NextResponse } from 'next/server'
import { SIKIApiClient } from '@/lib/siki-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { idIzin } = body

    if (!idIzin) {
      return NextResponse.json(
        { error: 'ID Izin harus diisi' },
        { status: 400 }
      )
    }

    console.log(`Testing SIKI API with MOCK mode, ID Izin: ${idIzin}`)

    // Create SIKI API client in test mode
    const sikiApiTest = new SIKIApiClient(process.env.SIKI_API_TOKEN, true)

    // Fetch mock data
    const sikiData = await sikiApiTest.getPermohonanSKK(idIzin)

    console.log(`SIKI Mock Response:`, JSON.stringify(sikiData, null, 2))

    return NextResponse.json({
      success: true,
      data: sikiData.data,
      mockMode: true,
      debug: {
        idIzin: idIzin,
        extractedProvince: sikiData.data?.kodePropinsi,
        provinceName: sikiData.data?.namaProvinsi,
        originalAddress: sikiData.data?.alamat
      }
    })

  } catch (error) {
    console.error('Test SIKI mock error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}