// Increase VIPS pixel limit before importing sharp
// Default limit is ~268MP, set to 1GB (1,073,741,824 pixels)
process.env.VIPS_MAX_PIXEL_LIMIT = '1073741824'

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { statSync } from 'fs'

interface KTAData {
  id: string
  nama: string
  alamat: string
  nomorKTA: string
  createdAt: Date
  tanggalDaftar: Date
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
let templateImageBack: Buffer | null = null

// Track file modification times for auto-refresh
let templateMtime: number | null = null
let templateBackMtime: number | null = null

// Clear all caches - useful after template updates
export function clearKTACache() {
  manropeFontBytes = null
  manropeMediumFontBytes = null
  templateImage = null
  templateImageBack = null
  templateMtime = null
  templateBackMtime = null
  console.log('KTA cache cleared successfully')
}

// Fetch font from filesystem first (faster), then URL as fallback
async function getManropeFont(): Promise<Buffer | ArrayBuffer> {
  if (manropeFontBytes) return manropeFontBytes

  // Try local filesystem FIRST (much faster in development)
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Manrope-SemiBold.ttf')
    manropeFontBytes = await fs.readFile(fontPath)
    console.log('✅ Font loaded from filesystem (fast)')
    return manropeFontBytes
  } catch (error) {
    console.log('⚠️ Font not in filesystem, trying URL...')
  }

  // Fallback to URL (for production or if filesystem fails)
  const isDevelopment = process.env.NODE_ENV === 'development'
  const fontUrl = isDevelopment
    ? 'http://localhost:3000/fonts/Manrope-SemiBold.ttf'
    : 'KTA.Gatensi.or.id/fonts/Manrope-SemiBold.ttf'

  try {
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
    console.log('Fetch failed, error:', error)
  }

  throw new Error('Failed to load Manrope SemiBold font')
}

async function getManropeMediumFont(): Promise<Buffer | ArrayBuffer> {
  if (manropeMediumFontBytes) return manropeMediumFontBytes

  // Try local filesystem FIRST (much faster in development)
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Manrope-Medium.ttf')
    manropeMediumFontBytes = await fs.readFile(fontPath)
    console.log('✅ Medium font loaded from filesystem (fast)')
    return manropeMediumFontBytes
  } catch (error) {
    console.log('⚠️ Medium font not in filesystem, trying URL...')
  }

  // Fallback to URL (for production or if filesystem fails)
  const isDevelopment = process.env.NODE_ENV === 'development'
  const fontUrl = isDevelopment
    ? 'http://localhost:3000/fonts/Manrope-Medium.ttf'
    : 'KTA.Gatensi.or.id/fonts/Manrope-Medium.ttf'

  try {
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
    console.log('Fetch failed, error:', error)
  }

  // Final fallback - use SemiBold
  console.warn('Manrope Medium font not available, using SemiBold')
  return getManropeFont()
}

async function getTemplateImage(): Promise<Buffer> {
  try {
    console.log('⏳ getTemplateImage() called')
    // Priority 1: Try to load pre-converted PNG from public folder
    const pngPath = path.join(process.cwd(), 'public', 'template kta', 'KTA AI - FRONT.png')
    const svgPath = path.join(process.cwd(), 'public', 'template kta', 'KTA AI - FRONT.svg')
    const pngCachePath = path.join('/tmp', 'kta-template-front-hires.png')

    let currentMtime: number | null = null
    let sourcePath = pngPath  // Default to PNG

    // Check if PNG exists in public folder
    try {
      currentMtime = statSync(pngPath).mtimeMs
      sourcePath = pngPath
    } catch {
      // PNG doesn't exist, try SVG
      try {
        currentMtime = statSync(svgPath).mtimeMs
        sourcePath = svgPath
      } catch {
        // Neither exists, use cache if available
        if (templateImage) return templateImage
        throw new Error('No template file found')
      }
    }

    // If we have cached data and file hasn't changed, return cache
    if (templateImage && templateMtime === currentMtime) {
      console.log('✅ Using cached front template')
      return templateImage
    }

    // If it's a PNG, load and resize it directly (using path, not buffer, to avoid memory issues)
    if (sourcePath.endsWith('.png')) {
      console.log('⏳ Loading PNG template from:', sourcePath)
      const pngBuffer = await sharp(sourcePath)
        .resize(CARD_WIDTH, CARD_HEIGHT, {
          fit: 'cover',
          position: 'center'
        })
        .png()
        .toBuffer()
      console.log('✅ PNG template loaded and resized')

      templateImage = pngBuffer
      templateMtime = currentMtime

      // Cache for future use
      await fs.mkdir('/tmp', { recursive: true })
      await fs.writeFile(pngCachePath, pngBuffer)

      return templateImage
    }

    // If it's an SVG, try to convert (may fail for large files)
    const pngBuffer = await sharp(sourcePath, {
      density: 300  // Higher density for better quality
    })
      .resize(CARD_WIDTH, CARD_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer()

    templateImage = pngBuffer
    templateMtime = currentMtime

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

async function getTemplateImageBack(): Promise<Buffer> {
  try {
    console.log('⏳ getTemplateImageBack() called')
    // Priority 1: Try to load pre-converted PNG from public folder
    const pngPath = path.join(process.cwd(), 'public', 'template kta', 'KTA AI - BACK.png')
    const svgPath = path.join(process.cwd(), 'public', 'template kta', 'KTA AI - BACK.svg')
    const pngCachePath = path.join('/tmp', 'kta-template-back-hires.png')

    let currentMtime: number | null = null
    let sourcePath = pngPath  // Default to PNG

    // Check if PNG exists in public folder
    try {
      currentMtime = statSync(pngPath).mtimeMs
      sourcePath = pngPath
    } catch {
      // PNG doesn't exist, try SVG
      try {
        currentMtime = statSync(svgPath).mtimeMs
        sourcePath = svgPath
      } catch {
        // Neither exists, use cache if available
        if (templateImageBack) return templateImageBack
        throw new Error('No template file found')
      }
    }

    // If we have cached data and file hasn't changed, return cache
    if (templateImageBack && templateBackMtime === currentMtime) {
      console.log('✅ Using cached back template')
      return templateImageBack
    }

    // If it's a PNG, load and resize it directly (using path, not buffer, to avoid memory issues)
    if (sourcePath.endsWith('.png')) {
      console.log('⏳ Loading PNG back template from:', sourcePath)
      const pngBuffer = await sharp(sourcePath)
        .resize(CARD_WIDTH, CARD_HEIGHT, {
          fit: 'cover',
          position: 'center'
        })
        .png()
        .toBuffer()
      console.log('✅ PNG back template loaded and resized')

      templateImageBack = pngBuffer
      templateBackMtime = currentMtime

      // Cache for future use
      await fs.mkdir('/tmp', { recursive: true })
      await fs.writeFile(pngCachePath, pngBuffer)

      return templateImageBack
    }

    // If it's an SVG, try to convert (may fail for large files)
    const pngBuffer = await sharp(sourcePath, {
      density: 300  // Higher density for better quality
    })
      .resize(CARD_WIDTH, CARD_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer()

    templateImageBack = pngBuffer
    templateBackMtime = currentMtime

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
    console.log('🚀 Starting KTA card generation for:', ktaData.nama)
    await fs.mkdir(this.outputDir, { recursive: true })

    const pdfDoc = await PDFDocument.create()
    console.log('✅ PDF document created')

    // Register fontkit for custom fonts
    pdfDoc.registerFontkit((fontkit as any).default || fontkit)

    const page = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT])

    // Load Manrope fonts from URL (works on Vercel)
    const manropeBytes = await getManropeFont()
    const manropeFont = await pdfDoc.embedFont(manropeBytes)
    console.log('✅ Font embedded successfully')

    const manropeMediumBytes = await getManropeMediumFont()
    const manropeMediumFont = await pdfDoc.embedFont(manropeMediumBytes)
    console.log('✅ Medium font embedded successfully')

    // Load and embed template
    console.log('⏳ Loading template image...')
    const templateBuffer = await getTemplateImage()
    console.log('✅ Template loaded, embedding...')
    const templateImage = await pdfDoc.embedPng(templateBuffer)
    console.log('✅ Template embedded successfully')

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

    // Hitung expired date (tanggalDaftar + 5 years)
    const expiredDate = new Date(ktaData.tanggalDaftar)
    expiredDate.setFullYear(expiredDate.getFullYear() + 5)

    const issuedDateStr = formatDate(ktaData.tanggalDaftar)
    const expiredDateStr = formatDate(expiredDate)

    const colorWhite = rgb(1, 1, 1)

    // Convert preview positions to PDF positions (with SCALE)
    const toX = (previewX: number) => previewX * SCALE
    const toY = (previewY: number) => CARD_HEIGHT - (previewY * SCALE)

    // Draw Nama (top: 157px, left: 330px) - with offset
    page.drawText(formattedNama, {
      x: toX(330),
      y: toY(157 + 18),
      size: 18 * SCALE,
      font: manropeFont,
      color: colorWhite,
    })

    // Draw Alamat (3 lines max) - with offset
    // All lines: top 183px + (index * 24)px, left 330px
    alamatLines.forEach((line, index) => {
      const xPos = toX(330)
      const yPos = toY(183 + index * 23 + 16)
      page.drawText(line, {
        x: xPos,
        y: yPos,
        size: 18 * SCALE,
        font: manropeFont,
        color: colorWhite,
      })
    })

    // Draw Nomor KTA (top: 132px, left: 330px) - with offset
    page.drawText(nomorKTA, {
      x: toX(330),
      y: toY(132 + 18),
      size: 18 * SCALE,
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
      size: 18 * SCALE,
      font: manropeMediumFont,
      color: colorWhite,
    })
    // Date is 60px to the right of DOM label
    page.drawText(issuedDateStr.toUpperCase(), {
      x: domLabelX + 60 * SCALE,
      y: domY,
      size: 18 * SCALE,
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
      size: 18 * SCALE,
      font: manropeMediumFont,
      color: colorWhite,
    })
    // Date is 60px to the right of EXP label
    page.drawText(expiredDateStr.toUpperCase(), {
      x: expLabelX + 60 * SCALE,
      y: expY,
      size: 18 * SCALE,
      font: manropeMediumFont,
      color: colorWhite,
    })

    console.log('✅ All text drawn successfully')

    // Draw Photo (top: 122px, right: 412px, width: 110px, height: 140px)
    // right: 412px in 600px container → x = 600 - 412 - 110 = 78px from left
    const photoX = toX(600 - 417 - 110)
    // top: 122px, height: 140px → bottom at 122 + 140 = 262px from top
    const photoY = toY(122 + 140)
    const photoWidth = 120 * SCALE
    const photoHeight = 140 * SCALE

    // Embed photo if available
    if (ktaData.fotoData || ktaData.fotoUrl) {
      console.log('⏳ Processing photo...')
      try {
        let imageBytes: Buffer

        // Prioritize fotoData (base64 from database) for geo-blocked URLs
        if (ktaData.fotoData) {
          console.log('⏳ Using base64 foto data...')
          // Parse base64 data: "data:image/xxx;base64,..."
          const base64Data = ktaData.fotoData.includes(',')
            ? ktaData.fotoData.split(',')[1]
            : ktaData.fotoData
          imageBytes = Buffer.from(base64Data, 'base64')
          console.log('✅ Base64 decoded')
        } else if (ktaData.fotoUrl && !ktaData.fotoUrl.startsWith('http')) {
          console.log('⏳ Reading local photo file...')
          // Only fetch local files - skip external URLs (geo-blocked, etc)
          const imagePath = path.join(process.cwd(), 'public', ktaData.fotoUrl)
          imageBytes = await fs.readFile(imagePath)
          console.log('✅ Photo file read')
        } else {
          // Skip external URLs - they will be geo-blocked on server
          throw new Error('Skipping external URL (use base64 data instead)')
        }

        // Resize & add rounded corners with sharp
        const targetWidth = Math.round(photoWidth - 2 * SCALE)
        const targetHeight = Math.round(photoHeight - 2 * SCALE)
        const cornerRadius = 12

        // Resize image with alpha
        console.log('⏳ Resizing photo with sharp...')
        const resizedImage = await sharp(imageBytes)
          .resize(targetWidth, targetHeight, { fit: 'cover' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        console.log('✅ Photo resized')

        const { data, info } = resizedImage
        const pixels = new Uint8ClampedArray(data)
        console.log('⏳ Processing rounded corners...')

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

        console.log('⏳ Creating rounded image...')
        const roundedImage = await sharp(pixels, {
          raw: info
        })
          .png()
          .toBuffer()
        console.log('✅ Rounded image created')

        const image = await pdfDoc.embedPng(roundedImage)
        console.log('✅ Photo embedded to PDF')

        page.drawImage(image, {
          x: photoX + 1 * SCALE,
          y: photoY + 1 * SCALE,
          width: photoWidth - 2 * SCALE,
          height: photoHeight - 2 * SCALE,
        })
      } catch (error) {
        // Silently skip photo if loading fails (geo-blocked URL, etc.)
        console.log('❌ Photo processing error:', error instanceof Error ? error.message : 'Unknown error')
      }
    }

    console.log('✅ Photo processing complete')

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
      console.log('⏳ Processing QR code...')
      try {
        let qrImageBytes: Buffer | undefined

        // Handle base64 data URL (from QRCodeGenerator)
        if (ktaData.qrCodePath.startsWith('data:image/')) {
          console.log('⏳ QR is base64 data URL, decoding...')
          const base64Data = ktaData.qrCodePath.split(',')[1]
          qrImageBytes = Buffer.from(base64Data, 'base64')
          console.log('✅ QR base64 decoded, size:', qrImageBytes.length)
        }
        // Handle HTTP/HTTPS URL
        else if (ktaData.qrCodePath.startsWith('http://') || ktaData.qrCodePath.startsWith('https://')) {
          console.log('⏳ QR is HTTP URL, fetching:', ktaData.qrCodePath)
          const response = await fetch(ktaData.qrCodePath)
          if (!response.ok) throw new Error(`Failed to fetch QR: ${response.statusText}`)
          const arrayBuffer = await response.arrayBuffer()
          qrImageBytes = Buffer.from(arrayBuffer)
          console.log('✅ QR fetched, size:', qrImageBytes.length)
        }
        // Handle local file path
        else {
          console.log('⏳ QR is local file path:', ktaData.qrCodePath)
          const qrImagePath = path.join(process.cwd(), 'public', ktaData.qrCodePath)
          try {
            qrImageBytes = await fs.readFile(qrImagePath)
            console.log('✅ QR file read, size:', qrImageBytes.length)
          } catch {
            console.log(`❌ QR file not found, skipping: ${qrImagePath}`)
          }
        }

        if (qrImageBytes) {
          // Validate PNG data - must be at least 1KB and have PNG signature
          const isValidPng = qrImageBytes.length > 1000 &&
            qrImageBytes[0] === 0x89 &&
            qrImageBytes[1] === 0x50 &&
            qrImageBytes[2] === 0x4E &&
            qrImageBytes[3] === 0x47

          if (!isValidPng) {
            console.log('⚠️ Invalid QR code PNG data (size:', qrImageBytes.length, '), skipping QR code')
            console.log('First 20 bytes:', Array.from(qrImageBytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '))
          } else {
            console.log('⏳ Embedding QR to PDF (this may take a moment)...')
            try {
              const qrImage = await pdfDoc.embedPng(qrImageBytes)
              console.log('✅ QR embedded successfully')
              page.drawImage(qrImage, {
                x: qrX + 1 * SCALE,
                y: qrY + 1 * SCALE,
                width: qrSize - 2 * SCALE,
                height: qrSize - 2 * SCALE,
              })
              console.log('✅ QR drawn to page')
            } catch (embedError) {
              console.log('❌ Failed to embed QR, continuing without it:', embedError instanceof Error ? embedError.message : 'Unknown error')
            }
          }
        }
      } catch (error) {
        console.log('❌ QR code error:', error instanceof Error ? error.message : 'Unknown error')
        console.error('QR error details:', error)
      }
    } else {
      console.log('ℹ️ No QR code path provided')
    }

    console.log('✅ QR code processing complete')

    // ===== BACK PAGE =====
    console.log('⏳ Generating back page...')
    const pageBack = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT])

    // Load and embed back template
    console.log('⏳ Loading back template...')
    const templateBackBuffer = await getTemplateImageBack()
    const templateBackImage = await pdfDoc.embedPng(templateBackBuffer)

    // Draw back template background
    pageBack.drawImage(templateBackImage, {
      x: 0,
      y: 0,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    })

    console.log('⏳ Saving PDF...')
    const pdfBytes = await pdfDoc.save()
    console.log('✅ PDF saved successfully')
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
