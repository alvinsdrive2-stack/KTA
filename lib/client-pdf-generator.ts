import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
// @ts-ignore - pdf-lib fontkit
import fontkit from '@pdf-lib/fontkit'

// Scale factor for PDF (adjust as needed)
const SCALE = 2

interface KTAData {
  id: string
  nama: string
  alamat: string
  nomorKTA: string
  createdAt: Date
  qrCodePath: string
  fotoUrl?: string
  fotoData?: string
}

// Helper function to convert position to scaled X coordinate
function toX(position: number): number {
  return position * SCALE
}

// Helper function to convert position to scaled Y coordinate
function toY(position: number): number {
  return (750 - position) * SCALE // Flip Y axis (PDF origin is bottom-left)
}

// Helper function untuk capitalize each word
function capitalizeEachWord(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Helper function untuk format alamat dengan RT/RW uppercase
function formatAlamatWithRW(alamat: string): string {
  let formatted = capitalizeEachWord(alamat)
  // Replace RT/RW variations with proper format
  formatted = formatted.replace(/\bRT\b/g, 'RT')
  formatted = formatted.replace(/\bRW\b/g, 'RW')
  return formatted
}

export class ClientKTAPDFGenerator {
  /**
   * Generate KTA card PDF on client-side
   * This bypasses geo-blocking by fetching images from the browser
   */
  static async generateKTACard(ktaData: KTAData): Promise<Uint8Array> {
    // Register fontkit
    const pdfDoc = await PDFDocument.create()
    // @ts-ignore
    pdfDoc.registerFontkit(fontkit)

    // Fetch fonts
    const fontUrl = '/fonts/Manrope-SemiBold.ttf'
    const fontMediumUrl = '/fonts/Manrope-Medium.ttf'

    const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer())
    const fontMediumBytes = await fetch(fontMediumUrl).then(res => res.arrayBuffer())

    const manropeFont = await pdfDoc.embedFont(fontBytes)
    const manropeMedium = await pdfDoc.embedFont(fontMediumBytes)

    // Page size (credit card size: 85.6mm x 53.98mm, scaled up)
    const pageWidth = 600 * SCALE
    const pageHeight = 380 * SCALE

    // ===== FRONT PAGE =====
    const frontPage = pdfDoc.addPage([pageWidth, pageHeight])

    // Background gradient (white to light blue)
    frontPage.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    })

    // Blue header bar
    frontPage.drawRectangle({
      x: 0,
      y: toY(60),
      width: pageWidth,
      height: 60 * SCALE,
      color: rgb(0.1, 0.2, 0.4), // Dark blue
    })

    // Title "KARTU TENAGA AHLI"
    frontPage.drawText('KARTU TENAGA AHLI', {
      x: toX(20),
      y: toY(45),
      size: 16 * SCALE,
      font: manropeFont,
      color: rgb(1, 1, 1),
    })

    // Nomor KTA
    frontPage.drawText(`No: ${ktaData.nomorKTA}`, {
      x: toX(20),
      y: toY(25),
      size: 12 * SCALE,
      font: manropeMedium,
      color: rgb(1, 1, 1),
    })

    // Photo area (left side)
    const photoX = toX(20)
    const photoY = toY(122 + 140)
    const photoWidth = 120 * SCALE
    const photoHeight = 140 * SCALE

    // Embed photo if available
    if (ktaData.fotoData || ktaData.fotoUrl) {
      try {
        let imageBytes: Uint8Array

        if (ktaData.fotoData) {
          // Parse base64 data
          const base64Data = ktaData.fotoData.includes(',')
            ? ktaData.fotoData.split(',')[1]
            : ktaData.fotoData
          const binaryString = atob(base64Data)
          imageBytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            imageBytes[i] = binaryString.charCodeAt(i)
          }
          console.log('✅ Using base64 fotoData')
        } else if (ktaData.fotoUrl) {
          // Fetch from browser (bypasses geo-block)
          console.log(`📡 Fetching foto from URL: ${ktaData.fotoUrl}`)
          const response = await fetch(ktaData.fotoUrl)

          if (!response.ok) {
            console.error(`❌ Failed to fetch foto: ${response.status} ${response.statusText}`)
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          imageBytes = new Uint8Array(arrayBuffer)
          console.log('✅ Foto fetched successfully, size:', imageBytes.length)
        } else {
          throw new Error('No photo data or URL provided')
        }

        // Embed image
        const image = await pdfDoc.embedPng(imageBytes)

        // Draw photo with rounded corners effect (simple clipping)
        frontPage.drawImage(image, {
          x: photoX,
          y: photoY,
          width: photoWidth,
          height: photoHeight,
        })
      } catch (error) {
        console.log('Skipping photo due to error:', error instanceof Error ? error.message : 'Unknown error')
        // Draw placeholder
        frontPage.drawRectangle({
          x: photoX,
          y: photoY,
          width: photoWidth,
          height: photoHeight,
          color: rgb(0.9, 0.9, 0.9),
        })
        frontPage.drawText('Foto', {
          x: photoX + photoWidth / 2 - 15,
          y: photoY + photoHeight / 2,
          size: 12 * SCALE,
          font: manropeMedium,
          color: rgb(0.5, 0.5, 0.5),
        })
      }
    }

    // Name (right side, top)
    frontPage.drawText(ktaData.nama.toUpperCase(), {
      x: toX(160),
      y: toY(115),
      size: 18 * SCALE,
      font: manropeFont,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: 400 * SCALE,
    })

    // NIK/ID
    frontPage.drawText(`NIK: ${ktaData.id}`, {
      x: toX(160),
      y: toY(95),
      size: 10 * SCALE,
      font: manropeMedium,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Jenjang
    frontPage.drawText(`Jenjang: ${ktaData.nomorKTA.split('.')[1] || '-'}`, {
      x: toX(160),
      y: toY(75),
      size: 10 * SCALE,
      font: manropeMedium,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Alamat
    const formattedAlamat = formatAlamatWithRW(ktaData.alamat)
    const alamatLines = []
    const maxLineWidth = 400
    let currentLine = ''

    for (const char of formattedAlamat) {
      const testLine = currentLine + char
      if (testLine.length > 50) { // Approximate character limit
        alamatLines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      alamatLines.push(currentLine)
    }

    let alamatY = toY(55)
    alamatLines.slice(0, 2).forEach((line, index) => {
      frontPage.drawText(line, {
        x: toX(160),
        y: alamatY,
        size: 9 * SCALE,
        font: manropeMedium,
        color: rgb(0.4, 0.4, 0.4),
      })
      alamatY -= 12 * SCALE
    })

    // Berlaku Hingga
    const expiryDate = new Date(ktaData.createdAt)
    expiryDate.setFullYear(expiryDate.getFullYear() + 5)
    const expiryStr = expiryDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })

    frontPage.drawText(`Berlaku hingga: ${expiryStr}`, {
      x: toX(20),
      y: toY(320),
      size: 9 * SCALE,
      font: manropeMedium,
      color: rgb(0.3, 0.3, 0.3),
    })

    // Tanggal Terbit
    const createdStr = new Date(ktaData.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
    frontPage.drawText(`Tanggal Terbit: ${createdStr}`, {
      x: toX(20),
      y: toY(305),
      size: 9 * SCALE,
      font: manropeMedium,
      color: rgb(0.3, 0.3, 0.3),
    })

    // QR Code placeholder (bottom right)
    const qrX = toX(600 - 28 - 60)
    const qrY = 10 * SCALE
    const qrSize = 60 * SCALE

    frontPage.drawRectangle({
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1 * SCALE,
      color: rgb(1, 1, 1),
    })

    // Embed QR code if available
    if (ktaData.qrCodePath) {
      try {
        let qrImageBytes: Uint8Array | undefined

        if (ktaData.qrCodePath.startsWith('data:image/')) {
          const base64Data = ktaData.qrCodePath.split(',')[1]
          const binaryString = atob(base64Data)
          qrImageBytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            qrImageBytes[i] = binaryString.charCodeAt(i)
          }
        } else if (ktaData.qrCodePath.startsWith('http')) {
          const response = await fetch(ktaData.qrCodePath)
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            qrImageBytes = new Uint8Array(arrayBuffer)
          }
        } else {
          // Local file
          const response = await fetch(ktaData.qrCodePath)
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            qrImageBytes = new Uint8Array(arrayBuffer)
          }
        }

        if (qrImageBytes) {
          const qrImage = await pdfDoc.embedPng(qrImageBytes)
          frontPage.drawImage(qrImage, {
            x: qrX + 1 * SCALE,
            y: qrY + 1 * SCALE,
            width: qrSize - 2 * SCALE,
            height: qrSize - 2 * SCALE,
          })
        }
      } catch (error) {
        console.log('QR error:', error instanceof Error ? error.message : 'Unknown error')
      }
    }

    // ===== BACK PAGE =====
    const backPage = pdfDoc.addPage([pageWidth, pageHeight])

    // Background
    backPage.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    })

    // Header
    backPage.drawRectangle({
      x: 0,
      y: toY(60),
      width: pageWidth,
      height: 60 * SCALE,
      color: rgb(0.8, 0.1, 0.2), // Red
    })

    backPage.drawText('KETERANGAN', {
      x: toX(20),
      y: toY(45),
      size: 16 * SCALE,
      font: manropeFont,
      color: rgb(1, 1, 1),
    })

    // Disclaimer text
    const disclaimerText = [
      'Kartu ini merupakan bukti kompetensi tenaga ahli',
      'yang telah memenuhi standar yang ditetapkan.',
      '',
      'Kartu ini tidak dapat dipindah tangankan.',
      'Kehilangan kartu agar segera melapor.',
      '',
      'Penyalahgunaan kartu ini dikenakan sanksi.',
    ]

    let textY = toY(280)
    disclaimerText.forEach((line) => {
      backPage.drawText(line, {
        x: toX(20),
        y: textY,
        size: 10 * SCALE,
        font: manropeMedium,
        color: rgb(0.2, 0.2, 0.2),
      })
      textY -= 18 * SCALE
    })

    // Footer
    backPage.drawText(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, {
      x: toX(20),
      y: toY(20),
      size: 8 * SCALE,
      font: manropeMedium,
      color: rgb(0.5, 0.5, 0.5),
    })

    // Serialize PDF
    return await pdfDoc.save()
  }

  /**
   * Download generated PDF
   */
  static async downloadKTAPDF(ktaData: KTAData, filename: string): Promise<void> {
    const pdfBytes = await this.generateKTACard(ktaData)

    // Create blob and download (use as any to bypass type check)
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}
