import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KTAStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Fetch all KTA Requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Only ADMIN can access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const daerahId = searchParams.get('daerahId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { idIzin: { contains: search, mode: 'insensitive' } },
        { nama: { contains: search, mode: 'insensitive' } },
        { nik: { contains: search, mode: 'insensitive' } },
        { jabatanKerja: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status) {
      where.status = status as KTAStatus
    }
    if (daerahId) {
      where.daerahId = daerahId
    }

    const [ktaRequests, total] = await Promise.all([
      prisma.kTARequest.findMany({
        where,
        select: {
          id: true,
          idIzin: true,
          daerahId: true,
          requestedBy: true,
          nik: true,
          nama: true,
          jabatanKerja: true,
          subklasifikasi: true,
          jenjang: true,
          noTelp: true,
          email: true,
          alamat: true,
          tanggalDaftar: true,
          status: true,
          hargaRegion: true,
          diskonPersen: true,
          hargaBase: true,
          hargaFinal: true,
          isUpgrade: true,
          pusatApprovedBy: true,
          pusatApprovedAt: true,
          nomorKTA: true,
          createdAt: true,
          updatedAt: true,
          daerah: {
            select: {
              id: true,
              namaDaerah: true,
              kodeDaerah: true,
            },
          },
          requestedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          klasifikasi: {
            select: {
              id: true,
              idKlasifikasi: true,
              idSubklasifikasi: true,
              kodeSubklasifikasi: true,
              subklasifikasi: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.kTARequest.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: ktaRequests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get KTA requests error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST - Create new KTA Request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Only ADMIN can access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      idIzin,
      daerahId,
      requestedBy,
      nik,
      nama,
      jabatanKerja,
      subklasifikasi,
      jenjang,
      noTelp,
      email,
      alamat,
      tanggalDaftar,
      status,
      hargaRegion,
      diskonPersen,
      hargaBase,
      hargaFinal,
      isUpgrade,
      subklasifikasiId,
    } = body

    // Validation
    if (!idIzin || !daerahId || !nik || !nama || !jabatanKerja || !jenjang || !noTelp || !email || !alamat) {
      return NextResponse.json(
        { success: false, error: 'Data wajib harus diisi lengkap' },
        { status: 400 }
      )
    }

    // Check if idIzin already exists
    const existingKTA = await prisma.kTARequest.findUnique({
      where: { idIzin },
    })

    if (existingKTA) {
      return NextResponse.json(
        { success: false, error: 'ID Izin sudah terdaftar' },
        { status: 400 }
      )
    }

    // Create KTA Request
    const newKTARequest = await prisma.kTARequest.create({
      data: {
        idIzin,
        daerahId,
        requestedBy: requestedBy || user.id,
        nik,
        nama,
        jabatanKerja,
        subklasifikasi,
        jenjang,
        noTelp,
        email,
        alamat,
        tanggalDaftar: tanggalDaftar ? new Date(tanggalDaftar) : new Date(),
        status: status || KTAStatus.DRAFT,
        hargaRegion: hargaRegion || 0,
        diskonPersen: diskonPersen || 0,
        hargaBase: hargaBase || null,
        hargaFinal: hargaFinal || null,
        isUpgrade: isUpgrade || false,
        subklasifikasiId: subklasifikasiId || null,
      },
      select: {
        id: true,
        idIzin: true,
        daerahId: true,
        requestedBy: true,
        nik: true,
        nama: true,
        jabatanKerja: true,
        jenjang: true,
        status: true,
        createdAt: true,
        daerah: {
          select: {
            namaDaerah: true,
            kodeDaerah: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: newKTARequest }, { status: 201 })
  } catch (error) {
    console.error('Create KTA request error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
