import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        idIzin: true,
        nik: true,
        nama: true,
        jabatanKerja: true,
        subKlasifikasi: true,
        jenjang: true,
        noTelp: true,
        email: true,
        alamat: true,
        tanggalDaftar: true,
        status: true,
        ktpUrl: true,
        fotoUrl: true,
      },
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    // Check if KTA is approved (can be APPROVED_BY_PUSAT, READY_TO_PRINT, or PRINTED for reprint)
    const printableStatuses = ['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED']
    if (!printableStatuses.includes(ktaRequest.status)) {
      return NextResponse.json(
        { error: 'KTA must be approved before printing', currentStatus: ktaRequest.status },
        { status: 400 }
      )
    }

    // Check if user has access
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN' && ktaRequest.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate QR code if not exists
    if (!ktaRequest.fotoUrl) {
      // For demo, use placeholder
      ktaRequest.fotoUrl = '/images/photo-placeholder.png'
    }

    const qrCodeUrl = `https://api.qrserver.com/api.php?size=128x128&data=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${ktaRequest.idIzin}`)}`

    return NextResponse.json({
      success: true,
      data: {
        ...ktaRequest,
        qrCodeUrl,
      },
    })
  } catch (error) {
    console.error('Print KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}