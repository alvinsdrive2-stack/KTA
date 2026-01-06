import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

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
          hargaRegion: 0, // Will be updated when creating payment
          ktpUrl: sikiData.ktpUrl || null,
          fotoUrl: sikiData.fotoUrl || null,
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
        sikiData: sikiData,
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