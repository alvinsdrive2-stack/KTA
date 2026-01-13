import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

interface KTAData {
  id: string
  nama: string
  alamat: string
  nomorKTA: string
  createdAt: Date
  qrCodePath: string
  fotoUrl?: string
  fotoData?: string  // base64 image data (client-side fetch)
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
  formatted = formatted.replace(/\b\/?rt\b/gi, '/RT')
  formatted = formatted.replace(/\b\/?rw\b/gi, '/RW')
  // Handle case without slash but with space after
  formatted = formatted.replace(/\brt\b/gi, 'RT')
  formatted = formatted.replace(/\brw\b/gi, 'RW')
  return formatted
}

// Helper functions untuk format data (sama seperti kta-preview)
function formatNama(nama: string): string {
  const maxChars = 25

  if (nama.length <= maxChars) {
    return nama
  }

  const words = nama.trim().split(/\s+/)

  if (words.length <= 2) {
    return nama.slice(0, maxChars - 3) + '...'
  }

  const firstWord = words[0]
  const lastWord = words[words.length - 1]
  const middleWords = words.slice(1, -1)

  let abbreviated = firstWord
  for (const word of middleWords) {
    const initial = word.charAt(0) + '.'
    if ((abbreviated + ' ' + initial + ' ' + lastWord).length <= maxChars) {
      abbreviated += ' ' + initial
    } else {
      break
    }
  }

  if ((abbreviated + ' ' + lastWord).length <= maxChars) {
    abbreviated += ' ' + lastWord
  }

  return abbreviated
}

function formatAlamat(alamat: string): string[] {
  const maxLine1 = 26
  const maxLine2 = 26
  const maxLine3 = 26

  const words = alamat.split(' ')
  const lines: string[] = []
  let currentLine = ''

  // Build line 1
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (lines.length === 0 && testLine.length <= maxLine1) {
      currentLine = testLine
    } else if (lines.length === 0 && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else if (lines.length === 1) {
      break
    }
  }
  if (lines.length === 0 && currentLine) {
    lines.push(currentLine)
    currentLine = ''
  }

  // Build line 2
  const startIndexLine2 = lines[0] ? lines[0].split(' ').length : 0
  let line2Words: string[] = []
  for (let i = startIndexLine2; i < words.length; i++) {
    const testLine = line2Words.join(' ') + (line2Words.length ? ' ' : '') + words[i]
    if (testLine.length <= maxLine2) {
      line2Words.push(words[i])
    } else if (line2Words.length === 0) {
      line2Words.push(words[i])
      break
    } else {
      break
    }
  }
  if (line2Words.length > 0) {
    lines.push(line2Words.join(' '))
  }

  // Build line 3
  const startIndexLine3 = startIndexLine2 + line2Words.length
  const line3Words = words.slice(startIndexLine3)
  if (line3Words.length > 0) {
    const line3 = line3Words.join(' ')
    lines.push(line3.length > maxLine3 ? line3.slice(0, maxLine3) : line3)
  }

  return lines.filter(l => l.length > 0)
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${year}`
}

// Use 2x resolution for print quality (1200x760)
const SCALE = 2
const CARD_WIDTH = 600 * SCALE
const CARD_HEIGHT = 380 * SCALE

// Cache untuk font dan template
let manropeFontBytes: Buffer | ArrayBuffer | null = null
let manropeMediumFontBytes: Buffer | ArrayBuffer | null = null
let templateImage: Buffer | null = null

// Fetch font from public URL (works in serverless)
async function getManropeFont(): Promise<Buffer | ArrayBuffer> {
  if (manropeFontBytes) return manropeFontBytes

  // Determine base URL for font loading
  // On Vercel: use VERCEL_URL (auto-available) or NEXT_PUBLIC_SITE_URL
  // Locally: use localhost
  let baseUrl = 'http://localhost:3000'
  if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  } else if (process.env.NEXT_PUBLIC_SITE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  }

  try {
    const fontUrl = `${baseUrl}/fonts/Manrope-SemiBold.ttf`
    console.log('Fetching font from:', fontUrl)
    const response = await fetch(fontUrl)
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer()
      manropeFontBytes = Buffer.from(arrayBuffer)
      console.log('Font loaded successfully from URL')
      return manropeFontBytes
    } else {
      console.log('Font fetch failed with status:', response.status)
    }
  } catch (error) {
    console.log('Fetch failed, trying local filesystem...', error)
  }

  // Fallback to local filesystem (development)
  try {
    const fontPath = path.join(process.cwd(), 'fonts', 'Manrope-SemiBold.ttf')
    manropeFontBytes = await fs.readFile(fontPath)
    console.log('Font loaded from filesystem')
    return manropeFontBytes
  } catch (error) {
    console.error('Error loading Manrope SemiBold font:', error)
    throw new Error('Failed to load Manrope SemiBold font from URL and filesystem')
  }
}

async function getManropeMediumFont(): Promise<Buffer | ArrayBuffer> {
  if (manropeMediumFontBytes) return manropeMediumFontBytes

  // Determine base URL for font loading
  let baseUrl = 'http://localhost:3000'
  if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  } else if (process.env.NEXT_PUBLIC_SITE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  }

  try {
    const fontUrl = `${baseUrl}/fonts/Manrope-Medium.ttf`
    console.log('Fetching medium font from:', fontUrl)
    const response = await fetch(fontUrl)
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer()
      manropeMediumFontBytes = Buffer.from(arrayBuffer)
      console.log('Medium font loaded successfully from URL')
      return manropeMediumFontBytes
    } else {
      console.log('Medium font fetch failed with status:', response.status)
    }
  } catch (error) {
    console.log('Medium font fetch failed, trying local filesystem...', error)
  }

  // Fallback to local filesystem (development)
  try {
    const fontPath = path.join(process.cwd(), 'fonts', 'Manrope-Medium.ttf')
    manropeMediumFontBytes = await fs.readFile(fontPath)
    return manropeMediumFontBytes
  } catch (error) {
    // Medium font is corrupted, use SemiBold as fallback
    console.warn('Manrope Medium font not available, using SemiBold')
    return getManropeFont()
  }
}

async function getTemplateImage(): Promise<Buffer> {
  if (templateImage) return templateImage

  try {
    const templatePath = path.join(process.cwd(), 'public', 'template kta', 'KTA AI - FRONT.svg')
    const pngCachePath = path.join('/tmp', 'kta-template-front-hires.png')

    // Check if PNG cache exists
    try {
      const cached = await fs.readFile(pngCachePath)
      templateImage = cached
      return templateImage
    } catch {}

    // Convert SVG to PNG using sharp - high resolution (2x)
    const svgBuffer = await fs.readFile(templatePath)

    const pngBuffer = await sharp(svgBuffer)
      .resize(CARD_WIDTH, CARD_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer()

    templateImage = pngBuffer

    // Cache for future use
    await fs.mkdir('/tmp', { recursive: true })
    await fs.writeFile(pngCachePath, pngBuffer)

    return templateImage
  } catch (error) {
    console.error('Error loading template:', error)
    // Return fallback - solid color with high resolution
    return sharp({
      create: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        channels: 3,
        background: { r: 26, g: 26, b: 26 }
      }
    })
    .png()
    .toBuffer()
  }
}

// Cache untuk back template
let templateImageBack: Buffer | null = null

async function getTemplateImageBack(): Promise<Buffer> {
  if (templateImageBack) return templateImageBack

  try {
    const templatePath = path.join(process.cwd(), 'public', 'template kta', 'KTA AI - BACK.svg')
    const pngCachePath = path.join('/tmp', 'kta-template-back-hires.png')

    // Check if PNG cache exists
    try {
      const cached = await fs.readFile(pngCachePath)
      templateImageBack = cached
      return templateImageBack
    } catch {}

    // Convert SVG to PNG using sharp - high resolution (2x)
    const svgBuffer = await fs.readFile(templatePath)

    const pngBuffer = await sharp(svgBuffer)
      .resize(CARD_WIDTH, CARD_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer()

    templateImageBack = pngBuffer

    // Cache for future use
    await fs.mkdir('/tmp', { recursive: true })
    await fs.writeFile(pngCachePath, pngBuffer)

    return templateImageBack
  } catch (error) {
    console.error('Error loading back template:', error)
    // Return fallback - solid color with high resolution
    return sharp({
      create: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        channels: 3,
        background: { r: 26, g: 26, b: 26 }
      }
    })
    .png()
    .toBuffer()
  }
}

export class KTAPDFGenerator {
  private static readonly outputDir = path.join('/tmp', 'kta-cards')

  static async generateKTACard(ktaData: KTAData): Promise<Buffer> {
    await fs.mkdir(this.outputDir, { recursive: true })

    const pdfDoc = await PDFDocument.create()

    // Register fontkit for custom fonts
    pdfDoc.registerFontkit((fontkit as any).default || fontkit)

    const page = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT])

    // Load Manrope fonts from URL (works on Vercel)
    const manropeBytes = await getManropeFont()
    const manropeFont = await pdfDoc.embedFont(manropeBytes)

    const manropeMediumBytes = await getManropeMediumFont()
    const manropeMediumFont = await pdfDoc.embedFont(manropeMediumBytes)

    // Load and embed template
    const templateBuffer = await getTemplateImage()
    const templateImage = await pdfDoc.embedPng(templateBuffer)

    // Draw template background (full card size)
    page.drawImage(templateImage, {
      x: 0,
      y: 0,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    })

    // Format data
    const formattedNama = capitalizeEachWord(formatNama(ktaData.nama))
    const alamatLines = formatAlamat(ktaData.alamat).map(line => formatAlamatWithRW(line))
    const nomorKTA = ktaData.nomorKTA.toUpperCase()

    // Hitung expired date (createdAt + 5 years)
    const expiredDate = new Date(ktaData.createdAt)
    expiredDate.setFullYear(expiredDate.getFullYear() + 5)

    const issuedDateStr = formatDate(ktaData.createdAt)
    const expiredDateStr = formatDate(expiredDate)

    const colorWhite = rgb(1, 1, 1)

    // Convert preview positions to PDF positions (with SCALE)
    const toX = (previewX: number) => previewX * SCALE
    const toY = (previewY: number) => CARD_HEIGHT - (previewY * SCALE)

    // Draw Nama (top: 157px, left: 330px) - with offset
    page.drawText(formattedNama, {
      x: toX(330),
      y: toY(157 + 18),
      size: 16 * SCALE,
      font: manropeFont,
      color: colorWhite,
    })

    // Draw Alamat (3 lines max) - with offset
    // All lines: top 183px + (index * 24)px, left 330px
    alamatLines.forEach((line, index) => {
      const xPos = toX(330)
      const yPos = toY(183 + index * 24 + 16)
      page.drawText(line, {
        x: xPos,
        y: yPos,
        size: 16 * SCALE,
        font: manropeFont,
        color: colorWhite,
      })
    })

    // Draw Nomor KTA (top: 132px, left: 330px) - with offset
    page.drawText(nomorKTA, {
      x: toX(330),
      y: toY(132 + 18),
      size: 16 * SCALE,
      font: manropeFont,
      color: colorWhite,
    })

    // Draw DOM (bottom: 46px from bottom, right: 325px from right)
    // Calculate x position from right edge (600 - 325 = 275px from left)
    const domLabelX = toX(600 - 420)
    const domY = 52 * SCALE

    // Measure DOM label width (approximately 30px at 15pt font)
    page.drawText('CRD', {
      x: domLabelX,
      y: domY,
      size: 16 * SCALE,
      font: manropeMediumFont,
      color: colorWhite,
    })
    // Date is 60px to the right of DOM label
    page.drawText(issuedDateStr.toUpperCase(), {
      x: domLabelX + 60 * SCALE,
      y: domY,
      size: 16 * SCALE,
      font: manropeMediumFont,
      color: colorWhite,
    })

    // Draw EXP (bottom: 19px from bottom, right: 326px from right)
    // Calculate x position from right edge (600 - 326 = 274px from left)
    const expLabelX = toX(600 - 420)
    const expY = 28 * SCALE

    page.drawText('EXP', {
      x: expLabelX,
      y: expY,
      size: 16 * SCALE,
      font: manropeMediumFont,
      color: colorWhite,
    })
    // Date is 60px to the right of EXP label
    page.drawText(expiredDateStr.toUpperCase(), {
      x: expLabelX + 60 * SCALE,
      y: expY,
      size: 16 * SCALE,
      font: manropeMediumFont,
      color: colorWhite,
    })

    // Draw Photo (top: 122px, right: 412px, width: 110px, height: 140px)
    // right: 412px in 600px container → x = 600 - 412 - 110 = 78px from left
    const photoX = toX(600 - 417 - 110)
    // top: 122px, height: 140px → bottom at 122 + 140 = 262px from top
    const photoY = toY(122 + 140)
    const photoWidth = 120 * SCALE
    const photoHeight = 140 * SCALE

    // Embed photo if available
    if (ktaData.fotoData || ktaData.fotoUrl) {
      try {
        let imageBytes: Buffer

        // Prioritize fotoData (base64 from client) for geo-blocked URLs
        if (ktaData.fotoData) {
          // Parse base64 data: "data:image/xxx;base64,..."
          const base64Data = ktaData.fotoData.includes(',')
            ? ktaData.fotoData.split(',')[1]
            : ktaData.fotoData
          imageBytes = Buffer.from(base64Data, 'base64')
        } else if (ktaData.fotoUrl) {
          if (ktaData.fotoUrl.startsWith('http://') || ktaData.fotoUrl.startsWith('https://')) {
            const response = await fetch(ktaData.fotoUrl)
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
            const arrayBuffer = await response.arrayBuffer()
            imageBytes = Buffer.from(arrayBuffer)
          } else {
            const imagePath = path.join(process.cwd(), 'public', ktaData.fotoUrl)
            imageBytes = await fs.readFile(imagePath)
          }
        } else {
          throw new Error('No photo data or URL provided')
        }

        // Resize & add rounded corners with sharp
        const targetWidth = Math.round(photoWidth - 2 * SCALE)
        const targetHeight = Math.round(photoHeight - 2 * SCALE)
        const cornerRadius = 12

        // Resize image with alpha
        const resizedImage = await sharp(imageBytes)
          .resize(targetWidth, targetHeight, { fit: 'cover' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })

        const { data, info } = resizedImage
        const pixels = new Uint8ClampedArray(data)

        // Manual rounded corners - set alpha to 0 outside corners
        for (let y = 0; y < info.height; y++) {
          for (let x = 0; x < info.width; x++) {
            const i = (y * info.width + x) * 4

            // Top-left corner
            if (x < cornerRadius && y < cornerRadius) {
              const dx = cornerRadius - x
              const dy = cornerRadius - y
              if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
                pixels[i + 3] = 0 // Transparent
              }
            }
            // Top-right corner
            else if (x >= info.width - cornerRadius && y < cornerRadius) {
              const dx = x - (info.width - cornerRadius)
              const dy = cornerRadius - y
              if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
                pixels[i + 3] = 0
              }
            }
            // Bottom-left corner
            else if (x < cornerRadius && y >= info.height - cornerRadius) {
              const dx = cornerRadius - x
              const dy = y - (info.height - cornerRadius)
              if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
                pixels[i + 3] = 0
              }
            }
            // Bottom-right corner
            else if (x >= info.width - cornerRadius && y >= info.height - cornerRadius) {
              const dx = x - (info.width - cornerRadius)
              const dy = y - (info.height - cornerRadius)
              if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
                pixels[i + 3] = 0
              }
            }
          }
        }

        // Anti-aliasing fix: make fully opaque or fully transparent (no in-between)
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] > 0 && pixels[i] < 255) {
            // For semi-transparent pixels at edges, threshold them
            pixels[i] = pixels[i] > 128 ? 255 : 0
          }
        }

        const roundedImage = await sharp(pixels, {
          raw: info
        })
          .png()
          .toBuffer()

        const image = await pdfDoc.embedPng(roundedImage)

        page.drawImage(image, {
          x: photoX + 1 * SCALE,
          y: photoY + 1 * SCALE,
          width: photoWidth - 2 * SCALE,
          height: photoHeight - 2 * SCALE,
        })
      } catch (error) {
        console.error('Error embedding photo:', error)
      }
    }

    // Draw QR Code placeholder (bottom: 10px, right: 28px)
    const qrX = toX(600 - 28 - 60)
    const qrY = 10 * SCALE
    const qrSize = 60 * SCALE

    page.drawRectangle({
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
      borderColor: rgb(1, 1, 1),
      borderWidth: 1 * SCALE,
      color: rgb(1, 1, 1),
    })

    // Embed QR code if available
    if (ktaData.qrCodePath) {
      try {
        let qrImageBytes: Buffer | undefined

        if (ktaData.qrCodePath.startsWith('http://') || ktaData.qrCodePath.startsWith('https://')) {
          const response = await fetch(ktaData.qrCodePath)
          if (!response.ok) throw new Error(`Failed to fetch QR: ${response.statusText}`)
          const arrayBuffer = await response.arrayBuffer()
          qrImageBytes = Buffer.from(arrayBuffer)
        } else {
          const qrImagePath = path.join(process.cwd(), 'public', ktaData.qrCodePath)
          try {
            qrImageBytes = await fs.readFile(qrImagePath)
          } catch {
            console.log(`QR file not found, skipping: ${qrImagePath}`)
          }
        }

        if (qrImageBytes) {
          const qrImage = await pdfDoc.embedPng(qrImageBytes)
          page.drawImage(qrImage, {
            x: qrX + 1 * SCALE,
            y: qrY + 1 * SCALE,
            width: qrSize - 2 * SCALE,
            height: qrSize - 2 * SCALE,
          })
        }
      } catch (error) {
        console.error('Error embedding QR code:', error)
      }
    }

    // ===== BACK PAGE =====
    const pageBack = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT])

    // Load and embed back template
    const templateBackBuffer = await getTemplateImageBack()
    const templateBackImage = await pdfDoc.embedPng(templateBackBuffer)

    // Draw back template background
    pageBack.drawImage(templateBackImage, {
      x: 0,
      y: 0,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    })

    const pdfBytes = await pdfDoc.save()
    return Buffer.from(pdfBytes)
  }

  static async generateBulkKTACards(ktaDataList: KTAData[]): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create()

    for (const ktaData of ktaDataList) {
      const pdfBuffer = await this.generateKTACard(ktaData)
      const tempPdf = await PDFDocument.load(pdfBuffer)
      // Copy both front (page 0) and back (page 1)
      const [frontPage, backPage] = await pdfDoc.copyPages(tempPdf, [0, 1])
      pdfDoc.addPage(frontPage)
      pdfDoc.addPage(backPage)
    }

    const pdfBytes = await pdfDoc.save()
    return Buffer.from(pdfBytes)
  }
}
