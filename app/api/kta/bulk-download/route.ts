import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { KTAPDFGenerator } from '@/lib/pdf-generator'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as archiver from 'archiver'
import { Readable } from 'stream'

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

  const daerah = await prisma.daerah.findUnique({
    where: { id: daerahId },
    select: { kodeDaerah: true }
  })

  if (!daerah) {
    throw new Error('Daerah not found')
  }

  const existingCount = await prisma.kTARequest.count({
    where: {
      daerahId,
      nomorKTA: {
        contains: `${daerah.kodeDaerah}.${jenjangCode}.`
      }
    }
  })

  const sequence = String(existingCount + 1).padStart(6, '0')
  return `${daerah.kodeDaerah}.${jenjangCode}.${sequence}`
}

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
        qrCodePath: true,
        nomorKTA: true,
        jenjang: true,
        daerahId: true,
        status: true,
        fotoUrl: true,
        fotoData: true, // Include fotoData from database
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
            qrCodePath = '/qr-placeholder.png'
          }

          // Prepare data for PDF generation
          // Try to fetch photo via proxy for external URLs (at generation time)
          let fotoData = kta.fotoData || undefined

          if (!fotoData && kta.fotoUrl && kta.fotoUrl.startsWith('http')) {
            // Try to fetch via internal proxy
            try {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
              const proxyUrl = `${baseUrl}/api/proxy/image?url=${encodeURIComponent(kta.fotoUrl)}`
              const response = await fetch(proxyUrl)

              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                const contentType = response.headers.get('content-type') || 'image/jpeg'
                const mimeType = contentType.split(';')[0].trim()
                fotoData = `data:${mimeType};base64,${buffer.toString('base64')}`
                console.log(`✅ Fetched photo via proxy for ${kta.nama}`)
              } else {
                console.log(`⚠️ Proxy fetch failed for ${kta.nama}: ${response.status}`)
              }
            } catch (error) {
              console.log(`⚠️ Proxy fetch error for ${kta.nama}:`, error instanceof Error ? error.message : 'Unknown')
            }
          }

          const ktaData = {
            id: kta.id,
            nama: kta.nama,
            alamat: kta.alamat,
            nomorKTA: nomorKTA || kta.id,
            createdAt: kta.createdAt,
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
