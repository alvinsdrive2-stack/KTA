import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { KTAPDFGenerator } from '@/lib/pdf-generator'
import { QRCodeGenerator } from '@/lib/qr-generator'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// Helper function to generate nomorKTA
async function generateNomorKTA(daerahId: string, jenjang: string): Promise<string> {
  // Determine jenjang category code based on jenjang level
  // 1-3: Operator (03), 4-6: Teknisi (02), 7-9: Ahli (01)
  const jenjangNum = parseInt(jenjang, 10)
  let jenjangCode: string

  if (jenjangNum >= 1 && jenjangNum <= 3) {
    jenjangCode = '03' // Operator
  } else if (jenjangNum >= 4 && jenjangNum <= 6) {
    jenjangCode = '02' // Teknisi
  } else if (jenjangNum >= 7 && jenjangNum <= 9) {
    jenjangCode = '01' // Ahli
  } else {
    throw new Error(`Invalid jenjang: ${jenjang}. Must be between 1-9.`)
  }

  // Get daerah kode
  const daerah = await prisma.daerah.findUnique({
    where: { id: daerahId },
    select: { kodeDaerah: true }
  })

  if (!daerah) {
    throw new Error('Daerah not found')
  }

  // Count existing KTAs with the same daerah and jenjang category code
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

// POST endpoint to mark KTA as ready (PDF will be generated on-demand via GET)
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
      select: {
        id: true,
        nomorKTA: true,
        daerahId: true,
        jenjang: true,
        status: true,
        nama: true
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

    // Generate nomorKTA if not exists
    let nomorKTA = ktaRequest.nomorKTA
    if (!nomorKTA) {
      nomorKTA = await generateNomorKTA(ktaRequest.daerahId, ktaRequest.jenjang)
    }

    // Generate QR code if not exists
    let qrCodePath = ktaRequest.qrCodePath
    if (!qrCodePath) {
      qrCodePath = await QRCodeGenerator.generateKTAQR({
        id: ktaId,
        nomorKTA: nomorKTA,
      })
    }

    // Update KTARequest with nomorKTA and QR code - PDF will be generated on-demand
    await prisma.kTARequest.update({
      where: { id: ktaId },
      data: {
        nomorKTA,
        qrCodePath,
        status: 'READY_TO_PRINT'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'KTA ready for PDF generation',
      nomorKTA
    })

  } catch (error) {
    console.error('Error preparing KTA PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to download the PDF (generated on-demand)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        nama: true,
        alamat: true,
        createdAt: true,
        qrCodePath: true,
        nomorKTA: true,
        jenjang: true,
        daerahId: true,
        fotoUrl: true,
        fotoData: true, // Include fotoData from database
        status: true,
        daerah: {
          select: {
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
    if (ktaRequest.status !== 'READY_TO_PRINT' && ktaRequest.status !== 'PRINTED') {
      return NextResponse.json({ error: 'KTA must be approved first' }, { status: 400 })
    }

    // Generate nomorKTA if not exists
    let nomorKTA = ktaRequest.nomorKTA
    if (!nomorKTA && ktaRequest.daerahId) {
      nomorKTA = await generateNomorKTA(ktaRequest.daerahId, ktaRequest.jenjang)
      await prisma.kTARequest.update({
        where: { id: params.id },
        data: { nomorKTA }
      })
    }

    // Generate QR code path if not exists
    let qrCodePath = ktaRequest.qrCodePath
    if (!qrCodePath && nomorKTA) {
      // Generate QR code for verification
      qrCodePath = await QRCodeGenerator.generateKTAQR({
        id: ktaRequest.id,
        nomorKTA: nomorKTA,
      })

      // Save QR code path to database
      await prisma.kTARequest.update({
        where: { id: params.id },
        data: { qrCodePath }
      })
    } else if (!qrCodePath) {
      // Fallback if no nomorKTA yet
      qrCodePath = '/qr-placeholder.png'
    }

    // Prepare data for PDF generation
    // Try to fetch photo via proxy for external URLs (at generation time)
    let fotoData = ktaRequest.fotoData || undefined

    if (!fotoData && ktaRequest.fotoUrl && ktaRequest.fotoUrl.startsWith('http')) {
      // Try to fetch via internal proxy
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const proxyUrl = `${baseUrl}/api/proxy/image?url=${encodeURIComponent(ktaRequest.fotoUrl)}`
        const response = await fetch(proxyUrl)

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const contentType = response.headers.get('content-type') || 'image/jpeg'
          const mimeType = contentType.split(';')[0].trim()
          fotoData = `data:${mimeType};base64,${buffer.toString('base64')}`
          console.log(`✅ Fetched photo via proxy for ${ktaRequest.nama}`)
        } else {
          console.log(`⚠️ Proxy fetch failed: ${response.status}`)
        }
      } catch (error) {
        console.log(`⚠️ Proxy fetch error:`, error instanceof Error ? error.message : 'Unknown')
      }
    }

    const ktaData = {
      id: ktaRequest.id,
      nama: ktaRequest.nama,
      alamat: ktaRequest.alamat,
      nomorKTA: nomorKTA || '',
      createdAt: ktaRequest.createdAt || new Date(),
      qrCodePath: qrCodePath,
      ...(fotoData ? { fotoData } : {}),
      ...(!fotoData && ktaRequest.fotoUrl && !ktaRequest.fotoUrl.startsWith('http') ? { fotoUrl: ktaRequest.fotoUrl } : {})
    }

    // Generate PDF on-demand
    const pdfBuffer = await KTAPDFGenerator.generateKTACard(ktaData)

    // Return PDF file directly
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="KTA-${nomorKTA || ktaRequest.nama}.pdf"`
      }
    })

  } catch (error) {
    console.error('Error generating KTA PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
