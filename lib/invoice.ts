import { prisma } from '@/lib/prisma'

const INVOICE_PREFIX = 'INV/KTA-GATENSI/'

// Format: INV/KTA-GATENSI/[yymm]/[urut-3digit-dari-001]
// Contoh: INV/KTA-GATENSI/2608/001
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const monthPrefix = `${INVOICE_PREFIX}${yy}${mm}/`

  const lastInvoice = await prisma.bulkPayment.findFirst({
    where: { invoiceNumber: { startsWith: monthPrefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true }
  })

  let sequence = 1
  if (lastInvoice?.invoiceNumber) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('/').pop() || '0', 10)
    if (!isNaN(lastSeq)) sequence = lastSeq + 1
  }

  return `${monthPrefix}${String(sequence).padStart(3, '0')}`
}
