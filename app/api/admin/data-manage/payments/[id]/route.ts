import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Fetch single Payment by ID
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

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        ktaRequestId: true,
        invoiceNumber: true,
        rekeningTujuan: true,
        jumlah: true,
        buktiBayarLink: true,
        statusPembayaran: true,
        paidAt: true,
        bulkPaymentId: true,
        createdAt: true,
        updatedAt: true,
        ktaRequest: {
          select: {
            id: true,
            idIzin: true,
            nama: true,
            jenjang: true,
            jabatanKerja: true,
            status: true,
            hargaFinal: true,
            daerahId: true,
            daerah: {
              select: {
                id: true,
                namaDaerah: true,
                kodeDaerah: true,
              },
            },
          },
        },
        bulkPayment: {
          select: {
            id: true,
            invoiceNumber: true,
            totalJumlah: true,
            totalNominal: true,
            status: true,
            daerah: {
              select: {
                namaDaerah: true,
                kodeDaerah: true,
              },
            },
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: payment })
  } catch (error) {
    console.error('Get payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PATCH - Update Payment
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
      rekeningTujuan,
      jumlah,
      buktiBayarLink,
      statusPembayaran,
      bulkPaymentId,
      paidAt,
    } = body

    // Check if Payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: params.id },
    })

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, error: 'Payment tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if invoiceNumber is being changed and already exists
    if (invoiceNumber && invoiceNumber !== existingPayment.invoiceNumber) {
      const invoiceExists = await prisma.payment.findUnique({
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
    if (rekeningTujuan) updateData.rekeningTujuan = rekeningTujuan
    if (jumlah !== undefined) updateData.jumlah = jumlah
    if (buktiBayarLink !== undefined) updateData.buktiBayarLink = buktiBayarLink
    if (statusPembayaran) {
      updateData.statusPembayaran = statusPembayaran as PaymentStatus
      // Set paid timestamp if status is being changed to PAID or VERIFIED
      if ((statusPembayaran === PaymentStatus.PAID || statusPembayaran === PaymentStatus.VERIFIED) && !existingPayment.paidAt) {
        updateData.paidAt = new Date()
      }
    }
    if (bulkPaymentId !== undefined) updateData.bulkPaymentId = bulkPaymentId || null
    if (paidAt !== undefined) updateData.paidAt = paidAt ? new Date(paidAt) : null

    const updatedPayment = await prisma.payment.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        ktaRequestId: true,
        invoiceNumber: true,
        rekeningTujuan: true,
        jumlah: true,
        buktiBayarLink: true,
        statusPembayaran: true,
        paidAt: true,
        bulkPaymentId: true,
        createdAt: true,
        updatedAt: true,
        ktaRequest: {
          select: {
            id: true,
            idIzin: true,
            nama: true,
            jenjang: true,
            daerah: {
              select: {
                namaDaerah: true,
                kodeDaerah: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedPayment })
  } catch (error) {
    console.error('Update payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE - Delete Payment
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

    // Check if Payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: params.id },
    })

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, error: 'Payment tidak ditemukan' },
        { status: 404 }
      )
    }

    await prisma.payment.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: 'Payment berhasil dihapus' })
  } catch (error) {
    console.error('Delete payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
