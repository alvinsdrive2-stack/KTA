import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

// Helper function to get base price by jenjang
function getHargaBaseByJenjang(jenjang: string): number {
  const jenjangNum = parseInt(jenjang, 10)
  // Jenjang 7-9 = Rp. 300.000, Jenjang 1-6 = Rp. 100.000
  return jenjangNum >= 7 ? 300000 : 100000
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { idIzin, sikiData } = body

    if (!idIzin || !sikiData) {
      return NextResponse.json(
        { error: 'ID Izin dan data SIKI diperlukan. Pastikan Anda telah mencari data SIKI terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Get a valid daerahId
    let daerahId = session.user.daerahId
    if (!daerahId) {
      // Get first available daerah
      const defaultDaerah = await prisma.daerah.findFirst()
      daerahId = defaultDaerah?.id || 'DEFAULT'
    }

    // Get daerah diskon
    const daerah = await prisma.daerah.findUnique({
      where: { id: daerahId },
      select: { diskonPersen: true }
    })

    const diskonPersen = daerah?.diskonPersen ?? 0

    // Calculate pricing based on jenjang
    const jenjang = sikiData.jenjang
    const hargaBase = getHargaBaseByJenjang(jenjang)
    const hargaFinal = hargaBase - (hargaBase * diskonPersen / 100)

    // Check if KTA request already exists
    const existingRequest = await prisma.kTARequest.findUnique({
      where: { idIzin: idIzin }
    })

    let ktaRequest
    if (existingRequest) {
      // Update existing request
      ktaRequest = await prisma.kTARequest.update({
        where: { idIzin: idIzin },
        data: {
          nik: sikiData.nik,
          nama: sikiData.nama,
          jabatanKerja: sikiData.jabatan || 'N/A',
          subklasifikasi: sikiData.subklasifikasi || 'N/A',
          jenjang: sikiData.jenjang,
          noTelp: sikiData.telp || '',
          email: sikiData.email || '',
          alamat: sikiData.alamat || '',
          tanggalDaftar: sikiData.tgl_daftar ? new Date(sikiData.tgl_daftar) : new Date(),
          ktpUrl: sikiData.ktpUrl || null,
          fotoUrl: sikiData.fotoUrl || null,
          hargaRegion: hargaFinal,
          hargaBase,
          diskonPersen,
          hargaFinal,
        }
      })
    } else {
      // Create new KTA request
      ktaRequest = await prisma.kTARequest.create({
        data: {
          idIzin: idIzin,
          daerahId: daerahId,
          requestedBy: session.user.id,
          nik: sikiData.nik,
          nama: sikiData.nama,
          jabatanKerja: sikiData.jabatan || 'N/A',
          subklasifikasi: sikiData.subklasifikasi || 'N/A',
          jenjang: sikiData.jenjang,
          noTelp: sikiData.telp || '',
          email: sikiData.email || '',
          alamat: sikiData.alamat || '',
          tanggalDaftar: sikiData.tgl_daftar ? new Date(sikiData.tgl_daftar) : new Date(),
          status: 'DRAFT',
          hargaRegion: hargaFinal,
          hargaBase,
          diskonPersen,
          hargaFinal,
          ktpUrl: sikiData.ktpUrl || null,
          fotoUrl: sikiData.fotoUrl || null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ktaRequest,
        sikiData: sikiData,
        pricing: {
          jenjang,
          hargaBase,
          diskonPersen,
          hargaFinal
        }
      },
    })
  } catch (error) {
    console.error('Create KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}