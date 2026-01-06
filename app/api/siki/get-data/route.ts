import { NextRequest, NextResponse } from 'next/server'
import { sikiApi } from '@/lib/siki-api'
import { authMiddleware } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { idIzin } = body

    if (!idIzin) {
      return NextResponse.json(
        { error: 'ID Izin harus diisi. Masukkan ID Izin yang valid dari SIKI.' },
        { status: 400 }
      )
    }

    // Fetch data from SIKI API
    const sikiData = await sikiApi.getPekerjaByIdIzin(idIzin)

    if (!sikiData || !sikiData.success) {
      let errorMessage = 'Data tidak ditemukan di SIKI. Pastikan ID Izin yang Anda masukkan benar dan data Anda sudah terdaftar di SIKI.'

      if (sikiData.message) {
        if (sikiData.message.includes('not found')) {
          errorMessage = 'Data tidak ditemukan di SIKI. Periksa kembali ID Izin Anda.'
        } else if (sikiData.message.includes('invalid')) {
          errorMessage = 'Format ID Izin tidak valid. Masukkan ID Izin dengan format yang benar.'
        } else if (sikiData.message.includes('expired')) {
          errorMessage = 'ID Izin sudah tidak berlaku. Hubungi administrator SIKI untuk pembaruan.'
        } else {
          errorMessage = sikiData.message
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    // Return SIKI data without saving to database
    return NextResponse.json({
      success: true,
      data: sikiData.data,
    })
  } catch (error) {
    console.error('Get SIKI data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}