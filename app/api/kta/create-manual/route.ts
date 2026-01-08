import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      nik,
      nama,
      jabatanKerja,
      subklasifikasi,
      jenjang,
      noTelp,
      email,
      alamat,
      ktpUrl,
      fotoUrl,
      daerahId
    } = body

    // Validate required fields
    if (!nik || !nama || !jabatanKerja || !subklasifikasi || !jenjang || !noTelp || !email || !alamat) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Validate files
    if (!ktpUrl || !fotoUrl) {
      return NextResponse.json({ error: 'KTP and foto are required' }, { status: 400 })
    }

    // Determine daerah
    let finalDaerahId = daerahId

    // If no daerah specified and user is not pusat/nasional, use user's daerah
    if (!finalDaerahId && session.user.daerahId) {
      finalDaerahId = session.user.daerahId
    }

    if (!finalDaerahId) {
      return NextResponse.json({ error: 'Daerah is required' }, { status: 400 })
    }

    // Get pricing
    const jenjangNum = parseInt(jenjang, 10)
    const hargaBase = jenjangNum >= 7 ? 300000 : 100000

    // Get diskon from daerah
    const daerah = await prisma.daerah.findUnique({
      where: { id: finalDaerahId },
      select: { diskonPersen: true }
    })

    const diskonPersen = daerah?.diskonPersen || 0
    const hargaFinal = Math.floor(hargaBase - (hargaBase * diskonPersen / 100))

    // Generate ID Izin (M - for Manual)
    const idIzin = `M${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create KTA Request
    const ktaRequest = await prisma.kTARequest.create({
      data: {
        idIzin,
        nik,
        nama,
        jabatanKerja,
        subklasifikasi,
        jenjang,
        noTelp,
        email,
        alamat,
        ktpUrl,
        fotoUrl,
        daerahId: finalDaerahId,
        requestedBy: session.user.id,
        status: 'DRAFT',
        hargaRegion: hargaBase,
        diskonPersen,
        hargaBase,
        hargaFinal,
        tanggalDaftar: new Date(),
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Permohonan KTA berhasil dibuat',
      data: ktaRequest
    })

  } catch (error) {
    console.error('Create manual KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
