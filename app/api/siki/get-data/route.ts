import { NextRequest, NextResponse } from 'next/server'
import { sikiApi } from '@/lib/siki-api'
import { authMiddleware } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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
    const sikiResponse = await sikiApi.getPekerjaByIdIzin(idIzin)

    if (!sikiResponse || !sikiResponse.success) {
      let errorMessage = 'Data tidak ditemukan di SIKI. Pastikan ID Izin yang Anda masukkan benar dan data Anda sudah terdaftar di SIKI.'

      if (sikiResponse.message) {
        if (sikiResponse.message.includes('not found')) {
          errorMessage = 'Data tidak ditemukan di SIKI. Periksa kembali ID Izin Anda.'
        } else if (sikiResponse.message.includes('invalid')) {
          errorMessage = 'Format ID Izin tidak valid. Masukkan ID Izin dengan format yang benar.'
        } else if (sikiResponse.message.includes('expired')) {
          errorMessage = 'ID Izin sudah tidak berlaku. Hubungi administrator SIKI untuk pembaruan.'
        } else {
          errorMessage = sikiResponse.message
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    const sikiData = sikiResponse.data
    const klasifikasiKualifikasi = (sikiData as any).klasifikasi_kualifikasi?.[0]

    // Extract values from SIKI
    let idJabatanKerja: string | null = null
    let kodeSubklasifikasi: string | null = null
    let jabatanKerja = sikiData.jabatan || 'N/A'
    let jenjang = sikiData.jenjang || ''

    console.log('=== SIKI Data Debug ===')
    console.log('Raw klasifikasiKualifikasi:', JSON.stringify(klasifikasiKualifikasi, null, 2))
    console.log('sikiData.jabatan:', sikiData.jabatan)
    console.log('sikiData.subklasifikasi:', sikiData.subklasifikasi)

    // Format 1: SIKI has klasifikasi_kualifikasi array
    if (klasifikasiKualifikasi) {
      idJabatanKerja = klasifikasiKualifikasi.jabatan_kerja || null
      kodeSubklasifikasi = klasifikasiKualifikasi.subklasifikasi || null
      jenjang = klasifikasiKualifikasi.jenjang || jenjang
    }
    // Format 2: SIKI has simple format
    else {
      // In simple format, sikiData.jabatan contains the jabatan kerja ID/code
      idJabatanKerja = sikiData.jabatan || null
      kodeSubklasifikasi = sikiData.subklasifikasi || null
    }

    console.log('Extracted values:')
    console.log('- idJabatanKerja:', idJabatanKerja)
    console.log('- kodeSubklasifikasi:', kodeSubklasifikasi)
    console.log('- jenjang:', jenjang)

    // Fetch proper jabatan kerja name from new API
    let jabatanKerjaName = jabatanKerja
    if (idJabatanKerja) {
      console.log('Fetching jabatan kerja for kode:', idJabatanKerja)
      const nameFromAPI = await sikiApi.getJabatanKerjaByCode(String(idJabatanKerja))
      if (nameFromAPI) {
        jabatanKerjaName = nameFromAPI
      }
    }

    // Fetch proper subklasifikasi name from SIKI v2 API
    let subklasifikasiName = kodeSubklasifikasi || ''
    if (kodeSubklasifikasi) {
      console.log('Fetching subklasifikasi name for kode:', kodeSubklasifikasi)
      const nameFromAPI = await sikiApi.getSubklasifikasiName(String(kodeSubklasifikasi))
      console.log('Subklasifikasi name from API:', nameFromAPI)
      if (nameFromAPI) {
        subklasifikasiName = nameFromAPI
      }
    }

    console.log('Final values:')
    console.log('- jabatanKerjaName:', jabatanKerjaName)
    console.log('- subklasifikasiName:', subklasifikasiName)
    console.log('=====================')

    // Handle database operations for subklasifikasi
    let klasifikasiData = null
    let subklasifikasiId = null

    if (kodeSubklasifikasi) {
      const idKlasifikasi = kodeSubklasifikasi.substring(0, 2).toUpperCase()
      const idSubklasifikasi = kodeSubklasifikasi.substring(2).toUpperCase()

      let subklasifikasi = await prisma.subklasifikasi.findUnique({
        where: { kodeSubklasifikasi: kodeSubklasifikasi }
      })

      if (!subklasifikasi) {
        subklasifikasi = await prisma.subklasifikasi.create({
          data: {
            idKlasifikasi: idKlasifikasi,
            idSubklasifikasi: idSubklasifikasi,
            kodeSubklasifikasi: kodeSubklasifikasi,
            subklasifikasi: subklasifikasiName || `${idKlasifikasi}${idSubklasifikasi}`,
          }
        })
      } else if (subklasifikasiName && subklasifikasi.subklasifikasi !== subklasifikasiName) {
        // Update existing subklasifikasi with the proper name from API
        subklasifikasi = await prisma.subklasifikasi.update({
          where: { id: subklasifikasi.id },
          data: { subklasifikasi: subklasifikasiName }
        })
      }

      subklasifikasiId = subklasifikasi.id
      klasifikasiData = {
        id: subklasifikasi.id,
        idKlasifikasi: subklasifikasi.idKlasifikasi,
        idSubklasifikasi: subklasifikasi.idSubklasifikasi,
        kodeSubklasifikasi: subklasifikasi.kodeSubklasifikasi,
        subklasifikasi: subklasifikasi.subklasifikasi,
      }
    }

    // Return SIKI data with enhanced info
    return NextResponse.json({
      success: true,
      data: {
        ...sikiData,
        jabatanKerja: jabatanKerjaName,
        jenjang,
        klasifikasi: klasifikasiData,
        subklasifikasiId,
        // Keep original values for reference
        idJabatanKerja,
        kodeSubklasifikasi,
      },
    })
  } catch (error) {
    console.error('Get SIKI data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
