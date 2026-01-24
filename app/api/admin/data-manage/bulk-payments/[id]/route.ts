import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Fetch single Bulk Payment by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Only ADMIN can access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    const bulkPayment = await prisma.bulkPayment.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        invoiceNumber: true,
        daerahId: true,
        totalJumlah: true,
        totalNominal: true,
        buktiPembayaranUrl: true,
        status: true,
        verifiedBy: true,
        verifiedAt: true,
        submittedBy: true,
        isEnrolment: true,
        keterangan: true,
        midtransToken: true,
        midtransRedirectUrl: true,
        midtransTransactionId: true,
        midtransPaymentType: true,
        createdAt: true,
        updatedAt: true,
        daerah: {
          select: {
            id: true,
            namaDaerah: true,
            kodeDaerah: true,
          },
        },
        submittedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        verifiedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          select: {
            id: true,
            invoiceNumber: true,
            ktaRequestId: true,
            jumlah: true,
            statusPembayaran: true,
            paidAt: true,
            createdAt: true,
            ktaRequest: {
              select: {
                id: true,
                idIzin: true,
                nama: true,
                jenjang: true,
              },
            },
          },
        },
      },
    })

    if (!bulkPayment) {
      return NextResponse.json(
        { success: false, error: 'Bulk Payment tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: bulkPayment })
  } catch (error) {
    console.error('Get bulk payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PATCH - Update Bulk Payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Only ADMIN can access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      invoiceNumber,
      daerahId,
      totalJumlah,
      totalNominal,
      buktiPembayaranUrl,
      status,
      verifiedBy,
      isEnrolment,
      keterangan,
    } = body

    // Check if Bulk Payment exists
    const existingBulkPayment = await prisma.bulkPayment.findUnique({
      where: { id: params.id },
    })

    if (!existingBulkPayment) {
      return NextResponse.json(
        { success: false, error: 'Bulk Payment tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if invoiceNumber is being changed and already exists
    if (invoiceNumber && invoiceNumber !== existingBulkPayment.invoiceNumber) {
      const invoiceExists = await prisma.bulkPayment.findUnique({
        where: { invoiceNumber },
      })

      if (invoiceExists) {
        return NextResponse.json(
          { success: false, error: 'Nomor invoice sudah terdaftar' },
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (invoiceNumber) updateData.invoiceNumber = invoiceNumber
    if (daerahId) updateData.daerahId = daerahId
    if (totalJumlah !== undefined) updateData.totalJumlah = totalJumlah
    if (totalNominal !== undefined) updateData.totalNominal = totalNominal
    if (buktiPembayaranUrl) updateData.buktiPembayaranUrl = buktiPembayaranUrl
    if (status) {
      updateData.status = status as PaymentStatus
      // Set verified timestamp if status is being changed to VERIFIED
      if (status === PaymentStatus.VERIFIED && !existingBulkPayment.verifiedAt) {
        updateData.verifiedAt = new Date()
        updateData.verifiedBy = user.id
      }
    }
    if (verifiedBy) updateData.verifiedBy = verifiedBy
    if (isEnrolment !== undefined) updateData.isEnrolment = isEnrolment
    if (keterangan !== undefined) updateData.keterangan = keterangan

    const updatedBulkPayment = await prisma.bulkPayment.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        invoiceNumber: true,
        daerahId: true,
        totalJumlah: true,
        totalNominal: true,
        status: true,
        verifiedAt: true,
        isEnrolment: true,
        keterangan: true,
        createdAt: true,
        updatedAt: true,
        daerah: {
          select: {
            namaDaerah: true,
            kodeDaerah: true,
          },
        },
        submittedByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedBulkPayment })
  } catch (error) {
    console.error('Update bulk payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE - Delete Bulk Payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Only ADMIN can access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    // Check if Bulk Payment exists
    const existingBulkPayment = await prisma.bulkPayment.findUnique({
      where: { id: params.id },
      include: {
        payments: true,
      },
    })

    if (!existingBulkPayment) {
      return NextResponse.json(
        { success: false, error: 'Bulk Payment tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if bulk payment has linked payments
    if (existingBulkPayment.payments.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak dapat menghapus bulk payment yang memiliki pembayaran terkait' },
        { status: 400 }
      )
    }

    await prisma.bulkPayment.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: 'Bulk Payment berhasil dihapus' })
  } catch (error) {
    console.error('Delete bulk payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
