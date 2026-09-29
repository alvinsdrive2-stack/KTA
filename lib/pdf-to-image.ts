/**
 * Render halaman pertama PDF jadi PNG.
 *
 * Dipakai buat KTP yang diupload dalam bentuk PDF. sharp nggak bisa baca PDF,
 * jadi byte-nya harus diubah dulu jadi gambar sebelum masuk jalur yang sama
 * dengan jpg/png.
 *
 * Kenapa `globalThis.pdfjsWorker` diisi manual:
 *
 * pdfjs di Node sebenernya jalan di "fake worker" (worker-thread beneran nggak
 * dipakai). Buat muat mesin worker-nya, dia nulis:
 *
 *     const worker = await import(webpackIgnore: true, this.workerSrc)
 *
 * `workerSrc` default-nya `./pdf.worker.mjs` — path relatif yang di-resolve
 * terhadap lokasi chunk hasil bundle, bukan terhadap `node_modules`. Karena
 * `webpackIgnore: true`, webpack juga nggak ikut nyalin file worker-nya ke
 * `.next`. Hasilnya di server: `Cannot find module '.next/server/chunks/pdf.worker.mjs'`.
 *
 * Sebelum sampai ke `workerSrc`, pdfjs ngecek `globalThis.pdfjsWorker`. Kalau
 * ada isinya, dia langsung pakai itu dan nggak pernah nyentuh `workerSrc` sama
 * sekali. Jadi worker-nya di-import di sini — di modul kita sendiri, biar
 * webpack ngikutin dan ngelink chunk-nya — terus ditempel ke global.
 *
 * `pdfjs-dist` ikut kepasang bareng `pdf-to-img`, dan versinya dipatok `~` sama
 * paket itu, jadi worker di sini dijamin seversi sama `pdf.mjs` yang dipakai
 * `pdf-to-img`. Kalau `pdf-to-img`-nya di-upgrade dan pdfjs-nya pindah versi,
 * dua-duanya tetap ikut naik bareng.
 */
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'

function ensurePdfjsWorker(): void {
  const globalScope = globalThis as typeof globalThis & { pdfjsWorker?: unknown }

  if (!globalScope.pdfjsWorker) {
    globalScope.pdfjsWorker = pdfjsWorker
  }
}

/**
 * Balikin byte PNG halaman pertama `pdfBytes`.
 *
 * Cuma halaman pertama yang dipakai: KTP itu satu halaman, dan kalau ternyata
 * lebih (misal hasil scan yang kepisah), halaman sisanya bukan bagian dari KTP.
 */
export async function renderPdfFirstPageToPng(
  pdfBytes: Buffer,
  scale: number
): Promise<Buffer> {
  ensurePdfjsWorker()

  // Di-import dinamis supaya `pdfjs-dist` baru dimuat pas ada KTP berbentuk PDF.
  // Jalur KTP gambar (dan endpoint lain yang pakai sharp doang) nggak kena
  // biaya muatnya.
  const { pdf } = await import('pdf-to-img')

  const pages = await pdf(pdfBytes, { scale })

  if (pages.length === 0) {
    throw new Error('File PDF KTP nggak punya halaman')
  }

  for await (const page of pages) {
    return Buffer.from(page)
  }

  // Nggak mungkin ke sini — `length > 0` dijamin di atas — tapi biar tipenya jelas.
  throw new Error('Gagal render halaman pertama PDF KTP')
}
