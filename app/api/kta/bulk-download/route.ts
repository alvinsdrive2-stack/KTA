import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as archiver from 'archiver'

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

    // Fetch all KTAs with their PDF paths
    const ktas = await prisma.kTARequest.findMany({
      where: {
        id: { in: ktaIds }
      },
      select: {
        id: true,
        nomorKTA: true,
        nama: true,
        kartuGeneratedPath: true
      }
    })

    if (ktas.length === 0) {
      return NextResponse.json({ error: 'No KTAs found' }, { status: 404 })
    }

    // Check if all KTAs have generated PDFs
    const ktasWithoutPDF = ktas.filter(k => !k.kartuGeneratedPath)
    if (ktasWithoutPDF.length > 0) {
      return NextResponse.json({
        error: 'Some KTAs do not have generated PDFs yet',
        ktasWithoutPDF: ktasWithoutPDF.map(k => ({ id: k.id, nama: k.nama }))
      }, { status: 400 })
    }

    // Create a temporary directory for the ZIP file
    const tempDir = path.join(os.tmpdir(), `kta-bulk-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    const zipPath = path.join(tempDir, `KTA-Bulk-${Date.now()}.zip`)

    // Create ZIP file using archiver
    const output = require('fs').createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise<NextResponse>((resolve, reject) => {
      output.on('close', async () => {
        try {
          // Read the ZIP file
          const zipBuffer = await fs.readFile(zipPath)

          // Clean up temp directory
          await fs.rm(tempDir, { recursive: true, force: true })

          // Return ZIP file
          const response = new NextResponse(zipBuffer, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="KTA-Bulk-${Date.now()}.zip"`
            }
          })

          resolve(response)
        } catch (error) {
          console.error('Error reading ZIP file:', error)

          // Clean up temp directory
          await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})

          reject(error)
        }
      })

      archive.on('error', async (err: Error) => {
        console.error('Archive error:', err)

        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})

        reject(err)
      })

      // Pipe archive to output
      archive.pipe(output)

      // Add each PDF to the ZIP
      const addPromises = ktas.map(async (kta) => {
        if (kta.kartuGeneratedPath) {
          const filePath = path.join(process.cwd(), 'public', kta.kartuGeneratedPath)
          const fileName = `${kta.nomorKTA || kta.nama}.pdf`

          try {
            await fs.access(filePath)
            archive.file(filePath, { name: fileName })
          } catch (error) {
            console.error(`Error accessing PDF for ${kta.nama}:`, error)
          }
        }
      })

      Promise.all(addPromises).then(() => {
        archive.finalize()
      }).catch((error) => {
        console.error('Error adding files to archive:', error)
        archive.abort()
        reject(error)
      })
    })

  } catch (error) {
    console.error('Bulk download error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
