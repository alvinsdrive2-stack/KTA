import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { generateNomorKTA } from '@/lib/kta-numbering'
import { getUploadRoot, keyToUrl, readUpload, contentTypeFor } from '@/lib/upload-storage'
import { KTAPDFGenerator } from '@/lib/pdf-generator'
import { QRCodeGenerator } from '@/lib/qr-generator'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import archiver from 'archiver'
import { Readable } from 'stream'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ktaIds } = await request.json()

    if (!ktaIds || !Array.isArray(ktaIds) || ktaIds.length === 0) {
      return NextResponse.json({ error: 'KTA IDs are required' }, { status: 400 })
    }

    // Fetch all KTAs with complete data for PDF generation
    const ktas = await prisma.kTARequest.findMany({
      where: {
        id: { in: ktaIds }
      },
      select: {
        id: true,
        nama: true,
        alamat: true,
        createdAt: true,
        tanggalDaftar: true,
        qrCodePath: true,
        nomorKTA: true,
        jenjang: true,
        daerahId: true,
        status: true,
        fotoUrl: true,
        fotoData: true, // Include fotoData from database
        nik: true, // Need NIK for QR code generation
        daerah: {
          select: {
            kodeDaerah: true,
            namaDaerah: true
          }
        }
      }
    })

    if (ktas.length === 0) {
      return NextResponse.json({ error: 'No KTAs found' }, { status: 404 })
    }

    // Check if all KTAs are approved
    const unapprovedKTAs = ktas.filter(k => k.status !== 'READY_TO_PRINT' && k.status !== 'PRINTED')
    if (unapprovedKTAs.length > 0) {
      return NextResponse.json({
        error: 'Some KTAs are not ready for download',
        unapprovedKTAs: unapprovedKTAs.map(k => ({ id: k.id, nama: k.nama, status: k.status }))
      }, { status: 400 })
    }

    // Create ZIP file using archiver with streaming
    const archive = archiver('zip', { zlib: { level: 9 } })

    // Collect chunks for the response
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    return new Promise<NextResponse>(async (resolve, reject) => {
      archive.on('error', (err: Error) => {
        console.error('Archive error:', err)
        reject(err)
      })

      archive.on('end', () => {
        const zipBuffer = Buffer.concat(chunks)
        const response = new NextResponse(zipBuffer, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="KTA-Bulk-${Date.now()}.zip"`
          }
        })
        resolve(response)
      })

      // Generate and add each PDF to the ZIP
      const generatePromises = ktas.map(async (kta) => {
        try {
          // Generate nomorKTA if not exists
          let nomorKTA = kta.nomorKTA
          if (!nomorKTA) {
            nomorKTA = await generateNomorKTA(kta.daerahId, kta.jenjang)
            // Update the KTA with the generated nomorKTA
            await prisma.kTARequest.update({
              where: { id: kta.id },
              data: { nomorKTA }
            })
          }

          // Generate QR code path if not exists
          let qrCodePath = kta.qrCodePath
          if (!qrCodePath) {
            // Generate QR code buffer
            const qrBuffer = await QRCodeGenerator.generateKTAQRBuffer({
              nik: kta.nik || kta.id,
            })

            // Create qr-codes directory if it doesn't exist
            const qrDir = path.join(getUploadRoot(), 'qr-codes')
            await fs.mkdir(qrDir, { recursive: true })

            // Save QR code file
            const qrFileName = `qr-${kta.nik || kta.id}.png`
            const qrFilePath = path.join(qrDir, qrFileName)
            await fs.writeFile(qrFilePath, qrBuffer)

            // Set qrCodePath to the storage URL
            qrCodePath = keyToUrl(`qr-codes/${qrFileName}`)

            // Update KTA with the qrCodePath
            await prisma.kTARequest.update({
              where: { id: kta.id },
              data: { qrCodePath }
            })

            console.log(`✅ Generated QR code for ${kta.nama}: ${qrCodePath}`)
          }

          // Prepare data for PDF generation
          // Fetch photo directly from storage or URL (same as single KTA download)
          let fotoData = kta.fotoData || undefined

          if (!fotoData && kta.fotoUrl) {
            if (kta.fotoUrl.startsWith('/uploads/') || kta.fotoUrl.startsWith('uploads/')) {
              try {
                const key = kta.fotoUrl.replace(/^\/?uploads\//, '')
                const buffer = await readUpload(key)
                if (buffer) {
                  const mimeType = contentTypeFor(key)
                  fotoData = `data:${mimeType};base64,${buffer.toString('base64')}`
                  console.log(`✅ Loaded local upload photo for ${kta.nama}`)
                }
              } catch (err) {
                console.log(`⚠️ Failed reading local upload photo for ${kta.nama}:`, err instanceof Error ? err.message : 'Unknown')
              }
            } else if (kta.fotoUrl.startsWith('http')) {
              // Fetch directly from URL (no proxy)
              try {
                console.log(`📸 Fetching photo directly from URL: ${kta.fotoUrl}`)
                const response = await fetch(kta.fotoUrl, {
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
                  console.log(`✅ Fetched photo for ${kta.nama}`)
                } else {
                  console.log(`⚠️ Photo fetch failed for ${kta.nama}: ${response.status}`)
                }
              } catch (error) {
                console.log(`⚠️ Photo fetch error for ${kta.nama}:`, error instanceof Error ? error.message : 'Unknown')
              }
            }
          }

          const ktaData = {
            id: kta.id,
            nama: kta.nama,
            alamat: kta.alamat,
            nomorKTA: nomorKTA || kta.id,
            createdAt: kta.createdAt,
            tanggalDaftar: kta.tanggalDaftar || kta.createdAt,
            qrCodePath: qrCodePath,
            ...(fotoData ? { fotoData } : {}),
            ...(!fotoData && kta.fotoUrl && !kta.fotoUrl.startsWith('http') ? { fotoUrl: kta.fotoUrl } : {})
          }

          // Generate PDF on-demand
          const pdfBuffer = await KTAPDFGenerator.generateKTACard(ktaData)
          const fileName = `${nomorKTA || kta.nama}.pdf`

          // Add buffer to archive as a stream
          archive.append(pdfBuffer, { name: fileName })

          console.log(`✅ Added PDF to ZIP: ${fileName}`)
        } catch (error) {
          console.error(`❌ Error generating PDF for ${kta.nama}:`, error)
        }
      })

      try {
        await Promise.all(generatePromises)
        archive.finalize()
      } catch (error) {
        console.error('Error generating PDFs:', error)
        archive.abort()
        reject(error)
      }
    })

  } catch (error) {
    console.error('Bulk download error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
