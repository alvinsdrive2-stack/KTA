import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Fetch all Payments
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const daerahId = searchParams.get('daerahId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { ktaRequest: { nama: { contains: search } } },
        { ktaRequest: { idIzin: { contains: search } } },
      ]
    }
    if (status) {
      where.statusPembayaran = status as PaymentStatus
    }
    if (daerahId) {
      where.ktaRequest = {
        daerahId: daerahId,
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
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
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get payments error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST - Create new Payment
export async function POST(request: NextRequest) {
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
      ktaRequestId,
      invoiceNumber,
      rekeningTujuan,
      jumlah,
      buktiBayarLink,
      statusPembayaran,
      bulkPaymentId,
    } = body

    // Validation
    if (!ktaRequestId || !invoiceNumber || !rekeningTujuan || !jumlah) {
      return NextResponse.json(
        { success: false, error: 'KTA Request ID, invoice number, rekening tujuan, dan jumlah harus diisi' },
        { status: 400 }
      )
    }

    // Check if KTA Request exists
    const existingKTARequest = await prisma.kTARequest.findUnique({
      where: { id: ktaRequestId },
    })

    if (!existingKTARequest) {
      return NextResponse.json(
        { success: false, error: 'KTA Request tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if invoiceNumber already exists
    const existingPayment = await prisma.payment.findUnique({
      where: { invoiceNumber },
    })

    if (existingPayment) {
      return NextResponse.json(
        { success: false, error: 'Nomor invoice sudah terdaftar' },
        { status: 400 }
      )
    }

    // Generate invoice number if not provided
    const finalInvoiceNumber = invoiceNumber || `INV-${Date.now()}`

    // Create Payment
    const newPayment = await prisma.payment.create({
      data: {
        ktaRequestId,
        invoiceNumber: finalInvoiceNumber,
        rekeningTujuan,
        jumlah,
        buktiBayarLink: buktiBayarLink || null,
        statusPembayaran: statusPembayaran || PaymentStatus.PENDING,
        bulkPaymentId: bulkPaymentId || null,
      },
      select: {
        id: true,
        ktaRequestId: true,
        invoiceNumber: true,
        rekeningTujuan: true,
        jumlah: true,
        buktiBayarLink: true,
        statusPembayaran: true,
        bulkPaymentId: true,
        createdAt: true,
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

    return NextResponse.json({ success: true, data: newPayment }, { status: 201 })
  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
