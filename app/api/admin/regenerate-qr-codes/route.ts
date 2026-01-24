import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { QRCodeGenerator } from '@/lib/qr-generator'

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
        // Generate new QR code using the fixed method
        const qrCodePath = await QRCodeGenerator.generateKTAQR({
          nik: kta.nik,
        })

        // Check if the new QR code is valid (should be > 1000 characters for base64)
        const base64Part = qrCodePath.split(',')[1]
        if (base64Part && base64Part.length > 1000) {
          const updated = await prisma.kTARequest.update({
            where: { id: kta.id },
            data: { qrCodePath },
            select: { id: true, qrCodePath: true }
          })
          // Verify the update worked
          const verifySize = updated.qrCodePath?.split(',')[1]?.length || 0
          if (verifySize > 1000) {
            regenerated++
            console.log(`✅ Regenerated QR for ${kta.nama} (${kta.id}), size: ${base64Part.length}, verified: ${verifySize}`)
          } else {
            console.log(`⚠️ Update failed for ${kta.nama} - stored size: ${verifySize}`)
            skipped++
          }
        } else {
          console.log(`⚠️ Skipping ${kta.nama} - QR code still too small (${base64Part?.length || 0} bytes)`)
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
