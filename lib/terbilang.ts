/**
 * Angka -> kata dalam Bahasa Indonesia, buat baris "Terbilang" di invoice.
 *
 * Bagian yang nggak ada nilainya dilewati, bukan diucapkan "Nol" —
 * 1.200.000 jadi "Satu Juta Dua Ratus Ribu", bukan
 * "Satu Juta Dua Ratus Nol Ribu Nol".
 */
const SATUAN = [
  '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
  'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas',
]

/** Skala tiap kelompok 3 digit: 1 = ribu, 2 = juta, dst. */
const SKALA = ['', 'Ribu', 'Juta', 'Miliar', 'Triliun', 'Kuadriliun']

/** Bilangan 0..999 jadi kata. Nol balikin string kosong. */
function kelompokTiga(n: number): string {
  if (n <= 0) return ''
  if (n < 12) return SATUAN[n]
  if (n < 20) return `${SATUAN[n - 10]} Belas`
  if (n < 100) {
    const sisa = n % 10
    const puluh = `${SATUAN[Math.floor(n / 10)]} Puluh`
    return sisa > 0 ? `${puluh} ${SATUAN[sisa]}` : puluh
  }
  // 100-199 pakai "Seratus", 200-999 pakai "Dua Ratus" dst.
  const ratus = n < 200 ? 'Seratus' : `${SATUAN[Math.floor(n / 100)]} Ratus`
  const sisa = kelompokTiga(n % 100)
  return sisa ? `${ratus} ${sisa}` : ratus
}

/** Bagian bulat dari angka jadi kata. */
export function terbilang(nilai: number): string {
  if (!Number.isFinite(nilai)) return 'Nol'

  const bulat = Math.floor(Math.abs(nilai))
  if (bulat === 0) return 'Nol'

  const kata: string[] = []
  let sisa = bulat
  let skala = 0

  while (sisa > 0) {
    const grup = sisa % 1000
    if (grup > 0) {
      // 1.000 diucapkan "Seribu", bukan "Satu Ribu".
      if (skala === 1 && grup === 1) {
        kata.unshift('Seribu')
      } else {
        const skalaNama = SKALA[skala]
        const kataGrup = kelompokTiga(grup)
        kata.unshift(skalaNama ? `${kataGrup} ${skalaNama}` : kataGrup)
      }
    }
    sisa = Math.floor(sisa / 1000)
    skala++
  }

  return kata.join(' ')
}

/** Versi invoice: "Satu Juta Dua Ratus Ribu Rupiah". */
export function terbilangRupiah(nilai: number): string {
  const tanda = nilai < 0 ? 'Minus ' : ''
  return `${tanda}${terbilang(nilai)} Rupiah`
}
