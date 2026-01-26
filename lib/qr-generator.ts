import QRCode from 'qrcode'
import fs from 'fs/promises'
import path from 'path'

interface QRCodeOptions {
  nik: string
  baseUrl?: string
}

export class QRCodeGenerator {
  // Use /tmp for Vercel serverless compatibility
  private static readonly qrDir = '/tmp/qr-codes'

  /**
   * Generate QR code for KTA verification
   * Returns base64 data URL for direct embedding in PDF
   * QR code contains URL to public verification page
   * URL format: {baseUrl}/verify/{nik}
   *
   * NIK-based format ensures QR remains valid after KTA upgrades
   * (always shows the latest approved KTA for that NIK)
   */
  static async generateKTAQR(options: QRCodeOptions): Promise<string> {
    const { nik, baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'Kta.Gatensi.or.id/KTA' } = options

    // Generate QR code URL using NIK
    const qrUrl = `${baseUrl}/verify/${nik}`

    // Generate QR code as buffer first (more reliable than toDataURL)
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

    // Convert buffer to base64 data URL
    const base64 = qrBuffer.toString('base64')
    const qrDataUrl = `data:image/png;base64,${base64}`

    console.log('Generated QR code, buffer size:', qrBuffer.length, 'base64 size:', base64.length)

    return qrDataUrl // Returns "data:image/png;base64,..."
  }

  /**
   * Generate QR code as base64 string (for direct embedding)
   * Same as generateKTAQR but returns only base64 without prefix
   */
  static async generateKTAQRBase64(options: QRCodeOptions): Promise<string> {
    const dataUrl = await this.generateKTAQR(options)
    // Remove "data:image/png;base64," prefix
    return dataUrl.split(',')[1]
  }

  /**
   * Generate QR code as buffer (for file operations if needed)
   */
  static async generateKTAQRBuffer(options: QRCodeOptions): Promise<Buffer> {
    const { nik, baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'kta.Gatensi.or.id/KTA' } = options

    // Generate QR code URL using NIK
    const qrUrl = `${baseUrl}/verify/${nik}`

    // Generate QR code as PNG buffer
    return await QRCode.toBuffer(qrUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
  }
}
