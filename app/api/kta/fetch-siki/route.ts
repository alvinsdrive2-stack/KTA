import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sikiApi } from '@/lib/siki-api'
import { authMiddleware } from '@/lib/auth-helpers'

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
        { error: 'ID Izin is required' },
        { status: 400 }
      )
    }

    // Fetch data from SIKI API
    const sikiData = await sikiApi.getPekerjaByIdIzin(idIzin)

    if (!sikiData || !sikiData.success) {
      return NextResponse.json(
        { error: sikiData.message || 'Data tidak ditemukan di SIKI' },
        { status: 400 }
      )
    }

    // Log the data for debugging
    console.log('SIKI Data:', JSON.stringify(sikiData.data, null, 2))

    // Extract klasifikasi data from klasifikasi_kualifikasi array
    const klasifikasiKualifikasi = sikiData.data.klasifikasi_kualifikasi?.[0]
    let subklasifikasiId = null
    let jabatanKerja = 'N/A'
    let jenjang = ''

    if (klasifikasiKualifikasi) {
      const kodeSubklasifikasi = klasifikasiKualifikasi.subklasifikasi
      const idKlasifikasi = klasifikasiKualifikasi.klasifikasi
      jabatanKerja = klasifikasiKualifikasi.jabatan_kerja || 'N/A'
      jenjang = klasifikasiKualifikasi.jenjang || ''

      if (kodeSubklasifikasi && idKlasifikasi) {
        // Try to find existing subklasifikasi
        let subklasifikasi = await prisma.subklasifikasi.findUnique({
          where: { kodeSubklasifikasi: kodeSubklasifikasi }
        })

        // If not found, create new entry
        if (!subklasifikasi) {
          // Parse kode_subklasifikasi to extract id_subklasifikasi (after first 2 chars)
          const idSubklasifikasi = kodeSubklasifikasi.substring(2).toUpperCase()

          subklasifikasi = await prisma.subklasifikasi.create({
            data: {
              idKlasifikasi: idKlasifikasi,
              idSubklasifikasi: idSubklasifikasi,
              kodeSubklasifikasi: kodeSubklasifikasi,
              subklasifikasi: `${idKlasifikasi}${idSubklasifikasi}`, // Fallback name
            }
          })
        }

        subklasifikasiId = subklasifikasi.id
      }
    }

    // Get daerahId from logged-in user
    let daerahId = session.user.daerahId
    if (!daerahId) {
      // User doesn't have daerah assigned
      return NextResponse.json(
        { error: 'User tidak memiliki daerah yang ditugaskan' },
        { status: 400 }
      )
    }

    // Check if KTA request already exists
    const existingRequest = await prisma.kTARequest.findUnique({
      where: { idIzin: idIzin }
    })

    let ktaRequest
    if (existingRequest) {
      // Return existing request if already exists
      ktaRequest = existingRequest
    } else {
      // Create new KTA request
      ktaRequest = await prisma.kTARequest.create({
        data: {
          idIzin: idIzin,
          daerahId: daerahId,
          requestedBy: session.user.id,
          nik: sikiData.data.nik || '',
          nama: sikiData.data.nama || '',
          jabatanKerja: jabatanKerja,
          subklasifikasiId: subklasifikasiId,
          jenjang: jenjang,
          noTelp: sikiData.data.telepon || '',
          email: sikiData.data.email || '',
          alamat: sikiData.data.alamat || '',
          tanggalDaftar: new Date(),
          status: 'DRAFT',
          hargaRegion: 0, // Will be updated when creating payment
        },
      })
    }

    // Get current region price and update KTA request
    const currentYear = new Date().getFullYear()
    const regionPrice = await prisma.regionPrice.findFirst({
      where: {
        daerahId: daerahId,
        tahun: currentYear,
        isActive: true
      }
    })

    const harga = regionPrice?.hargaKta || 0

    // Update KTA request with region price
    await prisma.kTARequest.update({
      where: { id: ktaRequest.id },
      data: { hargaRegion: harga }
    })

    return NextResponse.json({
      success: true,
      data: {
        ktaRequest,
        sikiData: sikiData.data,
      },
    })
  } catch (error) {
    console.error('Fetch SIKI error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}