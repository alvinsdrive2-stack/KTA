import { NextRequest, NextResponse } from 'next/server'
import { sikiApi } from '@/lib/siki-api'

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

    console.log(`Testing SIKI API with ID Izin: ${idIzin}`)

    // Fetch data from SIKI API
    const sikiData = await sikiApi.getPekerjaByIdIzin(idIzin)

    console.log(`SIKI API Response:`, JSON.stringify(sikiData, null, 2))

    if (!sikiData || !sikiData.success) {
      return NextResponse.json({
        success: false,
        error: sikiData?.message || 'Data tidak ditemukan',
        fullResponse: sikiData
      })
    }

    // Return full SIKI data with extracted province info
    return NextResponse.json({
      success: true,
      data: sikiData.data,
      debug: {
        idIzin: idIzin,
        extractedProvince: sikiData.data?.kodePropinsi,
        provinceName: sikiData.data?.namaProvinsi,
        originalAddress: sikiData.data?.alamat
      }
    })

  } catch (error) {
    console.error('Test SIKI error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}