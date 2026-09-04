import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { Workbook } from 'exceljs'

export const dynamic = 'force-dynamic'

const NAVY = 'FF0B1C3D'
const BORDER = 'FFD9D9D9'

// Subklasifikasi korup hasil import legacy berisi kode (mis. BL003), bukan nama.
// Semantik kode tidak diketahui, jadi samarkan sampai data di-merge.
const isSubklasifikasiGarbage = (value: string | null | undefined) => {
  if (!value) return true
  return /^[a-z]{2}0*\d+$/i.test(value.trim())
}

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
        klasifikasi: {
          select: {
            subklasifikasi: true,
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

    const wb = new Workbook()
    const ws = wb.addWorksheet('Data Anggota KTA')

    const headers = [
      'No',
      'Nomor KTA',
      'Nama Lengkap',
      'NIK',
      'ID Izin',
      'Subklasifikasi',
      'Kualifikasi',
      'Jenjang',
      'Jabatan Kerja',
      'No. Telepon',
      'Email',
      'Alamat',
      'Tanggal Daftar',
      'Expired Date',
      'Daerah',
      'No. Invoice',
    ]

    // NIK (D) & No. Telepon (J) sebagai teks biar angka 0 di depan nggak kebuang
    ws.getColumn(4).numFmt = '@'
    ws.getColumn(10).numFmt = '@'

    const kualifikasiFromJenjang = (jenjang: string) => {
      const n = parseInt(jenjang, 10)
      if (n >= 1 && n <= 3) return 'Operator'
      if (n >= 4 && n <= 6) return 'Teknisi/Analis'
      if (n >= 7 && n <= 9) return 'Ahli'
      return '-'
    }

    const headerRow = ws.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER } },
        bottom: { style: 'thin', color: { argb: BORDER } },
        left: { style: 'thin', color: { argb: BORDER } },
        right: { style: 'thin', color: { argb: BORDER } },
      }
    })
    headerRow.height = 20

    const fmtDate = (d: Date) =>
      new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })

    ktaRequests.forEach((kta, index) => {
      const invoiceNumber = kta.payments?.[0]?.bulkPayment?.invoiceNumber || '-'
      const tanggalDaftar = new Date(kta.tanggalDaftar)
      const expired = new Date(tanggalDaftar)
      expired.setFullYear(expired.getFullYear() + 5)

      const subklasifikasi =
        kta.klasifikasi?.subklasifikasi ||
        (isSubklasifikasiGarbage(kta.subklasifikasi) ? '-' : kta.subklasifikasi!)

      const row = ws.addRow([
        index + 1,
        kta.nomorKTA || '-',
        kta.nama,
        kta.nik,
        kta.idIzin,
        subklasifikasi,
        kualifikasiFromJenjang(kta.jenjang),
        kta.jenjang,
        kta.jabatanKerja,
        kta.noTelp,
        kta.email,
        kta.alamat,
        fmtDate(tanggalDaftar),
        fmtDate(expired),
        kta.daerah?.namaDaerah || '-',
        invoiceNumber,
      ])
    })

    ws.columns.forEach((col) => {
      col.width = 18
    })
    ws.getColumn(1).width = 6
    ws.getColumn(3).width = 28
    ws.getColumn(6).width = 26
    ws.getColumn(9).width = 40
    ws.getColumn(12).width = 35

    ws.autoFilter = { from: 'A1', to: `P1` }
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="data_anggota_kta.xlsx"',
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
