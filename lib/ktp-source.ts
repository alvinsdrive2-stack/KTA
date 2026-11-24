/**
 * Satu tempat buat ngubah `ktpUrl` jadi data URI yang siap dipakai generator PDF.
 *
 * Kenapa dipisah: jalur single (`generate-pdf`) dan bulk (`bulk-download`)
 * dulu punya aturan berbeda — single nge-fetch URL SIKI server-side, bulk
 * ngelempar URL mentah ke `KTAPDFGenerator` yang SENGAJA nolak http. Bedanya
 * bikin kartu hilang diam-diam di ZIP bulk. Sekarang dua-duanya lewat sini.
 *
 * Generator-nya sendiri tetap cuma nerima base64/file lokal — lihat komentar
 * di `lib/pdf-generator.ts`. Fetch URL eksternal memang tugas adapter ini,
 * karena di sinilah kita bisa ngasih error yang jelas ke pemanggil.
 */
import { readUpload, contentTypeFor } from './upload-storage'

const SIKI_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

/** Error yang pesannya aman ditampilkan ke user, plus status HTTP yang pas. */
export class KtpSourceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'KtpSourceError'
  }
}

/**
 * Balikin data URI (`data:image/jpeg;base64,...`) dari `ktpUrl`.
 *
 * Sumber yang didukung: file upload lokal (`/uploads/...` atau `uploads/...`)
 * dan URL eksternal (khas SIKI). URL eksternal di-fetch server-side karena
 * host SIKI sering geo-blocked kalau diakses dari browser.
 */
export async function resolveKtpDataUrl(ktpUrl: string): Promise<string> {
  if (ktpUrl.startsWith('/uploads/') || ktpUrl.startsWith('uploads/')) {
    const key = ktpUrl.replace(/^\/?uploads\//, '')
    const buffer = await readUpload(key)
    if (!buffer) {
      throw new KtpSourceError('File KTP nggak ketemu di storage', 400)
    }
    return `data:${contentTypeFor(key)};base64,${buffer.toString('base64')}`
  }

  if (ktpUrl.startsWith('http')) {
    let response: Response
    try {
      response = await fetch(ktpUrl, { headers: { 'User-Agent': SIKI_USER_AGENT } })
    } catch (error) {
      throw new KtpSourceError(
        `Gagal ambil file KTP dari SIKI: ${error instanceof Error ? error.message : 'Unknown error'}`,
        502
      )
    }

    if (!response.ok) {
      throw new KtpSourceError(`Gagal ambil file KTP dari SIKI (HTTP ${response.status})`, 502)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  }

  throw new KtpSourceError('Format ktpUrl nggak dikenali', 400)
}
