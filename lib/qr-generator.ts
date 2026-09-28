import QRCode from 'qrcode'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getUploadRoot, keyToUrl } from './upload-storage'

interface QRCodeOptions {
  nik: string
  baseUrl?: string
}

export class QRCodeGenerator {
  /**
   * Generate QR code for KTA verification.
   *
   * Nyimpen PNG ke `storage/uploads/qr-codes/` dan balikin URL `/uploads/...`,
   * BUKAN data URL base64. Sebelumnya fungsi ini balikin data URL sementara
   * `bulk-download` nyimpen URL file — dua bentuk nilai di satu kolom
   * `qrCodePath`. Yang baca (`lib/pdf-generator.ts`) cuma paham salah satunya,
   * jadi separuh kartu terbit tanpa QR. Sekarang satu bentuk saja.
   *
   * URL format: {baseUrl}/verify/{nik}
   * Pakai NIK biar QR tetap valid setelah KTA di-upgrade — halaman verifikasi
   * selalu nunjukin KTA terbaru buat NIK itu.
   */
  static async generateKTAQR(options: QRCodeOptions): Promise<string> {
    // Nama file mengikuti `bulk-download` — NIK unik per orang, dan QR-nya
    // sendiri meng-encode NIK, jadi menimpa file lama memang perilaku yang benar.
    await this.writeKTAQRFile(options)

    return keyToUrl(`qr-codes/qr-${options.nik}.png`)
  }

  /**
   * Tulis PNG QR ke storage dan balikin key relatifnya.
   * Dipakai bareng oleh `generateKTAQR()` dan `bulk-download`.
   */
  static async writeKTAQRFile(options: QRCodeOptions): Promise<string> {
    const { nik } = options
    const buffer = await this.generateKTAQRBuffer(options)

    const dir = join(getUploadRoot(), 'qr-codes')
    await mkdir(dir, { recursive: true })

    const key = `qr-codes/qr-${nik}.png`
    await writeFile(join(dir, `qr-${nik}.png`), buffer)

    return key
  }

  /**
   * Generate QR code as base64 string (for direct embedding)
   * Same as generateKTAQR but returns only base64 without prefix
   */
  static async generateKTAQRBase64(options: QRCodeOptions): Promise<string> {
    const buffer = await this.generateKTAQRBuffer(options)
    return buffer.toString('base64')
  }

  /**
   * Generate QR code as buffer.
   *
   * `baseUrl` wajib punya skema — tanpa `https://` hasilnya URL yang nggak bisa
   * dipindai. Default lama cuma domain telanjang; sekarang skemanya ikut, dan
   * `NEXT_PUBLIC_APP_URL` tetap yang menang kalau diisi.
   */
  static async generateKTAQRBuffer(options: QRCodeOptions): Promise<Buffer> {
    const { nik, baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kta.gatensi.or.id' } = options

    // Hindari skema dobel kalau env-nya sudah lengkap.
    const origin = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`
    const qrUrl = `${origin.replace(/\/+$/, '')}/verify/${nik}`

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

