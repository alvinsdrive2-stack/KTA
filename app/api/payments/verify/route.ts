import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { KTAPDFGenerator } from '@/lib/pdf-generator'

export const dynamic = 'force-dynamic'

// Helper function to generate nomorKTA
async function generateNomorKTA(daerahId: string, jenjang: string): Promise<string> {
  // Determine jenjang code: 01 for jenjang > 6, 02 for jenjang <= 6
  const jenjangNum = parseInt(jenjang, 10)
  const jenjangCode = jenjangNum > 6 ? '01' : '02'

  // Get daerah kode
  const daerah = await prisma.daerah.findUnique({
    where: { id: daerahId },
    select: { kodeDaerah: true }
  })

  if (!daerah) {
    throw new Error('Daerah not found')
  }

  // Count existing KTAs with the same daerah and jenjang code
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

  console.log(`🎫 Generated nomorKTA: ${nomorKTA} (daerah=${daerah.kodeDaerah}, jenjang=${jenjang}, code=${jenjangCode}, sequence=${sequence})`)

  return nomorKTA
}

// Helper function to generate KTA PDF directly
async function generateKTAPDF(ktaId: string) {
  console.log(`📄 Starting PDF generation for KTA: ${ktaId}`)

  try {
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: ktaId },
      include: {
        daerah: {
          select: {
            id: true,
            kodeDaerah: true,
            namaDaerah: true
          }
        }
      }
    })

    if (!ktaRequest) {
      throw new Error('KTA not found')
    }

    // Skip if already generated
    if (ktaRequest.kartuGeneratedPath && ktaRequest.nomorKTA) {
      console.log(`⏭️  KTA ${ktaId} already has PDF: ${ktaRequest.nomorKTA}`)
      return
    }

    // Generate nomorKTA if not exists
    let nomorKTA = ktaRequest.nomorKTA
    if (!nomorKTA) {
      console.log(`🔢 Generating nomorKTA for daerahId=${ktaRequest.daerahId}, jenjang=${ktaRequest.jenjang}`)
      nomorKTA = await generateNomorKTA(ktaRequest.daerahId, ktaRequest.jenjang)
      console.log(`✅ Generated nomorKTA for ${ktaRequest.nama}: ${nomorKTA}`)
    }

    // Generate QR code path if not exists
    let qrCodePath = ktaRequest.qrCodePath
    if (!qrCodePath) {
      qrCodePath = '/qr-placeholder.png'
    }

    // Prepare data for PDF generation
    const ktaData = {
      id: ktaRequest.id,
      idIzin: ktaRequest.idIzin,
      nama: ktaRequest.nama,
      nik: ktaRequest.nik,
      jabatanKerja: ktaRequest.jabatanKerja,
      subklasifikasi: ktaRequest.subklasifikasi || '-',
      jenjang: ktaRequest.jenjang,
      noTelp: ktaRequest.noTelp,
      email: ktaRequest.email,
      alamat: ktaRequest.alamat,
      tanggalDaftar: ktaRequest.tanggalDaftar,
      qrCodePath: qrCodePath,
      daerahNama: ktaRequest.daerah.namaDaerah,
      fotoUrl: ktaRequest.fotoUrl || undefined,
      tanggalTerbit: new Date(),
      tanggalBerlaku: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000)
    }

    console.log(`🎨 Generating PDF for ${nomorKTA} - ${ktaRequest.nama}`)

    // Generate PDF
    const pdfPath = await KTAPDFGenerator.generateKTACard(ktaData)

    console.log(`✅ PDF generated: ${pdfPath}`)

    // Update KTARequest
    await prisma.kTARequest.update({
      where: { id: ktaId },
      data: {
        nomorKTA,
        kartuGeneratedPath: pdfPath,
        qrCodePath,
        status: 'READY_TO_PRINT'
      }
    })

    console.log(`💾 Updated KTA ${ktaId} in database with nomorKTA and PDF path`)
  } catch (error) {
    console.error(`❌ Error generating PDF for KTA ${ktaId}:`, error)
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

      // Generate nomorKTA and PDFs for all KTAs - DO THIS SYNCHRONOUSLY
      console.log(`🎨 Starting PDF generation for ${ktaIds.length} KTAs...`)
      const pdfPromises = ktaIds.map(ktaId => generateKTAPDF(ktaId))

      // Wait for all PDFs to be generated
      const results = await Promise.allSettled(pdfPromises)

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ Failed to generate PDF for KTA ${ktaIds[index]}:`, result.reason)
        }
      })

      console.log(`✅ Generated ${succeeded} KTA PDFs for bulk payment ${bulkPayment.invoiceNumber}${failed > 0 ? ` (${failed} failed)` : ''}`)
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