// Increase VIPS pixel limit before importing sharp
// Default limit is ~268MP, set to 1GB (1,073,741,824 pixels)
process.env.VIPS_MAX_PIXEL_LIMIT = '1073741824'

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { statSync } from 'fs'
import { capitalizeEachWord, formatAlamatWithRW } from './kta-format'
import { readUpload } from './upload-storage'
import { renderPdfFirstPageToPng } from './pdf-to-image'

interface KTAData {
  id: string
  nama: string
  alamat: string
  nomorKTA: string
  createdAt: Date
  tanggalDaftar: Date
  qrCodePath: string
  /** Dipakai buat bikin ulang QR kalau file/link yang tersimpan nggak ketemu. */
  nik?: string
  fotoUrl?: string
  fotoData?: string  // base64 image data (client-side fetch)
  /**
   * KTP anggota. Kalau salah satunya diisi, `generateKTACard()` nambahin satu
   * halaman KTP di DEPAN kartu (urutannya KTP -> depan -> belakang).
   *
   * Bedanya dari foto: kartu dianggap cetakan resmi yang harus punya KTP, jadi
   * halaman ini WAJIB ada begitu diminta — bacaannya gagal = error, bukan
   * diam-diam dilewat. Halaman foto di muka kartu tetap opsional seperti biasa.
   */
  ktpUrl?: string
  ktpData?: string
}


/**
 * Baca file QR dari disk.
 *
 * File upload disimpan di `getUploadRoot()` (= `storage/uploads`), BUKAN di
 * `public/` — lihat penjelasan di `lib/upload-storage.ts`. Yang tersimpan di
 * kolom `qrCodePath` bentuknya URL (`/uploads/qr-codes/qr-<nik>.png`), jadi
 * prefix `uploads/` dibuang dulu sebelum jadi key.
 *
 * Fallback ke `public/` dipertahankan buat jaga-jaga kalau masih ada baris lama
 * yang nyimpen path gaya itu.
 */
async function readLocalQrFile(qrCodePath: string): Promise<Buffer | null> {
  const key = qrCodePath.replace(/^\/?uploads\//, '')
  const fromStorage = await readUpload(key)
  if (fromStorage) return fromStorage

  try {
    return await fs.readFile(path.join(process.cwd(), 'public', qrCodePath))
  } catch {
    return null
  }
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
    return abbreviated
  }

  // Nama belakang nggak boleh hilang diam-diam. Kalau singkatan + nama belakang
  // tetap kepanjangan, potong paksa dengan elipsis — jelek tapi lengkap,
  // bukan rapi tapi datanya kurang.
  return (abbreviated + ' ' + lastWord).slice(0, maxChars - 3) + '...'
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
  const line2Words: string[] = []
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

/**
 * Tinggi halaman KTP kalau lebarnya disamain sama kartu.
 *
 * Lebarnya sengaja ikut `CARD_WIDTH` biar tumpukan KTP + kartu rapi waktu
 * dicetak (nggak ada halaman yang lebih sempit/lebar). Tingginya ngikutin rasio
 * asli KTP (85,6 x 53,98 mm = 1,5858) yang dihitung dari lebar itu.
 */
const KTP_PAGE_WIDTH = CARD_WIDTH
const KTP_PAGE_HEIGHT = Math.round((KTP_PAGE_WIDTH * 53.98) / 85.6)

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

  // Cache disk di /tmp juga dibuang. Kalau nggak, template hasil resize yang
  // lama bakal terus dipakai lewat jalur fallback `readCachedTemplate()` —
  // ganti file template di `public/` nggak akan kelihatan efeknya.
  for (const cachePath of ['/tmp/kta-template-front-hires.png', '/tmp/kta-template-back-hires.png']) {
    fs.unlink(cachePath).catch(() => {
      // Nggak ada file-nya = sudah bersih, bukan error.
    })
  }

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

/**
 * Kompresi template.
 *
 * Template aslinya 12520x7901 (99 megapixel). Setelah di-resize ke ukuran kartu
 * (1200x760, ~150 DPI) isinya masih ~500 KB kalau di-encode PNG, dan itu
 * ke-double karena kartu punya dua halaman. Totalnya ~1 MB per kartu, jauh di
 * atas batas 500 KB.
 *
 * JPEG kualitas 82 di ukuran ini turun ke ~100-150 KB dengan hasil cetak yang
 * masih tajam. Ini cuma template — teks dan QR-nya digambar vektor/PNG terpisah,
 * jadi nggak ikut turun kualitasnya.
 */
const TEMPLATE_JPEG_QUALITY = 82

/**
 * Kualitas JPEG buat halaman KTP.
 *
 * KTP itu foto dokumen — ada teks kecil (NIK, alamat) yang harus kebaca setelah
 * dicetak, beda dari foto wajah yang cukup dikenali. Kualitasnya dinaikin dari
 * template biar teksnya nggak pecah, tapi tetap di bawah 90 karena di atas itu
 * ukuran filenya naik tajam tanpa beda yang kelihatan.
 */
const KTP_JPEG_QUALITY = 88

/**
 * Baca template hasil resize dari cache disk (`/tmp`).
 *
 * Balikin `null` kalau file-nya nggak ada atau nggak bisa dibaca — pemanggil
 * yang mutusin fallback berikutnya, jadi jangan throw di sini.
 *
 * Isi file adalah JPEG, jadi konsumennya wajib `embedJpg()`, bukan `embedPng()`.
 */
async function readCachedTemplate(cachePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(cachePath)
  } catch {
    return null
  }
}

async function getTemplateImage(): Promise<Buffer> {
  try {
    console.log('⏳ getTemplateImage() called')
    // Priority 1: Try to load pre-converted PNG from public folder
    const pngPath = path.join(process.cwd(), 'public', 'template kta', 'KTA AI - FRONT.png')
    const svgPath = path.join(process.cwd(), 'public', 'template kta', 'KTA AI - FRONT.svg')
    // Isinya JPEG (lihat TEMPLATE_JPEG_QUALITY), walau namanya masih .png dari
    // versi sebelumnya. Ekstensi sengaja TIDAK diubah supaya cache lama di /tmp
    // tetap kebaca setelah deploy pertama.
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
        // Dua-duanya nggak ada. Pakai cache di disk sebelum menyerah — cache ini
        // yang dulu cuma ditulis tapi nggak pernah dibaca, jadi jalur ini selalu
        // berakhir throw padahal hasil resize-nya ada.
        const fromDisk = await readCachedTemplate(pngCachePath)
        if (fromDisk) {
          console.log('✅ Using on-disk cached front template (source file missing)')
          templateImage = fromDisk
          return templateImage
        }
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
        .jpeg({ quality: TEMPLATE_JPEG_QUALITY, mozjpeg: true })
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
      .jpeg({ quality: TEMPLATE_JPEG_QUALITY, mozjpeg: true })
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
    .jpeg({ quality: TEMPLATE_JPEG_QUALITY, mozjpeg: true })
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
        // Dua-duanya nggak ada. Sama seperti template depan: pakai cache disk
        // dulu sebelum menyerah. Isinya JPEG walau namanya .png.
        const fromDisk = await readCachedTemplate(pngCachePath)
        if (fromDisk) {
          console.log('✅ Using on-disk cached back template (source file missing)')
          templateImageBack = fromDisk
          return templateImageBack
        }
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
        .jpeg({ quality: TEMPLATE_JPEG_QUALITY, mozjpeg: true })
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
      .jpeg({ quality: TEMPLATE_JPEG_QUALITY, mozjpeg: true })
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
    .jpeg({ quality: TEMPLATE_JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
  }
}

/**
 * Skala render PDF KTP ke titik. 2x dari ukuran tampil, biar teks kecil di
 * halaman hasil (NIK, alamat) nggak pecah — sama alasannya dengan
 * `KTP_JPEG_QUALITY`.
 */
const KTP_PDF_RENDER_SCALE = 2

/** Titik yang dipakai buat ngenalin header file secara mentah. */
function isPdfBytes(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.subarray(0, 5).toString('latin1') === '%PDF-'
}

/**
 * Ubah PDF KTP jadi gambar (PNG) halaman pertama.
 *
 * KTP yang diupload dari dashboard boleh berupa PDF (`accept=".jpg,.jpeg,.png,.pdf"`),
 * tapi sharp nggak bisa baca PDF — kalau byte-nya dikasih langsung ke sharp,
 * errornya `Input buffer contains unsupported image format`. Di sini PDF-nya
 * di-render dulu lewat pdf.js, jadi sisa jalur di bawahnya tetap cuma nerima
 * gambar. Detail worker-nya ada di `lib/pdf-to-image.ts`.
 */
async function pdfFirstPageToPng(pdfBytes: Buffer): Promise<Buffer> {
  return renderPdfFirstPageToPng(pdfBytes, KTP_PDF_RENDER_SCALE)
}

/**
 * Ambil byte gambar KTP dari base64 atau dari storage lokal.
 *
 * Hanya menerima dua sumber, sama seperti foto: base64 (`ktpData`) dan file
 * lokal (`/uploads/...`). URL eksternal SENGAJA ditolak — server produksi
 * kena geo-block ke host SIKI, jadi fetch-nya bakal gagal di tengah proses dan
 * hasilnya kartu tanpa KTP. Kalau ketemu URL http, lempar error biar kelihatan
 * di pemanggil, bukan diam-diam dilewat.
 *
 * Yang dibalikin selalu byte GAMBAR. Kalau sumbernya PDF, halamannya dirender
 * dulu — lihat `pdfFirstPageToPng()`.
 */
async function readKtpImageBytes(ktpData?: string, ktpUrl?: string): Promise<Buffer> {
  const raw = await readKtpRawBytes(ktpData, ktpUrl)

  return isPdfBytes(raw) ? await pdfFirstPageToPng(raw) : raw
}

/**
 * Byte mentah dari sumbernya, sebelum diubah jadi gambar.
 *
 * Dipisah dari `readKtpImageBytes()` biar jalur PDF dan jalur gambar sama-sama
 * lewat satu tempat baca file — termasuk pesan errornya.
 */
async function readKtpRawBytes(ktpData?: string, ktpUrl?: string): Promise<Buffer> {
  if (ktpData) {
    const base64Data = ktpData.includes(',') ? ktpData.split(',')[1] : ktpData
    return Buffer.from(base64Data, 'base64')
  }

  if (ktpUrl) {
    if (ktpUrl.startsWith('http')) {
      throw new Error(
        `KTP masih berupa URL eksternal (${ktpUrl}) — perlu di-fetch jadi base64 dulu sebelum bikin PDF`
      )
    }
    const key = ktpUrl.replace(/^\/?uploads\//, '')
    const buffer = await readUpload(key)
    if (!buffer) {
      throw new Error(`File KTP nggak ketemu di storage: ${ktpUrl}`)
    }
    return buffer
  }

  throw new Error('KTP diminta tapi ktpData dan ktpUrl dua-duanya kosong')
}

export class KTAPDFGenerator {
  private static readonly outputDir = path.join('/tmp', 'kta-cards')

  static async generateKTACard(ktaData: KTAData): Promise<Buffer> {
    console.log('🚀 Starting KTA card generation for:', ktaData.nama)
    await fs.mkdir(this.outputDir, { recursive: true })

    const pdfDoc = await PDFDocument.create()
    console.log('✅ PDF document created')

    // Register fontkit for custom fonts
    pdfDoc.registerFontkit((fontkit as { default?: typeof fontkit }).default || fontkit)

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
    const templateImage = await pdfDoc.embedJpg(templateBuffer)
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
          // Foto hasil upload anggota disimpan di `storage/uploads/` (di luar
          // `public/`) dan di DB cuma dicatat sebagai `/uploads/<key>`. Baca
          // lewat readUpload() biar key-nya di-resolve ke root yang bener.
          const key = ktaData.fotoUrl.replace(/^\/?uploads\//, '')
          const fileBuffer = await readUpload(key)
          if (!fileBuffer) {
            throw new Error(`Foto nggak ketemu di storage: ${ktaData.fotoUrl}`)
          }
          imageBytes = fileBuffer
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
        // PNG di sini boros: foto bertekstur di-downscale ke 236x276 lalu
        // di-encode lossless, dan PNG nggak bisa ngompres noise. Terukur, foto
        // 800x1067 bikin PDF 471 KB — mepet batas 500 KB, padahal tanpa foto
        // cuma 295 KB. PNG dipakai karena sudut membulat butuh alpha (JPEG nggak
        // punya), dan latar sekeliling foto bukan warna rata (biru di atas,
        // kuning di bawah) jadi flatten ke satu warna bakal kelihatan belang.
        //
        // Jalan tengahnya: palette PNG. Sudut membulat tetap punya alpha, tapi
        // warnanya dikuantisasi. Di 236x276 efeknya nggak kelihatan.
        const roundedImage = await sharp(pixels, {
          raw: info
        })
          .png({ palette: true, colours: 128, effort: 10, compressionLevel: 9 })
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
    let qrImageBytes: Buffer | undefined
    if (ktaData.qrCodePath) {
      console.log('⏳ Processing QR code...')
      try {
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
          const fileBuffer = await readLocalQrFile(ktaData.qrCodePath)
          if (fileBuffer) {
            qrImageBytes = fileBuffer
            console.log('✅ QR file read, size:', qrImageBytes.length)
          } else {
            console.log(`❌ QR file not found: ${ktaData.qrCodePath}`)
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
            qrImageBytes = undefined
          }
        }
      } catch (error) {
        console.log('❌ QR code error:', error instanceof Error ? error.message : 'Unknown error')
        console.error('QR error details:', error)
      }
    } else {
      console.log('ℹ️ No QR code path provided')
    }

    // Jaring pengaman terakhir: kartu TANPA QR nggak boleh lolos diam-diam.
    // Kalau apa pun di atas gagal, bikin QR baru dari NIK — QR-nya sendiri
    // meng-encode NIK, jadi hasilnya sama dengan yang seharusnya tersimpan.
    if (!qrImageBytes && ktaData.nik) {
      console.log('⚠️ QR tidak terbaca, bikin ulang dari NIK:', ktaData.nik)
      try {
        const { QRCodeGenerator } = await import('./qr-generator')
        qrImageBytes = await QRCodeGenerator.generateKTAQRBuffer({ nik: ktaData.nik })
        console.log('✅ QR darurat dibuat, size:', qrImageBytes.length)
      } catch (fallbackError) {
        console.error('❌ Gagal bikin QR darurat:', fallbackError)
      }
    }

    if (qrImageBytes) {
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
        console.error(
          `❌ Gagal embed QR (KTA ${ktaData.nomorKTA || ktaData.id}, NIK ${ktaData.nik || '-'}):`,
          embedError instanceof Error ? embedError.message : 'Unknown error'
        )
      }
    } else {
      // Sampai sini artinya kartu ini terbit tanpa QR — selalu salah, jadi
      // jangan cuma di-log pakai console.log biasa.
      console.error(
        `❌ KTA ${ktaData.nomorKTA || ktaData.id} dicetak TANPA QR. ` +
        `qrCodePath="${ktaData.qrCodePath || '(kosong)'}", NIK=${ktaData.nik || '(kosong)'}`
      )
    }

    console.log('✅ QR code processing complete')

    // ===== HALAMAN KTP =====
    //
    // Urutan halaman yang dihasilkan: KTP, muka kartu, belakang kartu. Halaman
    // KTP ditambahin di sini (setelah halaman muka digambar, sebelum belakang)
    // supaya indeks halaman belakang tetap terakhir.
    //
    // Kalau KTP diminta tapi gagalnya nggak ketolong, error sengaja dibiarkan
    // naik: mencetak kartu tanpa KTP dianggap lebih berbahaya daripada gagal
    // download, karena kartu-nya kelihatan sah padahal dokumennya bolong.
    if (ktaData.ktpData || ktaData.ktpUrl) {
      console.log('⏳ Processing KTP page...')
      const ktpBytes = await readKtpImageBytes(ktaData.ktpData, ktaData.ktpUrl)

      // Skala ulang biar pas lebar halaman; KTP asli landscape jadi tingginya
      // nggak akan pernah lebih dari halaman.
      const resizedKtp = await sharp(ktpBytes)
        .resize(KTP_PAGE_WIDTH, KTP_PAGE_HEIGHT, { fit: 'cover', position: 'center' })
        .jpeg({ quality: KTP_JPEG_QUALITY, mozjpeg: true })
        .toBuffer()

      const pageKtp = pdfDoc.addPage([KTP_PAGE_WIDTH, KTP_PAGE_HEIGHT])
      const ktpImage = await pdfDoc.embedJpg(resizedKtp)
      pageKtp.drawImage(ktpImage, {
        x: 0,
        y: 0,
        width: KTP_PAGE_WIDTH,
        height: KTP_PAGE_HEIGHT,
      })

      // Pindahkan halaman KTP ke paling depan — halaman muka kartu sudah
      // digambar sebelumnya, jadi tanpa ini urutannya jadi kartu dulu.
      const pages = pdfDoc.getPages()
      const ktpPageRef = pages[pages.length - 1]
      pdfDoc.removePage(pages.length - 1)
      pdfDoc.insertPage(0, ktpPageRef)

      console.log('✅ KTP page added (urutan: KTP, depan, belakang)')
    }

    // ===== BACK PAGE =====
    console.log('⏳ Generating back page...')
    const pageBack = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT])

    // Load and embed back template
    console.log('⏳ Loading back template...')
    const templateBackBuffer = await getTemplateImageBack()
    const templateBackImage = await pdfDoc.embedJpg(templateBackBuffer)

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
      // Jumlah halaman nggak tetap: 3 kalau KTP disertakan, 2 kalau nggak.
      // Jangan hardcode [0, 1] — halaman belakang bakal ketuker sama KTP.
      const pageCount = tempPdf.getPageCount()
      const copiedPages = await pdfDoc.copyPages(
        tempPdf,
        Array.from({ length: pageCount }, (_, i) => i)
      )
      copiedPages.forEach(page => pdfDoc.addPage(page))
    }

    const pdfBytes = await pdfDoc.save()
    return Buffer.from(pdfBytes)
  }
}
