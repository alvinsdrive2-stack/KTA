import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { KTAPDFGenerator } from '@/lib/pdf-generator'
import { QRCodeGenerator } from '@/lib/qr-generator'
import { authMiddleware } from '@/lib/auth-helpers'
import { generateNomorKTA } from '@/lib/kta-numbering'
import { readUpload, contentTypeFor } from '@/lib/upload-storage'

export const dynamic = 'force-dynamic'

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
        nik: true,
        nomorKTA: true,
        daerahId: true,
        jenjang: true,
        status: true,
        nama: true,
        qrCodePath: true
      }
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA not found' }, { status: 404 })
    }

    // Check if KTA is approved
    if (ktaRequest.status !== 'APPROVED_BY_PUSAT' &&
        ktaRequest.status !== 'READY_TO_PRINT' &&
        ktaRequest.status !== 'PRINTED' &&
        ktaRequest.status !== 'UPGRADE_PAID') {
      return NextResponse.json({ error: 'KTA must be approved first' }, { status: 400 })
    }

    // Generate nomorKTA if not exists
    let nomorKTA = ktaRequest.nomorKTA
    if (!nomorKTA) {
      nomorKTA = await generateNomorKTA(ktaRequest.daerahId, ktaRequest.jenjang)
    }

    // Generate QR code if not exists (using NIK-based format)
    let qrCodePath = ktaRequest.qrCodePath
    if (!qrCodePath) {
      qrCodePath = await QRCodeGenerator.generateKTAQR({
        nik: ktaRequest.nik,
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
//
// Query `?ktp=1` buat nyertain halaman KTP di depan kartu. Default-nya nggak,
// biar pemanggil lama (preview & print) nggak berubah perilakunya.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const includeKtp = request.nextUrl.searchParams.get('ktp') === '1'

    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        nik: true,
        nama: true,
        alamat: true,
        createdAt: true,
        tanggalDaftar: true,
        qrCodePath: true,
        nomorKTA: true,
        jenjang: true,
        daerahId: true,
        fotoUrl: true,
        fotoData: true, // Include fotoData from database
        ktpUrl: true, // Buat halaman KTP kalau diminta
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
    if (ktaRequest.status !== 'READY_TO_PRINT' &&
        ktaRequest.status !== 'PRINTED' &&
        ktaRequest.status !== 'UPGRADE_PAID') {
      return NextResponse.json({ error: 'KTA must be approved first' }, { status: 400 })
    }

    // Halaman KTP sifatnya wajib begitu diminta — kalau datanya nggak ada,
    // lebih baik gagal di sini daripada user dapat kartu yang kelihatan sah
    // padahal dokumennya bolong.
    if (includeKtp && !ktaRequest.ktpUrl) {
      return NextResponse.json({
        error: 'KTP belum ada untuk KTA ini'
      }, { status: 400 })
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

    // Generate QR code path if not exists (using NIK-based format)
    let qrCodePath = ktaRequest.qrCodePath
    if (!qrCodePath) {
      // Generate QR code for verification using NIK
      qrCodePath = await QRCodeGenerator.generateKTAQR({
        nik: ktaRequest.nik,
      })

      // Save QR code path to database
      await prisma.kTARequest.update({
        where: { id: params.id },
        data: { qrCodePath }
      })
    }

    // Prepare data for PDF generation
    // Fetch photo directly from storage or SIKI URL (no caching)
    let fotoData = ktaRequest.fotoData || undefined

    if (!fotoData && ktaRequest.fotoUrl) {
      if (ktaRequest.fotoUrl.startsWith('/uploads/') || ktaRequest.fotoUrl.startsWith('uploads/')) {
        try {
          const key = ktaRequest.fotoUrl.replace(/^\/?uploads\//, '')
          const buffer = await readUpload(key)
          if (buffer) {
            const mimeType = contentTypeFor(key)
            fotoData = `data:${mimeType};base64,${buffer.toString('base64')}`
            console.log(`✅ Loaded local upload photo for ${ktaRequest.nama}`)
          }
        } catch (err) {
          console.log(`⚠️ Failed reading local upload photo:`, err instanceof Error ? err.message : 'Unknown')
        }
      } else if (ktaRequest.fotoUrl.startsWith('http')) {
        // Fetch directly from SIKI API URL
        try {
          console.log(`📸 Fetching photo directly from SIKI: ${ktaRequest.fotoUrl}`)
          const response = await fetch(ktaRequest.fotoUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          })

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const contentType = response.headers.get('content-type') || 'image/jpeg'
            const mimeType = contentType.split(';')[0].trim()
            fotoData = `data:${mimeType};base64,${buffer.toString('base64')}`
            console.log(`✅ Fetched photo from SIKI for ${ktaRequest.nama}`)
          } else {
            console.log(`⚠️ SIKI fetch failed: ${response.status}`)
          }
        } catch (error) {
          console.log(`⚠️ SIKI fetch error:`, error instanceof Error ? error.message : 'Unknown')
        }
      }
    }

    // Resolve KTP jadi base64 kalau diminta.
    //
    // Cuma `ktpUrl` yang ada di schema (nggak ada kolom `ktpData`), jadi
    // sumbernya selalu file lokal atau URL eksternal. Aturan baca-nya sama
    // dengan foto: file lokal lewat `readUpload()`, URL eksternal (khas SIKI)
    // di-fetch server-side — SIKI sering geo-blocked kalau dari browser.
    let ktpData: string | undefined

    if (includeKtp && !ktpData && ktaRequest.ktpUrl) {
      if (ktaRequest.ktpUrl.startsWith('/uploads/') || ktaRequest.ktpUrl.startsWith('uploads/')) {
        const key = ktaRequest.ktpUrl.replace(/^\/?uploads\//, '')
        const buffer = await readUpload(key)
        if (!buffer) {
          return NextResponse.json({
            error: 'File KTP nggak ketemu di storage'
          }, { status: 400 })
        }
        ktpData = `data:${contentTypeFor(key)};base64,${buffer.toString('base64')}`
      } else if (ktaRequest.ktpUrl.startsWith('http')) {
        try {
          const response = await fetch(ktaRequest.ktpUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          })
          if (!response.ok) {
            return NextResponse.json({
              error: `Gagal ambil file KTP dari SIKI (HTTP ${response.status})`
            }, { status: 502 })
          }
          const buffer = Buffer.from(await response.arrayBuffer())
          const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
          ktpData = `data:${mimeType};base64,${buffer.toString('base64')}`
        } catch (error) {
          return NextResponse.json({
            error: 'Gagal ambil file KTP dari SIKI',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 502 })
        }
      } else {
        return NextResponse.json({
          error: 'Format ktpUrl nggak dikenali'
        }, { status: 400 })
      }
    }

    const ktaData = {
      id: ktaRequest.id,
      nik: ktaRequest.nik,
      nama: ktaRequest.nama,
      alamat: ktaRequest.alamat,
      nomorKTA: nomorKTA || '',
      createdAt: ktaRequest.createdAt || new Date(),
      tanggalDaftar: ktaRequest.tanggalDaftar || ktaRequest.createdAt || new Date(),
      qrCodePath: qrCodePath,
      ...(fotoData ? { fotoData } : {}),
      ...(!fotoData && ktaRequest.fotoUrl && !ktaRequest.fotoUrl.startsWith('http') ? { fotoUrl: ktaRequest.fotoUrl } : {}),
      ...(ktpData ? { ktpData } : {})
    }

    // Generate PDF on-demand
    const pdfBuffer = await KTAPDFGenerator.generateKTACard(ktaData)

    // Return PDF file directly
    return new NextResponse(new Uint8Array(pdfBuffer), {
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
