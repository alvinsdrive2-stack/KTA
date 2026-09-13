/**
 * Format tampilan data KTA — satu sumber.
 *
 * Kedua fungsi ini tadinya lokal di dalam `lib/pdf-generator.ts` (nggak di-export),
 * jadi tiga halaman (`kta-preview`, `qr/[id]/[nomorKTA]`, `verify/[nik]`) nulis
 * ulang versinya sendiri. Akibatnya format alamat di layar verifikasi bisa beda
 * dari yang tercetak di PDF. Sekarang semua ambil dari sini.
 */

/** Kapitalkan huruf pertama tiap kata. */
export function capitalizeEachWord(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Rapikan penulisan RT/RW jadi bentuk `/RT/001` di dalam alamat. */
export function formatAlamatWithRW(alamat: string): string {
  let formatted = capitalizeEachWord(alamat)

  // Replace RT/RW variations with proper format
  formatted = formatted.replace(/\b\/?rt\b/gi, '/RT')
  formatted = formatted.replace(/\b\/?rw\b/gi, '/RW')

  // Handle case without slash but with space after
  formatted = formatted.replace(/\brt\b/gi, 'RT')
  formatted = formatted.replace(/\brw\b/gi, 'RW')

  return formatted
}
