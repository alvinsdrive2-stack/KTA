/**
 * Format tampilan data KTA — satu sumber.
 *
 * Fungsi di file ini tadinya lokal di dalam `lib/pdf-generator.ts` (nggak di-export),
 * jadi halaman (`kta-preview`, `qr/[id]/[nomorKTA]`, `verify/[nik]`) nulis
 * ulang versinya sendiri. Akibatnya format di layar bisa beda dari yang
 * tercetak di PDF. Sekarang semua ambil dari sini.
 */

/**
 * Pisah nama jadi nama inti dan gelar, dipisah koma pertama.
 *
 * Koma adalah penanda gelar: "Budi Santoso, S.H., M.H." → nama inti "Budi
 * Santoso", gelar "S.H., M.H.". Koma pertama memisahkan keduanya; koma
 * berikutnya cuma memisah antar-gelar.
 *
 * Kenapa penting: kata terakhir di string belum tentu nama belakang. Tanpa
 * pemisahan ini, "Budi Santoso, S.H." diperlakukan seolah "S.H." nama
 * belakangnya — nama belakang user hilang dari singkatan, gelar malah
 * dipertahankan utuh. Tanpa koma, seluruh string dianggap nama inti.
 */
export function splitNamaDanGelar(nama: string): { namaInti: string; gelar: string } {
  const trimmed = nama.trim()
  const idx = trimmed.indexOf(',')

  if (idx === -1) {
    return { namaInti: trimmed, gelar: '' }
  }

  return {
    namaInti: trimmed.slice(0, idx).trim(),
    gelar: trimmed.slice(idx + 1).trim(),
  }
}

/**
 * Rapikan nama biar muat `maxChars` di kartu.
 *
 * Aturannya:
 *
 * 1. **Nama belakang tidak pernah disingkat.** Bagian identitas yang user
 *    larang dipotong — selalu tampil utuh.
 * 2. **Nama tengah disingkat jadi inisial** (`Budi S. P. Wijaya`) selama masih
 *    muat.
 * 3. **Gelar di belakang koma dipertahankan**, tapi tidak pernah menggeser
 *    nama belakang; kalau ruang habis, susunan minimal (nama depan + nama
 *    belakang + gelar) dipotong paksa pakai elipsis daripada kehilangan data.
 *
 * `words[words.length - 1]` saja tidak cukup: pada "Budi Santoso, S.H." kata
 * terakhir adalah gelar, bukan nama belakang. Karena itu nama inti dipisah
 * dulu dari gelar lewat `splitNamaDanGelar`.
 */
export function formatNamaForCard(nama: string, maxChars = 25): string {
  if (nama.length <= maxChars) {
    return nama
  }

  const { namaInti, gelar } = splitNamaDanGelar(nama)
  const words = namaInti.split(/\s+/).filter(Boolean)

  // Nama inti satu kata (atau kosong): nggak ada tengah buat disingkat, gelar
  // tetap dipertahankan kalau muat, sisanya dipotong paksa.
  if (words.length <= 1) {
    const withGelar = nama.length <= maxChars ? nama : namaInti
    return withGelar.length <= maxChars
      ? withGelar
      : withGelar.slice(0, maxChars - 3) + '...'
  }

  const firstWord = words[0]
  const lastWord = words[words.length - 1]
  const middleWords = words.slice(1, -1)

  const suffix = gelar ? ', ' + gelar : ''
  const sisaUntukTengah = maxChars - (firstWord + ' ' + lastWord).length - suffix.length

  let abbreviated = firstWord
  let used = 0
  for (const word of middleWords) {
    const initial = word.charAt(0) + '.'
    if (used + initial.length + 1 > sisaUntukTengah) {
      break
    }
    abbreviated += ' ' + initial
    used += initial.length + 1
  }

  const hasil = abbreviated + ' ' + lastWord + suffix
  if (hasil.length <= maxChars) {
    return hasil
  }

  // Susunan minimal tetap kepanjangan. Potong paksa dengan elipsis — jelek tapi
  // lengkap, bukan rapi tapi datanya kurang.
  return hasil.slice(0, maxChars - 3) + '...'
}

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
