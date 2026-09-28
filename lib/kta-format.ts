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

/**
 * Rapikan penulisan RT/RW jadi bentuk baku `/RT 001` di dalam alamat.
 *
 * Yang harus benar sekaligus:
 *
 * 1. **Nomornya dipisah spasi.** KTP sering menulis `RT.001`, `RT:03`, atau
 *    `RT-2`. Bentuk itu harus jadi `/RT 001`, bukan `/RT.001` — kalau nggak,
 *    kartu memakai konvensi yang beda dari alamat lain.
 * 2. **Jangan dobel slash.** Alamat yang SUDAH ditulis `/RT 5` harus tetap
 *    `/RT 5`, bukan jadi `//RT 5`.
 * 3. **Slash di depan.** Bentuk baku kartu selalu pakai slash.
 * 4. **Spasi di sekitarnya utuh.** `Jl Mawar RT 5` nggak boleh jadi `Jl MawarRT 5`.
 *
 * Dua tahap. Tahap 1 menormalkan jadi bentuk kanonik `RT 001` (huruf besar, satu
 * spasi, tanpa slash) — di titik itu semua variasi input sudah seragam, jadi
 * tahap 2 tinggal memasang slash dengan pola sederhana.
 *
 * Jangan digabung jadi satu regex. Percobaan sebelumnya gagal dua kali karena
 * satu pola nggak bisa membedakan slash-separator yang boleh dimakan dari slash
 * milik user yang harus dipertahankan, dan karena `\s*` di depan label ikut
 * memakan spasi pemisah antar-kata.
 *
 * Pencocokan pakai `i` supaya tetap kena setelah `capitalizeEachWord` mengubah
 * `RT` jadi `Rt`. Label wajib dibatasi `\b` supaya "kartu", "setruk", dan
 * "kwartir" nggak ikut kena.
 */
export function formatAlamatWithRW(alamat: string): string {
  const formatted = capitalizeEachWord(alamat)

  // Tahap 1: bentuk kanonik `RT 001`.
  //
  // - `\bRT\b` gagal cocok di `Rt5` (hasil capitalize dari `RT5`) karena nggak
  //   ada batas kata antara `t` dan `5`. Karena itu label dicocok tanpa `\b`
  //   belakang, tapi `(?<![A-Za-z])` di depan tetap dipakai supaya "kartu" dan
  //   "kwartir" nggak ikut kena.
  // - Slash TIDAK dimakan di sini — kalau dimakan, pemisah `RT 001/RW 002`
  //   hilang dan keduanya nempel jadi `RT 001RW 002`.
  // - Spasi pemisah antar-kata di depan juga tidak disentuh.
  const kanonik = formatted
    .replace(/(?<![A-Za-z])RT\s*[.:\-]?\s*(\d{1,3})?/gi, (_m, num?: string) => (num ? `RT ${num}` : 'RT'))
    .replace(/(?<![A-Za-z])RW\s*[.:\-]?\s*(\d{1,3})?/gi, (_m, num?: string) => (num ? `RW ${num}` : 'RW'))

  // Tahap 2: buang slash yang menempel langsung di depan label (dari input yang
  // sudah pakai slash ataupun sisa normalisasi), lalu pasang tepat satu.
  return kanonik.replace(/\/(RT|RW)\b/g, '$1').replace(/(?<![A-Za-z/])(RT|RW)\b/g, '/$1')
}
