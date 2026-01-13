import QRCode from 'qrcode'
import fs from 'fs/promises'
import path from 'path'

interface QRCodeOptions {
  id: string
  nomorKTA: string
  baseUrl?: string
}

export class QRCodeGenerator {
  // Use /tmp for Vercel serverless compatibility
  private static readonly qrDir = '/tmp/qr-codes'

  /**
   * Generate QR code for KTA verification
   * Returns base64 data URL for direct embedding in PDF
   * QR code contains URL to public verification page
   * URL format: {baseUrl}/qr/{id}/{nomorKTA}
   */
  static async generateKTAQR(options: QRCodeOptions): Promise<string> {
    const { id, nomorKTA, baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ktagatensi.vercel.app/' } = options

    // Generate QR code URL
    const qrUrl = `${baseUrl}/qr/${id}/${nomorKTA}`

    // Generate QR code as base64 data URL (no file writing needed)
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

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
    const { id, nomorKTA, baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ktagatensi.vercel.app/' } = options

    // Generate QR code URL
    const qrUrl = `${baseUrl}/qr/${id}/${nomorKTA}`

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
