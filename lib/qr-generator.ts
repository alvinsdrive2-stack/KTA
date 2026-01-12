import QRCode from 'qrcode'
import fs from 'fs/promises'
import path from 'path'

interface QRCodeOptions {
  id: string
  nomorKTA: string
  baseUrl?: string
}

export class QRCodeGenerator {
  private static readonly qrDir = path.join(process.cwd(), 'public', 'qr-codes')

  /**
   * Generate QR code for KTA verification
   * QR code contains URL to public verification page
   * URL format: {baseUrl}/qr/{id}/{nomorKTA}
   */
  static async generateKTAQR(options: QRCodeOptions): Promise<string> {
    const { id, nomorKTA, baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' } = options

    // Create QR code directory if not exists
    await fs.mkdir(this.qrDir, { recursive: true })

    // Generate QR code URL
    const qrUrl = `${baseUrl}/qr/${id}/${nomorKTA}`

    // Generate QR code filename
    const filename = `kta-${id}.png`
    const filepath = path.join(this.qrDir, filename)
    const publicPath = `/qr-codes/${filename}`

    // Check if QR code already exists
    try {
      await fs.access(filepath)
      return publicPath
    } catch {
      // File doesn't exist, generate new QR code
    }

    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

    // Save QR code to file
    await fs.writeFile(filepath, qrBuffer)

    return publicPath
  }

  /**
   * Generate QR code as base64 string (for direct embedding)
   */
  static async generateKTAQRBase64(options: QRCodeOptions): Promise<string> {
    const { id, nomorKTA, baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' } = options

    // Generate QR code URL
    const qrUrl = `${baseUrl}/qr/${id}/${nomorKTA}`

    // Generate QR code as base64
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

    // Remove "data:image/png;base64," prefix and return just the base64 string
    return qrDataUrl.split(',')[1]
  }
}
