import { prisma } from '@/lib/prisma'
import { addYearsWib } from '@/lib/utils'

/**
 * Check if KTA is expired (more than 5 years from tanggalDaftar)
 * If expired, update status to DRAFT
 */
export async function checkAndUpdateExpiredKTA(ktaId: string): Promise<{ isExpired: boolean; wasUpdated: boolean }> {
  const kta = await prisma.kTARequest.findUnique({
    where: { id: ktaId },
    select: { id: true, tanggalDaftar: true, status: true }
  })

  if (!kta) {
    return { isExpired: false, wasUpdated: false }
  }

  // Skip check if already DRAFT
  if (kta.status === 'DRAFT') {
    return { isExpired: false, wasUpdated: false }
  }

  // Calculate expiry date (tanggalDaftar + 5 years), kalender WIB
  const expiredDate = addYearsWib(kta.tanggalDaftar, 5)

  // Check if current date is past expiry date
  const now = new Date()
  const isExpired = now > expiredDate

  if (isExpired) {
    // Update status to DRAFT
    await prisma.kTARequest.update({
      where: { id: ktaId },
      data: { status: 'DRAFT' }
    })
    console.log(`⚠️ KTA ${ktaId} expired (tanggalDaftar: ${kta.tanggalDaftar}, expired: ${expiredDate}), status updated to DRAFT`)
    return { isExpired: true, wasUpdated: true }
  }

  return { isExpired: false, wasUpdated: false }
}

/**
 * Check if KTA is expired without updating (read-only check)
 */
export function isKTAExpired(tanggalDaftar: Date): boolean {
  return new Date() > addYearsWib(tanggalDaftar, 5)
}
