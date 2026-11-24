/**
 * Test regresi halaman KTP: sumber KTP diresolusi seragam, dan halaman KTP
 * nggak boleh keluar kosong walau scan-nya berupa lembar A4 dengan margin putih.
 *
 * Bug yang dijaga:
 * - `fit: 'cover'` memotong tengah frame, jadi scan A4 portrait kehilangan
 *   KTP-nya dan halaman hasilnya nyaris putih.
 * - Jalur bulk meneruskan `ktpUrl` http mentah ke generator yang menolaknya,
 *   sehingga kartu hilang dari ZIP tanpa pesan.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

import { resolveKtpDataUrl, KtpSourceError } from '@/lib/ktp-source'
import { KTAPDFGenerator } from '@/lib/pdf-generator'

/** Gambar "scan KTP": kanvas putih A4 portrait, KTP cuma di bagian atas. */
async function buatScanA4(): Promise<Buffer> {
  const ktp = await sharp({
    create: { width: 900, height: 560, channels: 3, background: { r: 40, g: 110, b: 180 } },
  }).png().toBuffer()

  return sharp({
    create: { width: 1190, height: 1684, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: ktp, top: 60, left: 145 }])
    .png()
    .toBuffer()
}

/** Rata-rata kecerahan halaman pertama PDF hasil generate (0 = hitam, 255 = putih). */
async function kecerahanHalamanPertama(pdf: Buffer): Promise<number> {
  const { pdf: pdfToImg } = await import('pdf-to-img')
  const pages = await pdfToImg(pdf, { scale: 1 })
  for await (const page of pages) {
    const stats = await sharp(Buffer.from(page)).greyscale().stats()
    return stats.channels[0].mean
  }
  throw new Error('PDF hasil generate nggak punya halaman')
}

describe('resolveKtpDataUrl()', () => {
  test('file lokal dibaca dari storage jadi data URI', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ktp-source-'))
    const previousRoot = process.env.UPLOAD_DIR
    process.env.UPLOAD_DIR = root

    try {
      await mkdir(join(root, 'documents'), { recursive: true })
      await writeFile(join(root, 'documents', 'ktp-contoh.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))

      const url = await resolveKtpDataUrl('/uploads/documents/ktp-contoh.jpg')

      assert.match(url, /^data:image\/jpeg;base64,/)
    } finally {
      if (previousRoot === undefined) delete process.env.UPLOAD_DIR
      else process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  test('file lokal yang nggak ada -> KtpSourceError 400, bukan crash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ktp-source-'))
    const previousRoot = process.env.UPLOAD_DIR
    process.env.UPLOAD_DIR = root

    try {
      await assert.rejects(
        () => resolveKtpDataUrl('/uploads/documents/nggak-ada.jpg'),
        (error: unknown) => error instanceof KtpSourceError && error.status === 400
      )
    } finally {
      if (previousRoot === undefined) delete process.env.UPLOAD_DIR
      else process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  test('URL eksternal (SIKI) di-fetch server-side jadi data URI', async () => {
    const asli = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg; charset=binary' },
      })) as typeof fetch

    try {
      const url = await resolveKtpDataUrl('https://perizinan.pu.go.id/ktp-contoh.pdf')
      assert.match(url, /^data:image\/jpeg;base64,/)
    } finally {
      globalThis.fetch = asli
    }
  })

  test('URL eksternal gagal -> KtpSourceError 502 dengan pesan yang kebaca', async () => {
    const asli = globalThis.fetch
    globalThis.fetch = (async () => new Response('nope', { status: 403 })) as typeof fetch

    try {
      await assert.rejects(
        () => resolveKtpDataUrl('https://perizinan.pu.go.id/ktp-contoh.pdf'),
        (error: unknown) => error instanceof KtpSourceError && error.status === 502 && /HTTP 403/.test(error.message)
      )
    } finally {
      globalThis.fetch = asli
    }
  })

  test('format yang nggak dikenali ditolak', async () => {
    await assert.rejects(
      () => resolveKtpDataUrl('ftp://contoh/ktp.jpg'),
      (error: unknown) => error instanceof KtpSourceError && error.status === 400
    )
  })
})

describe('halaman KTP di PDF', () => {
  test('scan A4 bermargin putih tetap nampilin KTP, bukan halaman kosong', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ktp-scan-'))
    const previousRoot = process.env.UPLOAD_DIR
    process.env.UPLOAD_DIR = root

    try {
      await mkdir(join(root, 'documents'), { recursive: true })
      await writeFile(join(root, 'documents', 'ktp-a4.png'), await buatScanA4())

      const pdf = await KTAPDFGenerator.generateKTACard({
        id: 'uji-ktp',
        nik: '3201234567890001',
        nama: 'BUDI SANTOSO',
        alamat: 'JL MERDEKA NO 1 RT 01 RW 02',
        nomorKTA: '99.01.000001',
        createdAt: new Date('2026-01-01'),
        tanggalDaftar: new Date('2026-01-01'),
        qrCodePath: '',
        ktpUrl: '/uploads/documents/ktp-a4.png',
      })

      // Kalau KTP terpotong habis, halamannya nyaris putih (mean ~220-255).
      // KTP yang benar-benar kelihatan jatuh jauh di bawah 100.
      const mean = await kecerahanHalamanPertama(pdf)
      assert.ok(mean < 100, `halaman KTP kelihatan kosong (rata-rata kecerahan ${mean.toFixed(1)})`)
    } finally {
      if (previousRoot === undefined) delete process.env.UPLOAD_DIR
      else process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })
})
