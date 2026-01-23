import { prisma } from '@/lib/prisma'

export interface UpgradeCheckResult {
  isUpgrade: boolean
  canUpgrade: boolean
  existingKta: any | null
  newJenjang: number
  oldJenjang: number | null
  hargaBaru: number
  hargaLama: number
  hargaUpgrade: number
  reason?: string
}

export function getJenjangCategory(jenjang: number): string {
  if (jenjang <= 3) return 'OPERATOR'  // 1-3
  if (jenjang <= 6) return 'TEKNISI'   // 4-6
  return 'AHLI'                        // 7-9
}

export async function checkUpgradeScenario(
  nik: string,
  newJenjang: number,
  subklasifikasi: string
): Promise<UpgradeCheckResult> {
  // First, check if there's any pending KTA (not yet completed) with the same NIK
  const pendingKta = await prisma.kTARequest.findFirst({
    where: {
      nik,
      status: { in: ['DRAFT', 'FETCHED_FROM_SIKI', 'EDITED', 'WAITING_PAYMENT', 'UPGRADE_PENDING', 'READY_FOR_PUSAT'] }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (pendingKta) {
    // There's a pending KTA - cannot create new one
    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta: pendingKta,
      newJenjang,
      oldJenjang: parseInt(pendingKta.jenjang, 10),
      hargaBaru: newJenjang >= 7 ? 300000 : 100000,
      hargaLama: 0,
      hargaUpgrade: 0,
      reason: `Anda memiliki permohonan KTA yang sedang diproses (Status: ${pendingKta.status}). Selesaikan terlebih dahulu sebelum membuat permohonan baru.`
    }
  }

  // Get existing completed KTA (only fully printed ones count for upgrade)
  const existingKta = await prisma.kTARequest.findFirst({
    where: {
      nik,
      status: { in: ['READY_TO_PRINT', 'PRINTED'] }
    },
    orderBy: { jenjang: 'desc' }  // Get highest jenjang first
  })

  if (!existingKta) {
    // No existing completed KTA - new application
    return {
      isUpgrade: false,
      canUpgrade: true,
      existingKta: null,
      newJenjang,
      oldJenjang: null,
      hargaBaru: newJenjang >= 7 ? 300000 : 100000,
      hargaLama: 0,
      hargaUpgrade: newJenjang >= 7 ? 300000 : 100000
    }
  }

  const oldJenjang = parseInt(existingKta.jenjang, 10)
  const newJenjangNum = newJenjang

  // Check jenjang category
  const oldCategory = getJenjangCategory(oldJenjang)
  const newCategory = getJenjangCategory(newJenjangNum)

  // Same jenjang -> ERROR
  if (oldJenjang === newJenjangNum) {
    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta,
      newJenjang: newJenjangNum,
      oldJenjang,
      hargaBaru: newJenjangNum >= 7 ? 300000 : 100000,
      hargaLama: oldJenjang >= 7 ? 300000 : 100000,
      hargaUpgrade: 0,
      reason: `Anda sudah memiliki KTA jenjang ${oldJenjang}. Tidak bisa membuat KTA dengan jenjang yang sama.`
    }
  }

  // Same category but not higher jenjang -> ERROR
  if (oldCategory === newCategory && newJenjangNum < oldJenjang) {
    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta,
      newJenjang: newJenjangNum,
      oldJenjang,
      hargaBaru: newJenjangNum >= 7 ? 300000 : 100000,
      hargaLama: oldJenjang >= 7 ? 300000 : 100000,
      hargaUpgrade: 0,
      reason: `Anda sudah memiliki KTA jenjang ${oldJenjang} (${oldCategory}). Tidak bisa downgrade ke jenjang ${newJenjangNum}.`
    }
  }

  // Lower category -> ERROR (downgrade not allowed)
  if (newJenjangNum < oldJenjang) {
    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta,
      newJenjang: newJenjangNum,
      oldJenjang,
      hargaBaru: newJenjangNum >= 7 ? 300000 : 100000,
      hargaLama: oldJenjang >= 7 ? 300000 : 100000,
      hargaUpgrade: 0,
      reason: `Anda sudah memiliki KTA jenjang ${oldJenjang} (${oldCategory}). Tidak bisa downgrade ke jenjang ${newJenjangNum}.`
    }
  }

  // Valid upgrade - calculate price
  const hargaBaru = newJenjangNum >= 7 ? 300000 : 100000
  const hargaLama = oldJenjang >= 7 ? 300000 : 100000
  const hargaUpgrade = hargaBaru - hargaLama

  return {
    isUpgrade: true,
    canUpgrade: true,
    existingKta,
    newJenjang: newJenjangNum,
    oldJenjang,
    hargaBaru,
    hargaLama,
    hargaUpgrade
  }
}
