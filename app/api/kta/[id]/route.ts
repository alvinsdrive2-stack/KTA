import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

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
