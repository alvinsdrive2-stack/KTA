import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Fetch all Bulk Payments
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
        { invoiceNumber: { contains: search} },
        { keterangan: { contains: search } },
      ]
    }
    if (status) {
      where.status = status as PaymentStatus
    }
    if (daerahId) {
      where.daerahId = daerahId
    }

    const [bulkPayments, total] = await Promise.all([
      prisma.bulkPayment.findMany({
        where,
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
          _count: {
            select: {
              payments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bulkPayment.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: bulkPayments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get bulk payments error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST - Create new Bulk Payment
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
      invoiceNumber,
      daerahId,
      totalJumlah,
      totalNominal,
      buktiPembayaranUrl,
      status,
      isEnrolment,
      keterangan,
    } = body

    // Validation
    if (!invoiceNumber || !daerahId || !totalJumlah || !totalNominal || !buktiPembayaranUrl) {
      return NextResponse.json(
        { success: false, error: 'Invoice number, daerah, jumlah, nominal, dan bukti pembayaran harus diisi' },
        { status: 400 }
      )
    }

    // Check if invoiceNumber already exists
    const existingBulkPayment = await prisma.bulkPayment.findUnique({
      where: { invoiceNumber },
    })

    if (existingBulkPayment) {
      return NextResponse.json(
        { success: false, error: 'Nomor invoice sudah terdaftar' },
        { status: 400 }
      )
    }

    // Generate invoice number if not provided
    const finalInvoiceNumber = invoiceNumber || `BLK-${Date.now()}`

    // Create Bulk Payment
    const newBulkPayment = await prisma.bulkPayment.create({
      data: {
        invoiceNumber: finalInvoiceNumber,
        daerahId,
        totalJumlah,
        totalNominal,
        buktiPembayaranUrl,
        status: status || PaymentStatus.PENDING,
        submittedBy: user.id,
        isEnrolment: isEnrolment || false,
        keterangan: keterangan || null,
      },
      select: {
        id: true,
        invoiceNumber: true,
        daerahId: true,
        totalJumlah: true,
        totalNominal: true,
        status: true,
        isEnrolment: true,
        keterangan: true,
        createdAt: true,
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

    return NextResponse.json({ success: true, data: newBulkPayment }, { status: 201 })
  } catch (error) {
    console.error('Create bulk payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
