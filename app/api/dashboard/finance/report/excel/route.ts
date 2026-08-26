import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Workbook } from 'exceljs'
import { getPeriodRange } from '@/lib/finance-period'

export const dynamic = 'force-dynamic'

const NAVY = 'FF0B1C3D'
const DARK = 'FF333333'
const LIGHT = 'FFF5F7FA'
const BORDER = 'FFD9D9D9'
const WHITE = 'FFFFFFFF'

const formatDate = (d: Date | string) => {
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const kualifikasiLabel = (jenjang: string | null) => {
  const n = parseInt(jenjang || '', 10)
  if (n >= 1 && n <= 3) return 'Operator'
  if (n >= 4 && n <= 6) return 'Teknisi/Analis'
  if (n >= 7 && n <= 9) return 'Ahli'
  return jenjang || '-'
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'KEUANGAN', 'PUSAT', 'DAERAH']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    const fallback = getPeriodRange('ytd')
    const start = startStr && endStr
      ? new Date(`${startStr}T00:00:00`)
      : fallback.start
    const end = startStr && endStr
      ? new Date(`${endStr}T23:59:59.999`)
      : fallback.end

    const isDaerah = session.user.role === 'DAERAH'

    // Scope: DAERAH hanya lihat daerah sendiri; lainnya bisa semua (opsional filter daerahKode)
    let daerahWhere: any = {}
    if (isDaerah && session.user.daerahId) {
      daerahWhere.daerahId = session.user.daerahId
    } else {
      const daerahKode = searchParams.get('daerahKode')
      if (daerahKode) {
        const daerah = await prisma.daerah.findUnique({
          where: { kodeDaerah: daerahKode },
          select: { id: true }
        })
        if (daerah) daerahWhere.daerahId = daerah.id
      }
    }

    const bulkPayments = await prisma.bulkPayment.findMany({
      where: {
        ...daerahWhere,
        createdAt: { gte: start, lte: end },
      },
      include: {
        daerah: {
          select: { namaDaerah: true, kodeDaerah: true }
        },
        payments: {
          include: {
            ktaRequest: {
              select: {
                idIzin: true,
                nama: true,
                nik: true,
                jenjang: true,
                hargaBase: true,
                hargaFinal: true,
                isUpgrade: true,
                upgradeFromKtaId: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // KTA asal buat line upgrade (base = hargaBase - hargaBase KTA sebelumnya)
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

    // Flatten per-asesi rows
    const rows: Array<{
      no: number
      invoice: string
      tanggal: string
      daerah: string
      idIzin: string
      nik: string
      nama: string
      jenjang: string
      harga: number
      diskon: number
      bayar: number
    }> = []

    let no = 1
    for (const bp of bulkPayments) {
      for (const p of bp.payments) {
        const k = p.ktaRequest
        const base = k.isUpgrade && k.upgradeFromKtaId
          ? (k.hargaBase || 0) - (prevBaseMap.get(k.upgradeFromKtaId) || 0)
          : (k.hargaBase || 0)
        const bayar = p.jumlah || 0
        rows.push({
          no: no++,
          invoice: bp.invoiceNumber,
          tanggal: formatDate(bp.createdAt),
          daerah: bp.daerah?.namaDaerah || '-',
          idIzin: k.idIzin || '-',
          nik: k.nik || '-',
          nama: k.nama || '-',
          jenjang: kualifikasiLabel(k.jenjang),
          harga: base,
          diskon: Math.max(0, base - bayar),
          bayar,
        })
      }
    }

    const totalHarga = rows.reduce((s, r) => s + r.harga, 0)
    const totalDiskon = rows.reduce((s, r) => s + r.diskon, 0)
    const totalBayar = rows.reduce((s, r) => s + r.bayar, 0)

    // Porsi persen buat info di sheet daerah
    let porsiPersen = 0
    if (isDaerah && session.user.daerahId) {
      const daerahInfo = await prisma.daerah.findUnique({
        where: { id: session.user.daerahId },
        select: { diskonPersen: true }
      })
      porsiPersen = daerahInfo?.diskonPersen || 0
    }

    // ===== Build Excel =====
    const wb = new Workbook()
    const ws = wb.addWorksheet(isDaerah ? 'Porsi BPD' : 'Laporan Keuangan')

    // Layout beda per role: DAERAH drop kolom Daerah & cuma satu kolom Porsi (isi diskon)
    const cols = isDaerah
      ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
    const colCount = cols.length
    const lastCol = cols[colCount - 1]

    ws.columns = isDaerah
      ? [{ width: 5 }, { width: 24 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 28 }, { width: 16 }, { width: 16 }]
      : [{ width: 5 }, { width: 24 }, { width: 14 }, { width: 24 }, { width: 16 }, { width: 18 }, { width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }]

    const box = (cell: any) => {
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER } },
        left: { style: 'thin', color: { argb: BORDER } },
        bottom: { style: 'thin', color: { argb: BORDER } },
        right: { style: 'thin', color: { argb: BORDER } },
      }
    }

    const headerCell = (cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: WHITE } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      box(cell)
    }

    let row = 1

    // Title
    ws.mergeCells(`A${row}:${lastCol}${row}`)
    const titleCell = ws.getCell(`A${row}`)
    titleCell.value = isDaerah ? 'LAPORAN PORSI BPD' : 'LAPORAN KEUANGAN'
    titleCell.font = { name: 'Helvetica', size: 18, bold: true, color: { argb: NAVY } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 30
    row++

    ws.mergeCells(`A${row}:${lastCol}${row}`)
    const orgCell = ws.getCell(`A${row}`)
    orgCell.value = 'Gabungan Ahli Teknik Nasional Indonesia (GATENSI)'
    orgCell.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: DARK } }
    orgCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 20
    row++

    row++ // spacer

    // Filter info
    ws.mergeCells(`A${row}:${lastCol}${row}`)
    ws.getCell(`A${row}`).value = `Periode: ${formatDate(start)} — ${formatDate(end)}`
    ws.getCell(`A${row}`).font = { name: 'Helvetica', size: 10, bold: true, color: { argb: NAVY } }
    ws.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(row).height = 18
    row++

    const daeraLabel = isDaerah
      ? bulkPayments[0]?.daerah?.namaDaerah || '-'
      : (searchParams.get('daerahKode') ? `Kode ${searchParams.get('daerahKode')}` : 'Semua Daerah')
    ws.mergeCells(`A${row}:${lastCol}${row}`)
    ws.getCell(`A${row}`).value = isDaerah
      ? `Daerah: ${daeraLabel}  •  Porsi BPD: ${porsiPersen}%`
      : `Daerah: ${daeraLabel}`
    ws.getCell(`A${row}`).font = { name: 'Helvetica', size: 10, bold: true, color: { argb: NAVY } }
    ws.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(row).height = 18
    row++

    row++ // spacer

    // Kolom numerik mulai dari index ini
    const numericStart = isDaerah ? 7 : 8

    // Table header
    const headers = isDaerah
      ? ['No', 'No. Invoice', 'Tanggal', 'ID Izin', 'NIK', 'Nama', 'Kualifikasi', 'Porsi']
      : ['No', 'No. Invoice', 'Tanggal', 'Daerah', 'ID Izin', 'NIK', 'Nama', 'Kualifikasi', 'Harga', 'Diskon (Porsi)', 'Total Bayar']
    cols.forEach((col, i) => {
      const cell = ws.getCell(`${col}${row}`)
      cell.value = headers[i]
      headerCell(cell)
    })
    ws.getRow(row).height = 24
    const headerRow = row
    row++

    // Data rows
    rows.forEach((r) => {
      const values: (string | number)[] = isDaerah
        ? [r.no, r.invoice, r.tanggal, r.idIzin, r.nik, r.nama, r.jenjang, r.diskon]
        : [r.no, r.invoice, r.tanggal, r.daerah, r.idIzin, r.nik, r.nama, r.jenjang, r.harga, r.diskon, r.bayar]
      cols.forEach((col, i) => {
        const cell = ws.getCell(`${col}${row}`)
        cell.value = values[i]
        cell.font = { name: 'Helvetica', size: 9, color: { argb: DARK } }
        cell.alignment = {
          horizontal: i >= numericStart ? 'right' : (i === 0 ? 'center' : 'left'),
          vertical: 'middle',
          wrapText: true,
        }
        box(cell)
        if (i >= numericStart) cell.numFmt = '#,##0'
      })
      ws.getRow(row).height = 18
      row++
    })

    // Total row
    const totalRowStart = row
    // Kolom merge buat label total: A..G (7) buat daerah, A..H (8) buat lainnya
    const totalMergeCount = isDaerah ? 7 : 8
    ws.mergeCells(`A${row}:${cols[totalMergeCount - 1]}${row}`)
    const totalLabel = ws.getCell(`A${row}`)
    totalLabel.value = isDaerah ? 'TOTAL PORSI BPD' : 'TOTAL'
    totalLabel.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: WHITE } }
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' }

    const totalValues = isDaerah ? [totalDiskon] : [totalHarga, totalDiskon, totalBayar]
    const totalCols = cols.slice(totalMergeCount)
    totalCols.forEach((col, i) => {
      const cell = ws.getCell(`${col}${row}`)
      cell.value = totalValues[i]
      cell.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: WHITE } }
      cell.numFmt = '#,##0'
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
      box(cell)
    })
    for (let c = 0; c < colCount; c++) {
      const cell = ws.getCell(`${cols[c]}${totalRowStart}`)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      if (c < totalMergeCount) box(cell)
      if (c >= totalMergeCount) cell.border = { ...cell.border, left: { style: 'thin', color: { argb: NAVY } }, right: { style: 'thin', color: { argb: NAVY } } }
    }
    ws.getRow(row).height = 22

    // Auto filter di header tabel biar gampang disortir di Excel
    if (rows.length > 0) {
      ws.autoFilter = { from: `A${headerRow}`, to: `${lastCol}${row}` }
    }

    const buffer = await wb.xlsx.writeBuffer()

    const filename = isDaerah
      ? (startStr && endStr ? `laporan-porsi-bpd-${startStr}-${endStr}.xlsx` : `laporan-porsi-bpd.xlsx`)
      : (startStr && endStr ? `laporan-keuangan-${startStr}-${endStr}.xlsx` : `laporan-keuangan.xlsx`)

    return new NextResponse(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating finance report Excel:', error)
    return NextResponse.json(
      { error: 'Failed to generate finance report Excel' },
      { status: 500 }
    )
  }
}
