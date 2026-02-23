import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Cron Job: Check Expired KTA
 * Runs monthly to check if KTAs are expired (>5 years from tanggalDaftar)
 * Updates expired KTAs status to DRAFT
 *
 * Cron schedule: Run on the 1st of every month at 00:00
 * Example Vercel Cron: "0 0 1 * *" or use external cron service
 */
export async function GET(request: NextRequest) {
  try {
    console.log('========================================')
    console.log('CRON: Checking Expired KTAs')
    console.log('========================================')
    console.log(`Started at: ${new Date().toISOString()}`)

    // Find all KTAs that could be expired
    // Status: READY_TO_PRINT, PRINTED, APPROVED_BY_PUSAT, UPGRADE_PAID
    const activeKtas = await prisma.kTARequest.findMany({
      where: {
        status: {
          in: ['READY_TO_PRINT', 'PRINTED', 'APPROVED_BY_PUSAT', 'UPGRADE_PAID']
        }
      },
      select: {
        id: true,
        nama: true,
        tanggalDaftar: true,
        status: true,
        nomorKTA: true
      }
    })

    console.log(`Found ${activeKtas.length} active KTAs to check`)

    // Calculate expiry date (today - 5 years)
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    console.log(`Expiry threshold: ${fiveYearsAgo.toISOString()}`)

    // Find expired KTAs
    const expiredKTAs: Array<{ id: string; nama: string; tanggalDaftar: Date; nomorKTA?: string }> = []
    const expiredKTAMap = new Map<string, Date>()

    for (const kta of activeKtas) {
      const expiryDate = new Date(kta.tanggalDaftar)
      expiryDate.setFullYear(expiryDate.getFullYear() + 5)

      if (fiveYearsAgo > expiryDate) {
        expiredKTAs.push({
          id: kta.id,
          nama: kta.nama,
          tanggalDaftar: kta.tanggalDaftar,
          nomorKTA: kta.nomorKTA || undefined
        })
        expiredKTAMap.set(kta.id, expiryDate)
      }
    }

    console.log(`Found ${expiredKTAs.length} expired KTAs`)

    // Update expired KTAs to DRAFT status
    let updatedCount = 0
    const errors: Array<{ id: string; nama: string; error: string }> = []

    for (const expiredKTA of expiredKTAs) {
      try {
        await prisma.kTARequest.update({
          where: { id: expiredKTA.id },
          data: { status: 'DRAFT' }
        })
        updatedCount++
        console.log(`✅ Updated to DRAFT: ${expiredKTA.nama} (No: ${expiredKTA.nomorKTA || 'N/A'}, Expired: ${expiredKTAMap.get(expiredKTA.id)?.toISOString()})`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ id: expiredKTA.id, nama: expiredKTA.nama, error: errorMsg })
        console.error(`❌ Failed to update ${expiredKTA.nama}: ${errorMsg}`)
      }
    }

    const result = {
      success: true,
      summary: {
        checked: activeKtas.length,
        expired: expiredKTAs.length,
        updated: updatedCount,
        errors: errors.length,
        timestamp: new Date().toISOString()
      },
      expired: expiredKTAs.map(k => ({
        id: k.id,
        nama: k.nama,
        nomorKTA: k.nomorKTA,
        tanggalDaftar: k.tanggalDaftar.toISOString()
      })),
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('========================================')
    console.log('CRON: Check Expired KTA - COMPLETED')
    console.log('========================================')
    console.log(`Summary: ${result.summary.updated}/${result.summary.expired} updated, ${result.summary.errors} errors`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('CRON Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}
