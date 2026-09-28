import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { QRCodeGenerator } from '@/lib/qr-generator'
import { readUpload } from '@/lib/upload-storage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find all KTAs with QR codes (or approved KTAs without QR codes)
    const ktas = await prisma.kTARequest.findMany({
      where: {
        status: {
          in: ['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED', 'UPGRADE_PAID']
        }
      },
      select: {
        id: true,
        nik: true,
        qrCodePath: true,
        nama: true,
      }
    })

    console.log(`Found ${ktas.length} approved KTAs to check/regenerate QR codes`)

    let regenerated = 0
    let skipped = 0
    const errors: { id: string; nama: string; error: string }[] = []

    for (const kta of ktas) {
      try {
        // `generateKTAQR()` nulis PNG ke storage dan balikin URL `/uploads/...`,
        // bukan data URL base64 lagi. Validasi lama (`split(',')[1].length`)
        // nggak pernah cocok — `split(',')[1]` selalu `undefined` — jadi route
        // ini balik `regenerated: 0` terus tanpa error. Sekarang file hasil
        // tulisnya yang diperiksa, itu satu-satunya bukti yang berarti.
        const qrCodePath = await QRCodeGenerator.generateKTAQR({
          nik: kta.nik,
        })

        const fileBuffer = await readUpload(qrCodePath.replace(/^\/?uploads\//, ''))
        if (fileBuffer && fileBuffer.length > 0) {
          await prisma.kTARequest.update({
            where: { id: kta.id },
            data: { qrCodePath },
            select: { id: true }
          })
          regenerated++
          console.log(`✅ Regenerated QR for ${kta.nama} (${kta.id}), ${fileBuffer.length} bytes`)
        } else {
          console.log(`⚠️ Skipping ${kta.nama} - file QR nggak kebentuk di ${qrCodePath}`)
          skipped++
        }
      } catch (error) {
        console.error(`❌ Error regenerating QR for ${kta.nama}:`, error)
        errors.push({
          id: kta.id,
          nama: kta.nama,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `QR code regeneration complete`,
      data: {
        total: ktas.length,
        regenerated,
        skipped,
        errors: errors.length,
        errorDetails: errors
      }
    })

  } catch (error) {
    console.error('Error regenerating QR codes:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
