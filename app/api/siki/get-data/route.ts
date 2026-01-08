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

    // Fetch klasifikasi data from database (similar to refresh-siki)
    let klasifikasiData = null
    const klasifikasiKualifikasi = (sikiData as any).klasifikasi_kualifikasi?.[0]
    let subklasifikasiId = null
    let kodeSubklasifikasi = null
    let jabatanKerja = sikiData.jabatan || 'N/A'
    let jenjang = sikiData.jenjang || ''

    // Format 1: SIKI has klasifikasi_kualifikasi array
    if (klasifikasiKualifikasi) {
      kodeSubklasifikasi = klasifikasiKualifikasi.subklasifikasi
      const idKlasifikasi = klasifikasiKualifikasi.klasifikasi
      jabatanKerja = klasifikasiKualifikasi.jabatan_kerja || jabatanKerja
      jenjang = klasifikasiKualifikasi.jenjang || jenjang

      if (kodeSubklasifikasi && idKlasifikasi) {
        let subklasifikasi = await prisma.subklasifikasi.findUnique({
          where: { kodeSubklasifikasi: kodeSubklasifikasi }
        })

        if (!subklasifikasi) {
          const idSubklasifikasi = kodeSubklasifikasi.substring(2).toUpperCase()
          subklasifikasi = await prisma.subklasifikasi.create({
            data: {
              idKlasifikasi: idKlasifikasi,
              idSubklasifikasi: idSubklasifikasi,
              kodeSubklasifikasi: kodeSubklasifikasi,
              subklasifikasi: `${idKlasifikasi}${idSubklasifikasi}`,
            }
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
    }
    // Format 2: SIKI has simple format with direct subklasifikasi field
    else if (sikiData.subklasifikasi) {
      kodeSubklasifikasi = sikiData.subklasifikasi
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
            subklasifikasi: `${idKlasifikasi}${idSubklasifikasi}`,
          }
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

    // Return SIKI data with klasifikasi info
    return NextResponse.json({
      success: true,
      data: {
        ...sikiData,
        jabatanKerja,
        jenjang,
        klasifikasi: klasifikasiData,
        subklasifikasiId,
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