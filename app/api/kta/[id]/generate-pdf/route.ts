import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { KTAPDFGenerator } from '@/lib/pdf-generator'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// Helper function to generate nomorKTA
async function generateNomorKTA(daerahId: string, jenjang: string): Promise<string> {
  // Determine jenjang code: 01 for jenjang > 6, 02 for jenjang <= 6
  const jenjangNum = parseInt(jenjang, 10)
  const jenjangCode = jenjangNum > 6 ? '01' : '02'

  // Get daerah kode
  const daerah = await prisma.daerah.findUnique({
    where: { id: daerahId },
    select: { kodeDaerah: true }
  })

  if (!daerah) {
    throw new Error('Daerah not found')
  }

  // Count existing KTAs with the same daerah and jenjang code
  const existingCount = await prisma.kTARequest.count({
    where: {
      daerahId,
      nomorKTA: {
        contains: `${daerah.kodeDaerah}.${jenjangCode}.`
      }
    }
  })

  // Generate sequence number (6 digits, padded with zeros)
  const sequence = String(existingCount + 1).padStart(6, '0')

  return `${daerah.kodeDaerah}.${jenjangCode}.${sequence}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can generate KTA PDF
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ktaId = params.id

    // Fetch KTA with all related data
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: ktaId },
      include: {
        daerah: {
          select: {
            id: true,
            kodeDaerah: true,
            namaDaerah: true
          }
        }
      }
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA not found' }, { status: 404 })
    }

    // Check if KTA is approved
    if (ktaRequest.status !== 'APPROVED_BY_PUSAT' &&
        ktaRequest.status !== 'READY_TO_PRINT' &&
        ktaRequest.status !== 'PRINTED') {
      return NextResponse.json({ error: 'KTA must be approved first' }, { status: 400 })
    }

    // If PDF already generated, return existing path
    if (ktaRequest.kartuGeneratedPath && ktaRequest.nomorKTA) {
      return NextResponse.json({
        success: true,
        message: 'PDF already generated',
        nomorKTA: ktaRequest.nomorKTA,
        pdfPath: ktaRequest.kartuGeneratedPath
      })
    }

    // Generate nomorKTA if not exists
    let nomorKTA = ktaRequest.nomorKTA
    if (!nomorKTA) {
      nomorKTA = await generateNomorKTA(ktaRequest.daerahId, ktaRequest.jenjang)
    }

    // Generate QR code path if not exists
    let qrCodePath = ktaRequest.qrCodePath
    if (!qrCodePath) {
      // For now, use a placeholder - in real implementation, generate QR code
      qrCodePath = '/qr-placeholder.png'
    }

    // Prepare data for PDF generation
    const ktaData = {
      id: ktaRequest.id,
      idIzin: ktaRequest.idIzin,
      nama: ktaRequest.nama,
      nik: ktaRequest.nik,
      jabatanKerja: ktaRequest.jabatanKerja,
      subklasifikasi: ktaRequest.subklasifikasi || '-',
      jenjang: ktaRequest.jenjang,
      noTelp: ktaRequest.noTelp,
      email: ktaRequest.email,
      alamat: ktaRequest.alamat,
      tanggalDaftar: ktaRequest.tanggalDaftar,
      qrCodePath: qrCodePath,
      daerahNama: ktaRequest.daerah.namaDaerah,
      fotoUrl: ktaRequest.fotoUrl || undefined,
      tanggalTerbit: new Date(),
      tanggalBerlaku: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) // 5 years from now
    }

    // Generate PDF
    const pdfPath = await KTAPDFGenerator.generateKTACard(ktaData)

    // Update KTARequest with nomorKTA and PDF path
    await prisma.kTARequest.update({
      where: { id: ktaId },
      data: {
        nomorKTA,
        kartuGeneratedPath: pdfPath,
        qrCodePath,
        status: 'READY_TO_PRINT'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'KTA PDF generated successfully',
      nomorKTA,
      pdfPath
    })

  } catch (error) {
    console.error('Error generating KTA PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to download the PDF
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      select: {
        kartuGeneratedPath: true,
        nomorKTA: true,
        nama: true
      }
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA not found' }, { status: 404 })
    }

    if (!ktaRequest.kartuGeneratedPath) {
      return NextResponse.json({ error: 'PDF not generated yet' }, { status: 404 })
    }

    // Read PDF file
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'public', ktaRequest.kartuGeneratedPath)

    const fileBuffer = await fs.readFile(filePath)

    // Return PDF file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="KTA-${ktaRequest.nomorKTA || ktaRequest.nama}.pdf"`
      }
    })

  } catch (error) {
    console.error('Error downloading KTA PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
