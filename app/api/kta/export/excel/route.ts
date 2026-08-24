import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const statusParams = searchParams.getAll('status')

    // Build where clause
    const where: any = {}

    // Status filter - only verified statuses
    if (statusParams.length > 0) {
      where.status = { in: statusParams }
    } else {
      // Default to verified statuses
      where.status = { in: ['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED'] }
    }

    // Date filter (tanggal daftar anggota)
    if (startDate || endDate) {
      where.tanggalDaftar = {}
      if (startDate) where.tanggalDaftar.gte = new Date(startDate)
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        where.tanggalDaftar.lte = endDateTime
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { idIzin: { contains: search } },
        { nik: { contains: search } },
      ]
    }

    // Access control
    const userRole = session.user.role
    const isPusatOrAdmin = userRole === 'PUSAT' || userRole === 'ADMIN' || userRole === 'KEUANGAN'

    if (!isPusatOrAdmin && session.user.daerahId) {
      where.daerahId = session.user.daerahId
    }

    // Fetch KTA data with relations
    const ktaRequests = await prisma.kTARequest.findMany({
      where,
      include: {
        daerah: {
          select: {
            namaDaerah: true,
            kodeDaerah: true,
          }
        },
        payments: {
          include: {
            bulkPayment: {
              select: {
                invoiceNumber: true,
                status: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Generate CSV content
    const headers = [
      'No',
      'Nomor KTA',
      'Nama Lengkap',
      'NIK',
      'ID Izin',
      'Jenjang',
      'Jabatan Kerja',
      'Subklasifikasi',
      'No. Telepon',
      'Email',
      'Alamat',
      'Tanggal Daftar',
      'Expired Date',
      'Daerah',
      'No. Invoice',
    ]

    // Helper function to escape CSV fields
    const escapeCSV = (field: any) => {
      if (field === null || field === undefined) return '""'
      const str = String(field)
      // If field contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = ktaRequests.map((kta, index) => {
      const invoiceNumber = kta.payments?.[0]?.bulkPayment?.invoiceNumber || '-'

      return [
        index + 1,
        kta.nomorKTA || '-',
        kta.nama,
        `'${kta.nik}`, // Add ' to prevent Excel from treating as number
        kta.idIzin,
        kta.jenjang,
        kta.jabatanKerja,
        kta.subklasifikasi || '-',
        `'${kta.noTelp}`, // Add ' to prevent Excel from treating as number
        kta.email,
        kta.alamat,
        new Date(kta.tanggalDaftar).toLocaleDateString('id-ID'),
        new Date(new Date(kta.tanggalDaftar).setFullYear(new Date(kta.tanggalDaftar).getFullYear() + 5)).toLocaleDateString('id-ID'),
        kta.daerah?.namaDaerah || '-',
        invoiceNumber,
      ].map(escapeCSV)
    })

    // Combine headers and rows
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    // Add UTF-8 BOM for Excel to recognize special characters
    const bom = '\uFEFF'
    const csvWithBom = bom + csvContent

    // Return as downloadable file
    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="data_anggota_kta.csv"',
      },
    })

  } catch (error) {
    console.error('Export Excel error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
