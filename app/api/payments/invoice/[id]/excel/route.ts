import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Workbook } from 'exceljs'
import { safeInvoiceFilename } from '@/lib/utils'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

// Warna (ARGB) mirip PDF
const NAVY = 'FF0B1C3D'
const DARK = 'FF333333'
const LIGHT = 'FFF5F7FA'
const BORDER = 'FFD9D9D9'
const WHITE = 'FFFFFFFF'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

const formatDate = (d: Date | string) => {
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const formatDateTime = (d: Date | string) => {
  return `${formatDate(d)} ${new Date(d).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  })}`
}

const terbilang = (nilai: number): string => {
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
  if (nilai < 12) return satuan[Math.floor(nilai)]
  if (nilai < 20) return satuan[Math.floor(nilai) - 10] + ' Belas'
  if (nilai < 100) return (Math.floor(nilai) / 10 >= 1 ? satuan[Math.floor(nilai / 10)] + ' Puluh ' : '') + (nilai % 10 > 0 ? satuan[nilai % 10] : '')
  if (nilai < 200) return 'Seratus ' + terbilang(nilai - 100)
  if (nilai < 1000) return (Math.floor(nilai) / 100 >= 1 ? satuan[Math.floor(nilai / 100)] + ' Ratus ' : '') + terbilang(nilai % 100)
  if (nilai < 2000) return 'Seribu ' + terbilang(nilai - 1000)
  if (nilai < 1000000) return (Math.floor(nilai) / 1000 >= 1 ? terbilang(Math.floor(nilai / 1000)) + ' Ribu ' : '') + terbilang(nilai % 1000)
  if (nilai < 1000000000) return (Math.floor(nilai) / 1000000 >= 1 ? terbilang(Math.floor(nilai / 1000000)) + ' Juta ' : '') + terbilang(nilai % 1000000)
  return nilai.toString()
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoice = await prisma.bulkPayment.findUnique({
      where: { id: params.id },
      include: {
        daerah: true,
        submittedByUser: {
          select: {
            name: true,
            email: true,
            role: true
          }
        },
        verifiedByUser: {
          select: {
            name: true
          }
        },
        payments: {
          include: {
            ktaRequest: {
              select: {
                idIzin: true,
                nama: true,
                nik: true,
                jenjang: true,
                jabatanKerja: true,
                hargaBase: true,
                hargaFinal: true,
                isUpgrade: true,
                upgradeFromKtaId: true
              }
            }
          },
          orderBy: {
            ktaRequest: {
              nama: 'asc'
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch previous KTA data for upgrades
    const upgradedKtaIds = invoice.payments
      .filter(p => p.ktaRequest.isUpgrade && p.ktaRequest.upgradeFromKtaId)
      .map(p => p.ktaRequest.upgradeFromKtaId!)

    let previousKtas: Record<string, { hargaBase: number; hargaFinal: number; jenjang: string }> = {}

    if (upgradedKtaIds.length > 0) {
      const prevKtas = await prisma.kTARequest.findMany({
        where: {
          id: { in: upgradedKtaIds }
        },
        select: {
          id: true,
          hargaBase: true,
          hargaFinal: true,
          jenjang: true
        }
      })

      previousKtas = prevKtas.reduce((acc, kta) => {
        acc[kta.id] = {
          hargaBase: kta.hargaBase || 0,
          hargaFinal: kta.hargaFinal || 0,
          jenjang: kta.jenjang
        }
        return acc
      }, {} as Record<string, { hargaBase: number; hargaFinal: number; jenjang: string }>)
    }

    const paymentsWithPrev = invoice.payments.map(p => {
      const prevData = p.ktaRequest.isUpgrade && p.ktaRequest.upgradeFromKtaId
        ? previousKtas[p.ktaRequest.upgradeFromKtaId]
        : null

      let effectiveHarga = p.ktaRequest.hargaBase || 0
      if (p.ktaRequest.isUpgrade && prevData) {
        effectiveHarga = (p.ktaRequest.hargaBase || 0) - prevData.hargaBase
      }

      return {
        ...p,
        ktaRequest: {
          ...p.ktaRequest,
          previousKta: prevData
        },
        effectiveHarga
      }
    })

    const totalHargaBase = paymentsWithPrev.reduce((sum, p) => sum + p.effectiveHarga, 0)
    const diskon = invoice.daerah.diskonPersen || 0
    const diskonAmount = Math.floor(totalHargaBase * diskon / 100)
    const totalTagihan = totalHargaBase - diskonAmount
    const isFree = diskon >= 100

    // Ditagihkan Kepada
    const isDaerah = invoice.submittedByUser.role === 'DAERAH'
    const billTo = isDaerah
      ? `Badan Pengurus Daerah ${invoice.daerah.namaDaerah}`
      : 'Badan Pengurus Pusat'

    // Info pembayaran
    const statusLabel: Record<string, string> = {
      VERIFIED: 'LUNAS',
      PAID: 'DIBAYAR',
      PENDING: 'MENUNGGU PEMBAYARAN',
      REJECTED: 'DITOLAK'
    }
    const paymentType = (invoice.midtransPaymentType || 'Bank Transfer').toUpperCase()
    const adminName = invoice.verifiedByUser?.name || invoice.submittedByUser.name
    const paymentTime = invoice.verifiedAt || invoice.createdAt

    // ================= WORKBOOK =================
    const wb = new Workbook()
    const ws = wb.addWorksheet('Invoice')

    // Layout: A(spacer) B(kiri) C(spacer) D(tengah) E(spacer) F(kanan)
    ws.columns = [
      { width: 4 },   // A
      { width: 30 },  // B - kiri (Metode Pembayaran)
      { width: 37 },  // C - tengah kiri (Terbilang)
      { width: 32 },  // D - tengah (Terbilang)
      { width: 24 },  // E - kanan label (Rincian Biaya)
      { width: 46 },  // F - kanan value (Rincian Biaya)
    ]

    const box = (cell: any, color: string = BORDER, weight: string = 'thin') => {
      cell.border = {
        top: { style: weight, color: { argb: color } },
        left: { style: weight, color: { argb: color } },
        bottom: { style: weight, color: { argb: color } },
        right: { style: weight, color: { argb: color } },
      }
    }

    const sectionBox = (cell: any) => {
      cell.border = {
        top: { style: 'thin', color: { argb: NAVY } },
        left: { style: 'thin', color: { argb: NAVY } },
        bottom: { style: 'thin', color: { argb: NAVY } },
        right: { style: 'thin', color: { argb: NAVY } },
      }
    }

    let row = 1

    // HEADER - INVOICE (1:1 sama PDF: judul besar kiri + logo kanan atas)
    ws.mergeCells(`A${row}:F${row}`)
    const invCell = ws.getCell(`A${row}`)
    invCell.value = 'INVOICE'
    invCell.font = { name: 'Helvetica', size: 36, bold: true, color: { argb: NAVY } }
    ws.getRow(row).height = 42
    row++

    // Logo kanan atas (sama PDF yang embed logo)
    let logoPlaced = false
    try {
      const logoBuffer = readFileSync(join(process.cwd(), 'public', 'logo.png'))
      const logoImg = wb.addImage({ buffer: logoBuffer, extension: 'png' })
      ws.addImage(logoImg, {
        tl: { col: 5, row: 0 },
        ext: { width: 62, height: 62 }
      })
      logoPlaced = true
    } catch (error) {
      console.error('Logo loading error:', error)
    }

    if (!logoPlaced) {
      ws.mergeCells(`A${row}:F${row}`)
      const orgCell = ws.getCell(`A${row}`)
      orgCell.value = 'Gabungan Ahli'
      orgCell.font = { name: 'Helvetica', size: 14, bold: true, color: { argb: NAVY } }
      orgCell.alignment = { horizontal: 'right', vertical: 'middle' }
      ws.getRow(row).height = 18
      row++
      ws.mergeCells(`A${row}:F${row}`)
      const orgCell2 = ws.getCell(`A${row}`)
      orgCell2.value = 'Teknik Nasional Indonesia'
      orgCell2.font = { name: 'Helvetica', size: 14, bold: true, color: { argb: NAVY } }
      orgCell2.alignment = { horizontal: 'right', vertical: 'middle' }
      ws.getRow(row).height = 18
      row++
    }

    row++ // spacer

    // Divider garis navy (samain PDF)
    ws.mergeCells(`A${row}:F${row}`)
    ws.getCell(`A${row}`).border = { bottom: { style: 'medium', color: { argb: NAVY } } }
    ws.getRow(row).height = 4
    row++

    row++ // spacer

    // INFO BOX - 2 kolom (kiri: Ditagihkan Kepada; kanan: Nomor Invoice & Tanggal) kayak PDF
    const infoRows = [
      {
        left: { label: 'Ditagihkan Kepada:', bold: true, color: DARK },
        right: { label: 'Nomor Invoice:', value: invoice.invoiceNumber }
      },
      {
        left: { label: invoice.submittedByUser.name, big: true },
        right: null
      },
      {
        left: { label: billTo },
        right: { label: 'Tanggal Pengajuan:', value: formatDate(invoice.createdAt) }
      },
    ]
    infoRows.forEach(ir => {
      ;['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
        const c = ws.getCell(`${col}${row}`)
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
        box(c)
      })
      if (ir.left) {
        const cell = ws.getCell(`B${row}`)
        cell.value = `${ir.left.label}${ir.left.value ? ' ' + ir.left.value : ''}`
        cell.font = {
          name: 'Helvetica',
          size: ir.left.big ? 11 : 9,
          bold: ir.left.big || !!ir.left.bold,
          color: { argb: ir.left.big || ir.left.bold ? NAVY : DARK }
        }
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      }
      if (ir.right) {
        const cell = ws.getCell(`F${row}`)
        cell.value = `${ir.right.label} ${ir.right.value}`
        cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: NAVY } }
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      }
      ws.getRow(row).height = ir.left?.big ? 20 : 17
      row++
    })

    row++ // spacer

    // DETAIL PESERTA KTA
    ws.mergeCells(`A${row}:F${row}`)
    ws.getCell(`A${row}`).value = 'Detail Peserta KTA'
    ws.getCell(`A${row}`).font = { name: 'Helvetica', size: 11, bold: true, color: { argb: NAVY } }
    row++

    // Table header
    const headers = ['No', 'ID-Izin', 'Nama Peserta', 'NIK', 'Kualifikasi', 'Harga']
    const headerCols = ['A', 'B', 'C', 'D', 'E', 'F']
    headerCols.forEach((col, i) => {
      const cell = ws.getCell(`${col}${row}`)
      cell.value = headers[i]
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      cell.font = { name: 'Helvetica', size: 9, bold: true, color: { argb: WHITE } }
      cell.alignment = { horizontal: i === 0 || i === 5 ? 'center' : 'left', vertical: 'middle' }
      box(cell)
    })
    ws.getRow(row).height = 20
    row++

    // Table rows
    paymentsWithPrev.forEach((payment, index) => {
      const JENJANG_NAME = ['', 'Operator', 'Operator', 'Operator', 'Teknisi/Analis', 'Teknisi/Analis', 'Teknisi/Analis', 'Ahli', 'Ahli', 'Ahli']
      const jenjangLabel = JENJANG_NAME[Number(payment.ktaRequest.jenjang)] || payment.ktaRequest.jenjang
      const jenjangText = payment.ktaRequest.isUpgrade
        ? `${jenjangLabel} (UPG)`
        : jenjangLabel
      const cells = [
        `${index + 1}`,
        payment.ktaRequest.idIzin,
        payment.ktaRequest.nama,
        payment.ktaRequest.nik,
        jenjangText,
        formatCurrency(payment.effectiveHarga)
      ]
      headerCols.forEach((col, i) => {
        const cell = ws.getCell(`${col}${row}`)
        cell.value = cells[i]
        cell.font = {
          name: 'Helvetica',
          size: 8,
          bold: i === 5,
          color: { argb: DARK }
        }
        cell.alignment = { horizontal: i === 0 || i === 5 ? 'center' : 'left', vertical: 'middle' }
        box(cell)
        if (index % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
        }
      })
      ws.getRow(row).height = 18
      row++
    })

    row++ // spacer

    // ============================================
    // 3 SECTION (layout file contoh): Metode (B) | Terbilang (C:D) | Rincian (E:F)
    // ============================================
    const terbilangText = terbilang(totalTagihan) + ' Rupiah'

    // Title row
    // Metode Pembayaran (B) - title fill LIGHT, tanpa border box
    ws.getCell(`B${row}`).value = 'Metode Pembayaran'
    ws.getCell(`B${row}`).font = { name: 'Helvetica', size: 10, bold: true, color: { argb: NAVY } }
    ws.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
    ws.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'top' }

    // Terbilang (C:D) - title fill LIGHT
    ws.mergeCells(`C${row}:D${row}`)
    const terbilangTitle = ws.getCell(`C${row}`)
    terbilangTitle.value = 'Terbilang'
    terbilangTitle.font = { name: 'Helvetica', size: 10, bold: true, color: { argb: NAVY } }
    terbilangTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
    terbilangTitle.alignment = { horizontal: 'left', vertical: 'top' }

    // Rincian Biaya (E:F) - kotak medium navy tanpa fill, teks di E atas
    const rincianTitle = ws.getCell(`E${row}`)
    rincianTitle.value = 'Rincian Biaya'
    rincianTitle.font = { name: 'Helvetica', size: 16, bold: true, color: { argb: NAVY } }
    rincianTitle.alignment = { horizontal: 'left', vertical: 'top' }
    ws.getCell(`E${row}`).border = { top: { style: 'medium', color: { argb: NAVY } }, left: { style: 'medium', color: { argb: NAVY } } }
    ws.getCell(`F${row}`).border = { top: { style: 'medium', color: { argb: NAVY } }, right: { style: 'medium', color: { argb: NAVY } } }
    ws.getCell(`E${row + 1}`).border = { left: { style: 'medium', color: { argb: NAVY } } }
    ws.getCell(`F${row + 1}`).border = { right: { style: 'medium', color: { argb: NAVY } } }
    ws.getRow(row).height = 20.1
    row++

    // Baris 2: metode (E:F masih bagian judul Rincian)
    ws.getCell(`B${row}`).value = isFree ? 'Bank Transfer' : 'Midtrans Payment Gateway'
    ws.getCell(`B${row}`).font = { name: 'Helvetica', size: 9, bold: true, color: { argb: DARK } }
    ws.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    ws.getRow(row).height = 21.95
    row++

    // Baris 3: Terbilang (C:D merged) + Total Harga (E:F)
    ws.mergeCells(`C${row}:D${row}`)
    const tblCell = ws.getCell(`C${row}`)
    tblCell.value = terbilangText
    tblCell.font = { name: 'Helvetica', size: 9, italic: true, color: { argb: DARK } }
    tblCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }

    const totalHargaCell = ws.getCell(`E${row}`)
    totalHargaCell.value = 'Total Harga:'
    totalHargaCell.font = { name: 'Helvetica', size: 14, color: { argb: DARK } }
    totalHargaCell.border = { left: { style: 'medium', color: { argb: NAVY } } }
    totalHargaCell.alignment = { horizontal: 'left', vertical: 'top' }
    const totalHargaVal = ws.getCell(`F${row}`)
    totalHargaVal.value = ` ${formatCurrency(totalHargaBase)}`
    totalHargaVal.font = { name: 'Helvetica', size: 14, color: { argb: DARK } }
    totalHargaVal.border = { right: { style: 'medium', color: { argb: NAVY } } }
    totalHargaVal.alignment = { horizontal: 'left', vertical: 'top' }

    const tblLines = Math.ceil(terbilangText.length / 50)
    ws.getRow(row).height = Math.max(30, tblLines * 15 + 6)
    row++

    // Baris 4: Status (B) + Porsi BPD (E:F). Gratis (diskon >= 100) tampil info bank, bukan Midtrans.
    ws.getCell(`B${row}`).value = isFree
      ? 'Bank: BTN KC Jakarta Kuningan'
      : `Status: ${statusLabel[invoice.status] || invoice.status}`
    ws.getCell(`B${row}`).font = { name: 'Helvetica', size: 9, color: { argb: DARK } }
    ws.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

    const porsiCell = ws.getCell(`E${row}`)
    porsiCell.value = 'Porsi BPD:'
    porsiCell.font = { name: 'Helvetica', size: 14, color: { argb: DARK } }
    porsiCell.border = { left: { style: 'medium', color: { argb: NAVY } } }
    porsiCell.alignment = { horizontal: 'left', vertical: 'top' }
    const porsiVal = ws.getCell(`F${row}`)
    porsiVal.value = diskonAmount > 0 ? `-${formatCurrency(diskonAmount)}` : 'Rp 0'
    porsiVal.font = { name: 'Helvetica', size: 14, color: { argb: 'FFCC3333' } }
    porsiVal.border = { right: { style: 'medium', color: { argb: NAVY } } }
    porsiVal.alignment = { horizontal: 'left', vertical: 'top' }

    ws.getRow(row).height = 21.95
    row++

    // Baris 5: Metode (B) + lanjutan border Rincian (E:F kosong). Gratis tampil nomor rekening.
    ws.getCell(`B${row}`).value = isFree
      ? 'No. Rekening: 00001.01.30.000986.9'
      : `Metode: ${paymentType}`
    ws.getCell(`B${row}`).font = { name: 'Helvetica', size: 9, color: { argb: DARK } }
    ws.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    ws.getCell(`E${row}`).border = { left: { style: 'medium', color: { argb: NAVY } } }
    ws.getCell(`F${row}`).border = { right: { style: 'medium', color: { argb: NAVY } } }
    ws.getRow(row).height = 18
    row++

    // Baris 6: Waktu (B) + Total Tagihan (E:F)
    ws.getCell(`B${row}`).value = `Waktu: ${formatDateTime(paymentTime)}`
    ws.getCell(`B${row}`).font = { name: 'Helvetica', size: 9, color: { argb: DARK } }
    ws.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

    const totalTagCell = ws.getCell(`E${row}`)
    totalTagCell.value = 'Total Tagihan:'
    totalTagCell.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: NAVY } }
    totalTagCell.border = {
      top: { style: 'thin', color: { argb: NAVY } },
      bottom: { style: 'medium', color: { argb: NAVY } },
      left: { style: 'medium', color: { argb: NAVY } },
    }
    totalTagCell.alignment = { horizontal: 'left', vertical: 'top' }
    const totalTagVal = ws.getCell(`F${row}`)
    totalTagVal.value = ` ${formatCurrency(totalTagihan)}`
    totalTagVal.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: NAVY } }
    totalTagVal.border = {
      top: { style: 'thin', color: { argb: NAVY } },
      bottom: { style: 'medium', color: { argb: NAVY } },
      right: { style: 'medium', color: { argb: NAVY } },
    }
    totalTagVal.alignment = { horizontal: 'left', vertical: 'top' }
    ws.getRow(row).height = 18
    row++

    row++ // spacer

    // LEGAL TEXT
    const legal = `Invoice ini diterbitkan secara elektronik oleh Admin "${adminName}" dan sah tanpa tanda tangan maupun cap perusahaan.`
    ws.mergeCells(`A${row}:F${row}`)
    const legalCell = ws.getCell(`A${row}`)
    legalCell.value = legal
    legalCell.font = { name: 'Helvetica', size: 8, italic: true, color: { argb: 'FF808080' } }
    legalCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    legalCell.border = { top: { style: 'thin', color: { argb: BORDER } } }
    ws.getRow(row).height = 18

    // Konversi ke buffer
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeInvoiceFilename(invoice.invoiceNumber)}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Error generating Excel:', error)
    return NextResponse.json(
      { error: 'Failed to generate Excel' },
      { status: 500 }
    )
  }
}
