import { prisma } from '@/lib/prisma'

// Hitung porsi (diskon) per bulkPayment. Porsi = max(0, base total - totalNominal).
// Base upgrade dihitung hargaBase - hargaBase KTA sebelumnya, karena hargaBase KTA upgrade
// udah termasuk harga KTA asal.
export async function getBulkPaymentsWithPorsi(where: any) {
  const bulkPayments = await prisma.bulkPayment.findMany({
    where,
    include: {
      payments: {
        include: {
          ktaRequest: {
            select: {
              hargaBase: true,
              isUpgrade: true,
              upgradeFromKtaId: true,
            }
          }
        }
      }
    }
  })

  const upgradeFromIds = Array.from(new Set(
    bulkPayments.flatMap(bp => bp.payments.map(p => p.ktaRequest.upgradeFromKtaId).filter(Boolean))
  )) as string[]

  const prevKtas = upgradeFromIds.length > 0
    ? await prisma.kTARequest.findMany({
        where: { id: { in: upgradeFromIds } },
        select: { id: true, hargaBase: true }
      })
    : []

  const prevBaseMap = new Map(prevKtas.map(k => [k.id, k.hargaBase || 0]))

  return bulkPayments.map(bp => {
    const invoiceBase = bp.payments.reduce((acc, p) => {
      const k = p.ktaRequest
      const effective = k.isUpgrade && k.upgradeFromKtaId
        ? (k.hargaBase || 0) - (prevBaseMap.get(k.upgradeFromKtaId) || 0)
        : (k.hargaBase || 0)
      return acc + effective
    }, 0)
    return {
      createdAt: bp.createdAt,
      status: bp.status,
      porsi: Math.max(0, invoiceBase - (bp.totalNominal || 0)),
    }
  })
}
