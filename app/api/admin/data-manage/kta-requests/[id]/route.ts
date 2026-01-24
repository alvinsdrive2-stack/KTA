import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KTAStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Fetch single KTA Request by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
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
        upgradeFromKtaId: true,
        hargaLama: true,
        hargaUpgrade: true,
        pusatApprovedBy: true,
        pusatApprovedAt: true,
        kartuGeneratedPath: true,
        qrCodePath: true,
        nomorKTA: true,
        fotoUrl: true,
        fotoData: true,
        ktpUrl: true,
        subklasifikasiId: true,
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
        payments: {
          select: {
            id: true,
            invoiceNumber: true,
            jumlah: true,
            statusPembayaran: true,
            paidAt: true,
            createdAt: true,
          },
        },
        documents: {
          select: {
            id: true,
            jenis: true,
            link: true,
            createdAt: true,
          },
        },
      },
    })

    if (!ktaRequest) {
      return NextResponse.json(
        { success: false, error: 'KTA Request tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: ktaRequest })
  } catch (error) {
    console.error('Get KTA request error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PATCH - Update KTA Request
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      nomorKTA,
      pusatApprovedBy,
    } = body

    // Check if KTA Request exists
    const existingKTA = await prisma.kTARequest.findUnique({
      where: { id: params.id },
    })

    if (!existingKTA) {
      return NextResponse.json(
        { success: false, error: 'KTA Request tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if idIzin is being changed and already exists
    if (idIzin && idIzin !== existingKTA.idIzin) {
      const idIzinExists = await prisma.kTARequest.findUnique({
        where: { idIzin },
      })

      if (idIzinExists) {
        return NextResponse.json(
          { success: false, error: 'ID Izin sudah terdaftar' },
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (idIzin) updateData.idIzin = idIzin
    if (daerahId) updateData.daerahId = daerahId
    if (nik) updateData.nik = nik
    if (nama) updateData.nama = nama
    if (jabatanKerja) updateData.jabatanKerja = jabatanKerja
    if (subklasifikasi !== undefined) updateData.subklasifikasi = subklasifikasi
    if (jenjang) updateData.jenjang = jenjang
    if (noTelp) updateData.noTelp = noTelp
    if (email) updateData.email = email
    if (alamat) updateData.alamat = alamat
    if (tanggalDaftar) updateData.tanggalDaftar = new Date(tanggalDaftar)
    if (status) updateData.status = status as KTAStatus
    if (hargaRegion !== undefined) updateData.hargaRegion = hargaRegion
    if (diskonPersen !== undefined) updateData.diskonPersen = diskonPersen
    if (hargaBase !== undefined) updateData.hargaBase = hargaBase
    if (hargaFinal !== undefined) updateData.hargaFinal = hargaFinal
    if (isUpgrade !== undefined) updateData.isUpgrade = isUpgrade
    if (subklasifikasiId !== undefined) updateData.subklasifikasiId = subklasifikasiId
    if (nomorKTA !== undefined) updateData.nomorKTA = nomorKTA
    if (pusatApprovedBy !== undefined) updateData.pusatApprovedBy = pusatApprovedBy

    const updatedKTA = await prisma.kTARequest.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        idIzin: true,
        daerahId: true,
        nik: true,
        nama: true,
        jabatanKerja: true,
        jenjang: true,
        status: true,
        hargaFinal: true,
        createdAt: true,
        updatedAt: true,
        daerah: {
          select: {
            namaDaerah: true,
            kodeDaerah: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedKTA })
  } catch (error) {
    console.error('Update KTA request error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE - Delete KTA Request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if KTA Request exists
    const existingKTA = await prisma.kTARequest.findUnique({
      where: { id: params.id },
    })

    if (!existingKTA) {
      return NextResponse.json(
        { success: false, error: 'KTA Request tidak ditemukan' },
        { status: 404 }
      )
    }

    await prisma.kTARequest.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: 'KTA Request berhasil dihapus' })
  } catch (error) {
    console.error('Delete KTA request error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
