import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'

interface KTAData {
  id: string
  idIzin: string
  nama: string
  nik: string
  jabatanKerja: string
  subklasifikasi: string
  jenjang: string
  noTelp: string
  email: string
  alamat: string
  tanggalDaftar: Date
  qrCodePath: string
  daerahNama: string
  fotoUrl?: string
  tanggalTerbit: Date
  tanggalBerlaku: Date
}

export class KTAPDFGenerator {
  private static readonly outputDir = path.join(process.cwd(), 'public', 'uploads', 'kta-cards')

  static async generateKTACard(ktaData: KTAData): Promise<string> {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true })

    // Create new PDF document
    const pdfDoc = await PDFDocument.create()

    // Add a page (ID Card size: 85.6mm x 53.98mm)
    const page = pdfDoc.addPage([242.8, 153.9]) // Convert to points (1mm = 2.835pt)

    // Use standard font
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Background - Construction theme gradient effect
    const backgroundGradient = {
      type: 'radial',
      colors: ['#f37320', '#e45a16']
    }

    page.drawRectangle({
      x: 0,
      y: 0,
      width: 242.8,
      height: 153.9,
      color: rgb(0.95, 0.45, 0.13),
    })

    // White content area
    page.drawRectangle({
      x: 10,
      y: 10,
      width: 222.8,
      height: 133.9,
      color: rgb(1, 1, 1),
    })

    // Header with construction icon and title
    page.drawText('KARTU TANDA ANGGOTA', {
      x: 20,
      y: 123.9,
      size: 14,
      font,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText('ASOSIASI TENAGA KONSTRUKSI INDONESIA', {
      x: 20,
      y: 108,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Add line separator
    page.drawLine({
      start: { x: 20, y: 100 },
      end: { x: 222.8, y: 100 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })

    // Photo placeholder
    const photoX = 160
    const photoY = 75
    const photoSize = 60

    page.drawRectangle({
      x: photoX,
      y: photoY,
      width: photoSize,
      height: photoSize * 1.2, // ID card photo ratio
      color: rgb(0.95, 0.95, 0.95),
      borderWidth: 1,
      borderColor: rgb(0.8, 0.8, 0.8),
    })

    // Try to embed photo if available
    if (ktaData.fotoUrl) {
      try {
        const imagePath = path.join(process.cwd(), 'public', ktaData.fotoUrl)
        const imageBytes = await fs.readFile(imagePath)
        const image = await pdfDoc.embedJpg(imageBytes)

        page.drawImage(image, {
          x: photoX + 1,
          y: photoY + 1,
          width: photoSize - 2,
          height: photoSize * 1.2 - 2,
        })
      } catch (error) {
        console.error('Error embedding photo:', error)
      }
    }

    // Member Information
    const infoY = 80
    const lineHeight = 12
    let currentY = infoY

    const drawField = (label: string, value: string) => {
      page.drawText(label, {
        x: 20,
        y: currentY,
        size: 7,
        font,
        color: rgb(0.4, 0.4, 0.4),
      })

      page.drawText(value, {
        x: 60,
        y: currentY,
        size: 8,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })

      currentY -= lineHeight
    }

    drawField('Nama:', ktaData.nama)
    drawField('NIK:', ktaData.nik)
    drawField('ID Izin:', ktaData.idIzin)
    drawField('Jabatan:', ktaData.jabatanKerja)
    drawField('Subklasifikasi:', ktaData.subklasifikasi)
    drawField('Jenjang:', ktaData.jenjang)

    // Daerah information at bottom
    page.drawText(`Daerah: ${ktaData.daerahNama}`, {
      x: 20,
      y: 25,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Valid dates
    page.drawText(
      `Terbit: ${ktaData.tanggalTerbit.toLocaleDateString('id-ID')} - ` +
      `Berlaku: ${ktaData.tanggalBerlaku.toLocaleDateString('id-ID')}`,
      {
        x: 20,
        y: 15,
        size: 6,
        font,
        color: rgb(0.4, 0.4, 0.4),
      }
    )

    // QR Code
    if (ktaData.qrCodePath) {
      try {
        const qrImagePath = path.join(process.cwd(), 'public', ktaData.qrCodePath)
        const qrImageBytes = await fs.readFile(qrImagePath)
        const qrImage = await pdfDoc.embedPng(qrImageBytes)

        page.drawImage(qrImage, {
          x: 190,
          y: 15,
          width: 30,
          height: 30,
        })
      } catch (error) {
        console.error('Error embedding QR code:', error)
      }
    }

    // Serialize PDF
    const pdfBytes = await pdfDoc.save()

    // Generate filename
    const filename = `KTA-${ktaData.idIzin}-${Date.now()}.pdf`
    const filePath = path.join(this.outputDir, filename)

    // Write file
    await fs.writeFile(filePath, pdfBytes)

    // Return relative path
    return `/uploads/kta-cards/${filename}`
  }

  static async generateBulkKTACards(ktaDataList: KTAData[]): Promise<string> {
    // Create PDF with multiple pages (one card per page)
    const pdfDoc = await PDFDocument.create()

    for (const ktaData of ktaDataList) {
      const tempPdfPath = await this.generateKTACard(ktaData)
      const tempPdfBytes = await fs.readFile(path.join(process.cwd(), 'public', tempPdfPath))
      const tempPdf = await PDFDocument.load(tempPdfBytes)

      const [page] = await pdfDoc.copyPages(tempPdf, [0])
      pdfDoc.addPage(page)
    }

    const pdfBytes = await pdfDoc.save()

    const filename = `Bulk-KTA-${Date.now()}.pdf`
    const filePath = path.join(this.outputDir, filename)

    await fs.writeFile(filePath, pdfBytes)

    return `/uploads/kta-cards/${filename}`
  }
}