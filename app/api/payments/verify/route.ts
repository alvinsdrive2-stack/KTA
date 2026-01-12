import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// Helper function to generate nomorKTA
async function generateNomorKTA(daerahId: string, jenjang: string): Promise<string> {
  // Determine jenjang category code based on jenjang level
  // 1-3: Operator (03), 4-6: Teknisi (02), 7-9: Ahli (01)
  const jenjangNum = parseInt(jenjang, 10)
  let jenjangCode: string
  let jenjangCategory: string

  if (jenjangNum >= 1 && jenjangNum <= 3) {
    jenjangCode = '03'
    jenjangCategory = 'Operator'
  } else if (jenjangNum >= 4 && jenjangNum <= 6) {
    jenjangCode = '02'
    jenjangCategory = 'Teknisi'
  } else if (jenjangNum >= 7 && jenjangNum <= 9) {
    jenjangCode = '01'
    jenjangCategory = 'Ahli'
  } else {
    throw new Error(`Invalid jenjang: ${jenjang}. Must be between 1-9.`)
  }

  // Get daerah kode
  const daerah = await prisma.daerah.findUnique({
    where: { id: daerahId },
    select: { kodeDaerah: true }
  })

  if (!daerah) {
    throw new Error('Daerah not found')
  }

  // Count existing KTAs with the same daerah and jenjang category code
  const existingCount = await prisma.kTARequest.count({
    where: {
      daerahId,
      nomorKTA: {
        contains: `${daerah.kodeDaerah}.${jenjangCode}.`
      }
    }
  })

  // Generate sequence number (6 digits, padded with zeros)
  const sequence = String(existingCount + 1).padStart(6, '0')
  const nomorKTA = `${daerah.kodeDaerah}.${jenjangCode}.${sequence}`

  console.log(`🎫 Generated nomorKTA: ${nomorKTA} (daerah=${daerah.kodeDaerah}, jenjang=${jenjang}, category=${jenjangCategory}, code=${jenjangCode}, sequence=${sequence})`)

  return nomorKTA
}

// Helper function to generate nomorKTA for a KTA (PDF will be generated on-demand)
async function prepareKTAForPrint(ktaId: string) {
  console.log(`📄 Preparing KTA for print: ${ktaId}`)

  try {
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: ktaId },
      select: {
        id: true,
        nomorKTA: true,
        daerahId: true,
        jenjang: true,
        nama: true,
        status: true
      }
    })

    if (!ktaRequest) {
      throw new Error('KTA not found')
    }

    // Skip if already has nomorKTA
    if (ktaRequest.nomorKTA && ktaRequest.status === 'READY_TO_PRINT') {
      console.log(`⏭️  KTA ${ktaId} already ready: ${ktaRequest.nomorKTA}`)
      return
    }

    // Generate nomorKTA if not exists
    let nomorKTA = ktaRequest.nomorKTA
    if (!nomorKTA) {
      console.log(`🔢 Generating nomorKTA for daerahId=${ktaRequest.daerahId}, jenjang=${ktaRequest.jenjang}`)
      nomorKTA = await generateNomorKTA(ktaRequest.daerahId, ktaRequest.jenjang)
      console.log(`✅ Generated nomorKTA for ${ktaRequest.nama}: ${nomorKTA}`)
    }

    // Update KTARequest - PDF will be generated on-demand when downloaded
    await prisma.kTARequest.update({
      where: { id: ktaId },
      data: {
        nomorKTA,
        status: 'READY_TO_PRINT'
      }
    })

    console.log(`💾 Updated KTA ${ktaId} - PDF will be generated on-demand`)
  } catch (error) {
    console.error(`❌ Error preparing KTA ${ktaId}:`, error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only PUSAT and ADMIN can verify payments
    if (session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { bulkPaymentId, approved, reason } = await request.json()

    if (!bulkPaymentId) {
      return NextResponse.json({ error: 'Bulk payment ID is required' }, { status: 400 })
    }

    // Get the bulk payment with its payments
    const bulkPayment = await prisma.bulkPayment.findUnique({
      where: { id: bulkPaymentId },
      include: {
        payments: {
          include: {
            ktaRequest: true
          }
        }
      }
    })

    if (!bulkPayment) {
      return NextResponse.json({ error: 'Bulk payment not found' }, { status: 404 })
    }

    // Update bulk payment status
    const updatedBulkPayment = await prisma.bulkPayment.update({
      where: { id: bulkPaymentId },
      data: {
        status: approved ? 'VERIFIED' : 'REJECTED',
        verifiedBy: session.user.id,
        verifiedAt: new Date()
      }
    })

    // Update all related payment records
    await prisma.payment.updateMany({
      where: { bulkPaymentId },
      data: {
        statusPembayaran: approved ? 'PAID' : 'REJECTED',
        paidAt: approved ? new Date() : null
      }
    })

    // If approved, update KTA requests status and generate PDFs
    if (approved) {
      const ktaIds = bulkPayment.payments.map(p => p.ktaRequestId)
      console.log(`🔐 Approving bulk payment ${bulkPayment.invoiceNumber} with ${ktaIds.length} KTAs`)

      await prisma.kTARequest.updateMany({
        where: {
          id: {
            in: ktaIds
          }
        },
        data: {
          status: 'APPROVED_BY_PUSAT'
        }
      })

      console.log(`✅ Updated KTA statuses to APPROVED_BY_PUSAT`)

      // Generate nomorKTA for all KTAs SEQUENTIALLY to avoid race condition on unique constraint
      console.log(`🎨 Preparing ${ktaIds.length} KTAs for print...`)
      let succeeded = 0
      let failed = 0

      for (const ktaId of ktaIds) {
        try {
          await prepareKTAForPrint(ktaId)
          succeeded++
        } catch (error) {
          console.error(`❌ Failed to prepare KTA ${ktaId}:`, error)
          failed++
        }
      }

      console.log(`✅ Prepared ${succeeded} KTAs for bulk payment ${bulkPayment.invoiceNumber}${failed > 0 ? ` (${failed} failed)` : ''}`)
    } else {
      // If rejected, reset KTA status to DRAFT
      await prisma.kTARequest.updateMany({
        where: {
          id: {
            in: bulkPayment.payments.map(p => p.ktaRequestId)
          }
        },
        data: {
          status: 'DRAFT'
        }
      })
    }

    // Create approval record for each KTA if approved
    if (approved) {
      const approvalPromises = bulkPayment.payments.map(payment =>
        prisma.approval.create({
          data: {
            ktaRequestId: payment.ktaRequestId,
            approvedBy: session.user.id,
            status: 'APPROVED',
            catatan: `Pembayaran verified - Invoice: ${bulkPayment.invoiceNumber}`
          }
        })
      )
      await Promise.all(approvalPromises)
    }

    return NextResponse.json({
      success: true,
      message: approved ? 'Pembayaran berhasil diverifikasi. KTA telah dibuat.' : 'Pembayaran ditolak',
      bulkPayment: updatedBulkPayment
    })

  } catch (error) {
    console.error('Verify payment error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}