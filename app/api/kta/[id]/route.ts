import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { QRCodeGenerator } from '@/lib/qr-generator'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ktaId = params.id

    // Fetch KTA with all related data
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: ktaId },
      select: {
        id: true,
        idIzin: true,
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
        pusatApprovedBy: true,
        pusatApprovedAt: true,
        kartuGeneratedPath: true,
        qrCodePath: true,
        nomorKTA: true,
        createdAt: true,
        updatedAt: true,
        fotoUrl: true,
        fotoData: true,
        ktpUrl: true,
        subklasifikasiId: true,
        diskonPersen: true,
        hargaBase: true,
        hargaFinal: true,
        daerah: {
          select: {
            id: true,
            kodeDaerah: true,
            namaDaerah: true,
            alamat: true,
            telepon: true,
            email: true
          }
        },
        payments: {
          include: {
            bulkPayment: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true
              }
            }
          }
        }
      }
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: ktaRequest
    })

  } catch (error) {
    console.error('Error fetching KTA detail:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ktaId = params.id
    const body = await request.json()

    // Check if KTA exists
    const existingKta = await prisma.kTARequest.findUnique({
      where: { id: ktaId }
    })

    if (!existingKta) {
      return NextResponse.json({ error: 'KTA not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {}

    // Standard updates (ktpUrl, fotoUrl, status)
    if (body.ktpUrl !== undefined) {
      updateData.ktpUrl = body.ktpUrl
    }
    if (body.fotoUrl !== undefined) {
      updateData.fotoUrl = body.fotoUrl
    }
    if (body.status !== undefined) {
      updateData.status = body.status
    }

    // Allow all roles to edit EMPTY fields
    const editableFields = ['nama', 'nik', 'idIzin', 'jabatanKerja', 'subklasifikasi', 'jenjang', 'noTelp', 'email', 'alamat']

    for (const field of editableFields) {
      if (body[field] !== undefined) {
        // Only allow update if the field is currently empty
        const currentValue = existingKta[field as keyof typeof existingKta]
        if (!currentValue || currentValue.toString().trim() === '') {
          updateData[field] = body[field]
        } else if (currentValue !== body[field]) {
          // If field is not empty, only ADMIN/PUSAT can change it
          if (session.user.role === 'ADMIN' || session.user.role === 'PUSAT') {
            updateData[field] = body[field]
          }
        }
      }
    }

    // Regenerate QR code if requested
    if (body.regenerateQrCode === true && existingKta.nik) {
      console.log('Regenerating QR code for KTA:', existingKta.id)
      const qrCodePath = await QRCodeGenerator.generateKTAQR({
        nik: existingKta.nik,
      })
      updateData.qrCodePath = qrCodePath
      console.log('QR code regenerated successfully, new size:', qrCodePath.length)
    }

    // Update KTA
    const updatedKta = await prisma.kTARequest.update({
      where: { id: ktaId },
      data: updateData,
      select: {
        id: true,
        ktpUrl: true,
        fotoUrl: true,
        status: true,
        qrCodePath: true,
        nama: true,
        nik: true,
        idIzin: true,
        jabatanKerja: true,
        subklasifikasi: true,
        jenjang: true,
        noTelp: true,
        email: true,
        alamat: true,
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedKta
    })

  } catch (error) {
    console.error('Error updating KTA:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
