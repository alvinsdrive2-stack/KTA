import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the KTA request
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    // Check access - PUSAT/ADMIN can access all, DAERAH only their daerah, others only their own
    switch (session.user.role) {
      case 'DAERAH':
        if (session.user.daerahId !== ktaRequest.daerahId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        break
      case 'PUSAT':
      case 'ADMIN':
        break
      default:
        if (ktaRequest.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        break
    }

    // Directly fetch from SIKI API
    const { sikiApi } = await import('@/lib/siki-api')
    const sikiData = await sikiApi.getPekerjaByIdIzin(ktaRequest.idIzin)

    if (!sikiData || !sikiData.success) {
      return NextResponse.json(
        { error: sikiData?.message || 'Data tidak ditemukan di SIKI' },
        { status: 400 }
      )
    }

    // Debug: Log SIKI data structure
    console.log('SIKI Raw Data:', JSON.stringify(sikiData.data, null, 2))

    // Extract klasifikasi data - handle two different SIKI response formats
    const klasifikasiKualifikasi = sikiData.data?.klasifikasi_kualifikasi?.[0]
    let subklasifikasiId = null
    let idJabatanKerja: string | null = null
    let kodeSubklasifikasi: string | null = null
    let jabatanKerja = sikiData.data?.jabatan || 'N/A'
    let jenjang = sikiData.data?.jenjang || ''
    let noTelp = sikiData.data?.telp || sikiData.data?.telepon || ''

    // Format 1: SIKI has klasifikasi_kualifikasi array
    if (klasifikasiKualifikasi) {
      idJabatanKerja = klasifikasiKualifikasi.jabatan_kerja || null
      kodeSubklasifikasi = klasifikasiKualifikasi.subklasifikasi || null
      const idKlasifikasi = klasifikasiKualifikasi.klasifikasi
      jenjang = klasifikasiKualifikasi.jenjang || jenjang

      if (kodeSubklasifikasi && idKlasifikasi) {
        // Fetch proper subklasifikasi name from SIKI v2 API
        let subklasifikasiName = kodeSubklasifikasi
        const nameFromAPI = await sikiApi.getSubklasifikasiName(String(kodeSubklasifikasi))
        if (nameFromAPI) {
          subklasifikasiName = nameFromAPI
        }

        // Try to find existing subklasifikasi
        let subklasifikasi = await prisma.subklasifikasi.findUnique({
          where: { kodeSubklasifikasi: kodeSubklasifikasi }
        })

        // If not found, create new entry
        if (!subklasifikasi) {
          const idSubklasifikasi = kodeSubklasifikasi.substring(2).toUpperCase()
          subklasifikasi = await prisma.subklasifikasi.create({
            data: {
              idKlasifikasi: idKlasifikasi,
              idSubklasifikasi: idSubklasifikasi,
              kodeSubklasifikasi: kodeSubklasifikasi,
              subklasifikasi: subklasifikasiName,
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
      }
    }
    // Format 2: SIKI has simple format with direct subklasifikasi field
    else if (sikiData.data?.subklasifikasi) {
      kodeSubklasifikasi = sikiData.data.subklasifikasi
      // In simple format, sikiData.jabatan contains the jabatan kerja ID/code
      idJabatanKerja = sikiData.data?.jabatan || null

      // Fetch proper subklasifikasi name from SIKI v2 API
      let subklasifikasiName = kodeSubklasifikasi
      const nameFromAPI = await sikiApi.getSubklasifikasiName(String(kodeSubklasifikasi))
      if (nameFromAPI) {
        subklasifikasiName = nameFromAPI
      }

      // Parse kode_subklasifikasi (e.g., "SI01" -> idKlasifikasi="SI", idSubklasifikasi="01")
      const idKlasifikasi = kodeSubklasifikasi.substring(0, 2).toUpperCase()
      const idSubklasifikasi = kodeSubklasifikasi.substring(2).toUpperCase()

      // Try to find existing subklasifikasi
      let subklasifikasi = await prisma.subklasifikasi.findUnique({
        where: { kodeSubklasifikasi: kodeSubklasifikasi }
      })

      // If not found, create new entry
      if (!subklasifikasi) {
        subklasifikasi = await prisma.subklasifikasi.create({
          data: {
            idKlasifikasi: idKlasifikasi,
            idSubklasifikasi: idSubklasifikasi,
            kodeSubklasifikasi: kodeSubklasifikasi,
            subklasifikasi: subklasifikasiName,
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
    }

    // Fetch proper jabatan kerja name from new API
    if (idJabatanKerja) {
      const nameFromAPI = await sikiApi.getJabatanKerjaByCode(String(idJabatanKerja))
      if (nameFromAPI) {
        jabatanKerja = nameFromAPI
      }
    }

    // Update KTA request with fresh data from SIKI
    const updatedKTA = await prisma.kTARequest.update({
      where: { id: params.id },
      data: {
        nik: sikiData.data?.nik,
        nama: sikiData.data?.nama,
        jabatanKerja: jabatanKerja,
        subklasifikasiId: subklasifikasiId,
        jenjang: jenjang,
        noTelp: noTelp,
        email: sikiData.data?.email || '',
        alamat: sikiData.data?.alamat || '',
        ktpUrl: sikiData.data?.ktpUrl,
        fotoUrl: sikiData.data?.fotoUrl,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Data SIKI berhasil diperbarui',
      data: updatedKTA,
    })
  } catch (error) {
    console.error('Refresh SIKI error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
