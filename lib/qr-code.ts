import QRCode from 'qrcode'
import path from 'path'
import fs from 'fs/promises'

export interface QRCodeOptions {
  id: string
  verificationUrl: string
  outputPath?: string
}

export class QRCodeGenerator {
  private static readonly uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'qr-codes')

  static async generateQRCode(options: QRCodeOptions): Promise<string> {
    const { id, verificationUrl, outputPath } = options

    // Ensure uploads directory exists
    await fs.mkdir(this.uploadsDir, { recursive: true })

    // Generate filename
    const filename = `kta-${id}-${Date.now()}.png`
    const filePath = outputPath || path.join(this.uploadsDir, filename)

    // QR Code options
    const qrOptions = {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000', // Dots
        light: '#FFFFFF', // Background
      },
    }

    try {
      // Generate QR code
      await QRCode.toFile(filePath, verificationUrl, qrOptions)

      // Return relative path for database storage
      return `/uploads/qr-codes/${filename}`
    } catch (error) {
      console.error('QR Code generation error:', error)
      throw new Error('Failed to generate QR code')
    }
  }

  static async generateQRCodeDataURL(verificationUrl: string): Promise<string> {
    try {
      const dataURL = await QRCode.toDataURL(verificationUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })

      return dataURL
    } catch (error) {
      console.error('QR Code DataURL generation error:', error)
      throw new Error('Failed to generate QR code data URL')
    }
  }

  static async verifyQRCodeExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(process.cwd(), 'public', filePath)
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  static async deleteQRCode(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(process.cwd(), 'public', filePath)
      await fs.unlink(fullPath)
    } catch (error) {
      console.error('QR Code deletion error:', error)
    }
  }
}