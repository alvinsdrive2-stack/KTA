import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { readFileSync } from 'fs'
import { join } from 'path'

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
            email: true
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
                hargaFinal: true
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

    // Create PDF
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4 size
    const { height, width } = page.getSize()

    // Embed fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    // Colors
    const navyBlue = rgb(0.04, 0.11, 0.24) // #0B1C3D
    const darkGray = rgb(0.2, 0.2, 0.2) // #333333
    const lightGray = rgb(0.96, 0.97, 0.98) // #F5F7FA

    let yPosition = height - 50
    const margin = 56.7 // 2cm in points
    const contentWidth = width - (2 * margin)
    const lineHeight = 16

    // Helper function to format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(amount)
    }

    // Helper function to format date
    const formatDate = (date: Date | string) => {
      return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }

    // Helper function to convert number to words (terbilang)
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

    // ============================================
    // HEADER - LOGO & TITLE
    // ============================================

    // Try to load logo image
    try {
      const logoPath = join(process.cwd(), 'public', 'logoinv.png')
      console.log('Loading logo from:', logoPath)

      const logoBuffer = readFileSync(logoPath)
      console.log('Logo buffer size:', logoBuffer.length)

      const logoImage = await pdfDoc.embedPng(logoBuffer)
      console.log('Logo original dimensions:', logoImage.width, 'x', logoImage.height)

      // Calculate scale to make width approximately 140px
      const desiredWidth = 60
      const scaleFactor = desiredWidth / logoImage.width
      const logoDims = logoImage.scale(scaleFactor)
      console.log('Logo scaled dimensions:', logoDims.width, 'x', logoDims.height)

      page.drawImage(logoImage, {
        x: width - margin - logoDims.width - 5,
        y: yPosition - logoDims.height + 35,  // Moved up slightly
        width: logoDims.width,
        height: logoDims.height
      })
      console.log('Logo drawn successfully at position:', width - margin - logoDims.width - 5, yPosition - logoDims.height + 15)
    } catch (error) {
      // Log error and draw text fallback
      console.error('Logo loading error:', error)

      // Draw text fallback
      page.drawText('LSP GATENSI', {
        x: width - margin - 110,
        y: yPosition,
        size: 14,
        font: fontBold,
        color: navyBlue
      })
      page.drawText('KARYA KONSTRUKSI', {
        x: width - margin - 120,
        y: yPosition - 18,
        size: 14,
        font: fontBold,
        color: navyBlue
      })
    }

    // Large INVOICE title on the left
    page.drawText('INVOICE', {
      x: margin,
      y: yPosition -10,
      size: 36,
      font: fontBold,
      color: navyBlue
    })

    yPosition -= 35

    // Thin horizontal divider
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: width - margin, y: yPosition },
      thickness: 1,
      color: navyBlue
    })
    yPosition -= 30

    // ============================================
    // INVOICE INFO - Container with Layout
    // ============================================
    const infoBoxHeight = 50

    // Light gray container
    page.drawRectangle({
      x: margin,
      y: yPosition - infoBoxHeight,
      width: contentWidth,
      height: infoBoxHeight,
      color: lightGray,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.5
    })

    yPosition -= 12

    const leftColX = margin + 10
    const rightColX = margin + 200

    // ROW 1 - Ditagihkan Kepada & Nomor Invoice (same Y for labels)
    page.drawText('Ditagihkan Kepada:', {
      x: leftColX,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: darkGray
    })

    page.drawText('Nomor Invoice:', {
      x: rightColX,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: darkGray
    })
    page.drawText('   ' + invoice.invoiceNumber, {
      x: rightColX + 85,  // Value on same line as label
      y: yPosition,
      size: 9,
      font: fontBold,
      color: navyBlue
    })

    yPosition -= lineHeight

    // ROW 2 - User Name (below Ditagihkan Kepada)
    page.drawText(invoice.submittedByUser.name, {
      x: leftColX,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: navyBlue
    })

    yPosition -= lineHeight

    // ROW 3 - Daerah & Tanggal (same Y for labels)
    if (invoice.daerah.namaDaerah) {
      page.drawText(invoice.daerah.namaDaerah, {
        x: leftColX,
        y: yPosition,
        size: 9,
        font: font,
        color: darkGray
      })
    }

    page.drawText('Tanggal Pengajuan:', {
      x: rightColX,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: darkGray
    })
    page.drawText('   ' + formatDate(invoice.createdAt), {
      x: rightColX + 85,  // Value on same line as label
      y: yPosition,
      size: 9,
      font: fontBold,
      color: navyBlue
    })

    yPosition -= infoBoxHeight + 12 - lineHeight - lineHeight

    // ============================================
    // PARTICIPANT TABLE - Detail KTA yang dibayar
    // ============================================
    page.drawText('Detail Peserta KTA', {
      x: margin,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: navyBlue
    })
    yPosition -= 20

    const tableWidth = contentWidth
    const colWidths = [25, 95, 150, 80, 55, 100] // No, ID-Izin, Nama, NIK, Jenjang, Harga (No smaller, ID Izin bigger, Jenjang smaller)
    const rowHeight = 22
    const tableHeaderHeight = 25

    // Table header background - Navy Blue
    page.drawRectangle({
      x: margin,
      y: yPosition - tableHeaderHeight,
      width: tableWidth,
      height: tableHeaderHeight,
      color: navyBlue
    })

    // Table headers - White text
    const headers = ['No', 'ID-Izin', 'Nama Peserta', 'NIK', 'Jenjang', 'Harga']
    let xPos = margin
    headers.forEach((header, i) => {
      page.drawText(header, {
        x: xPos + 5,
        y: yPosition - 8,
        size: 8,
        font: fontBold,
        color: rgb(1, 1, 1)
      })
      xPos += colWidths[i]
    })

    yPosition -= tableHeaderHeight

    // Table rows with alternating background
    invoice.payments.forEach((payment, index) => {
      // Alternating row background
      if (index % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: yPosition - rowHeight + 6,
          width: tableWidth,
          height: rowHeight,
          color: lightGray
        })
      }

      // Draw cell data - No truncation, full text
      xPos = margin
      const cells = [
        `${index + 1}`,
        payment.ktaRequest.idIzin,
        payment.ktaRequest.nama,  // No truncation
        payment.ktaRequest.nik,
        payment.ktaRequest.jenjang,
        formatCurrency(payment.ktaRequest.hargaBase || 0)
      ]

      cells.forEach((cell, i) => {
        page.drawText(cell, {
          x: xPos + (i === 5 ? 2 : 4),  // Adjust harga column to be more left
          y: yPosition - 7,
          size: 7,
          font: i === 5 ? fontBold : font,
          color: darkGray
        })
        xPos += colWidths[i]
      })

      // Row border
      page.drawLine({
        start: { x: margin, y: yPosition - rowHeight+6 },
        end: { x: width - margin, y: yPosition - rowHeight+6 },
        thickness: 0.3,
        color: rgb(0.7, 0.7, 0.7)
      })

      yPosition -= rowHeight
    })

    // Table border bottom
    page.drawLine({
      start: { x: margin, y: yPosition+6 },
      end: { x: width - margin, y: yPosition+6 },
      thickness: 1,
      color: navyBlue
    })

    yPosition -= 30

    // ============================================
    // FLEX 3 LAYOUT - Rekening (Kiri) | Terbilang (Tengah) | Rincian (Kanan)
    // ============================================

    const sectionWidth = (contentWidth - 10) / 3
    const leftX = margin
    const centerX = margin + sectionWidth + 10
    const rightX = margin + (sectionWidth * 2) + 20

    // Calculate total from hargaBase
    const totalHargaBase = invoice.payments.reduce((sum, p) => sum + (p.ktaRequest.hargaBase || 0), 0)
    const diskon = invoice.daerah.diskonPersen || 0
    const diskonAmount = Math.floor(totalHargaBase * diskon / 100)
    const totalTagihan = totalHargaBase - diskonAmount

    // LEFT - Nomor Rekening (NO border, NO background)
    page.drawText('Metode Pembayaran', {
      x: leftX + 10,
      y: yPosition - 10,
      size: 9,
      font: fontBold,
      color: navyBlue
    })

    page.drawText('Bank:', {
      x: leftX + 10,
      y: yPosition - 30,
      size: 8,
      font: font,
      color: darkGray
    })
    page.drawText('BNI', {
      x: leftX + 10,
      y: yPosition - 43,
      size: 10,
      font: fontBold,
      color: darkGray
    })

    page.drawText('No. Rekening:', {
      x: leftX + 10,
      y: yPosition - 58,
      size: 8,
      font: font,
      color: darkGray
    })
    page.drawText('1234567890', {
      x: leftX + 10,
      y: yPosition - 71,
      size: 10,
      font: fontBold,
      color: navyBlue
    })

    // CENTER - Terbilang (NO border, NO background)
    page.drawText('Terbilang', {
      x: centerX + 10,
      y: yPosition - 10,
      size: 9,
      font: fontBold,
      color: navyBlue
    })

    const terbilangText = terbilang(totalTagihan) + ' Rupiah'

    // Word wrap for terbilang - wrap by words, not characters
    const words = terbilangText.split(' ')
    let lines: string[] = []
    let currentLine = ''
    words.forEach(word => {
      const testLine = currentLine ? currentLine + ' ' + word : word
      if (testLine.length * 4.5 < sectionWidth - 20) {
        currentLine = testLine
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })
    if (currentLine) lines.push(currentLine)

    let terbilangY = yPosition - 35
    lines.forEach((line) => {
      page.drawText(line, {
        x: centerX + 10,
        y: terbilangY,
        size: 9,
        font: fontItalic,
        color: darkGray
      })
      terbilangY -= 12
    })

    // RIGHT - Rincian Biaya (WITH border and background)
    page.drawRectangle({
      x: rightX,
      y: yPosition - 90,  // Increased from 80 to 90
      width: sectionWidth,
      height: 90,
      borderColor: navyBlue,
      borderWidth: 1,
      color: rgb(0.98, 0.98, 1)
    })

    page.drawText('Rincian Biaya', {
      x: rightX + 10,
      y: yPosition - 15,
      size: 9,
      font: fontBold,
      color: navyBlue
    })

    let summaryY = yPosition - 35

    // Total Harga (from hargaBase)
    page.drawText(`Total Harga (${invoice.totalJumlah} KTA):`, {
      x: rightX + 10,
      y: summaryY,
      size: 8,
      font: font,
      color: darkGray
    })
    page.drawText(formatCurrency(totalHargaBase), {
      x: rightX + sectionWidth - 60,  // Moved more to the left
      y: summaryY,
      size: 8,
      font: fontBold,
      color: darkGray
    })
    summaryY -= lineHeight

    // Diskon
    page.drawText('Diskon:', {
      x: rightX + 10,
      y: summaryY,
      size: 8,
      font: font,
      color: darkGray
    })
    page.drawText(
      diskonAmount > 0 ? `-${formatCurrency(diskonAmount)}` : 'Rp 0',
      {
        x: rightX + sectionWidth - 60,  // Moved more to the left
        y: summaryY,
        size: 8,
        font: font,
        color: rgb(0.8, 0.2, 0.2)
      }
    )
    summaryY -= lineHeight + 8  // Extra spacing before total tagihan

    // Line separator
    page.drawLine({
      start: { x: rightX + 10, y: summaryY+10 },
      end: { x: rightX + sectionWidth - 10, y: summaryY +10 },
      thickness: 0.5,
      color: navyBlue
    })
    summaryY -= 10  // Extra spacing after line

    // Total Tagihan (Bold) - moved down
    page.drawText('Total Tagihan:', {
      x: rightX + 10,
      y: summaryY+5,
      size: 10,
      font: fontBold,
      color: navyBlue
    })
    page.drawText(formatCurrency(totalTagihan), {
      x: rightX + sectionWidth - 70,
      y: summaryY+5,
      size: 11,
      font: fontBold,
      color: navyBlue
    })

    yPosition -= 100

    // ============================================
    // FOOTER - Issued By System
    // ============================================
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: width - margin, y: yPosition },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    })
    yPosition -= 25

    // Left - Issued By System
    page.drawText('Issued By:', {
      x: margin,
      y: yPosition,
      size: 8,
      font: font,
      color: darkGray
    })
    yPosition -= lineHeight

    page.drawText('System - LSP Gatensi Karya Konstruksi', {
      x: margin,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: navyBlue
    })
    yPosition -= lineHeight

    page.drawText('Document generated automatically by system', {
      x: margin,
      y: yPosition,
      size: 7,
      font: fontItalic,
      color: rgb(0.5, 0.5, 0.5)
    })

    // Right - Print Date & Time
    const printDateTime = `Print: ${new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })} ${new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })}`

    page.drawText(printDateTime, {
      x: width - margin - printDateTime.length * 3.5,
      y: yPosition + lineHeight * 2,
      size: 7,
      font: font,
      color: darkGray
    })

    // Serialize PDF to bytes
    const pdfBytes = await pdfDoc.save()

    // Return PDF
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
      },
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
