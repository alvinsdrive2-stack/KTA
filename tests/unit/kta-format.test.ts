/**
 * Test unit `lib/kta-format.ts`.
 *
 * Modul ini "satu sumber" buat format tampilan: sebelumnya kedua fungsi ini
 * lokal di dalam `lib/pdf-generator.ts`, jadi halaman verifikasi bisa nampilin
 * alamat dengan format beda dari yang tercetak di PDF. Test-nya ngecek HAL
 * YANG DILIHAT USER (string hasil format), bukan cara internalnya.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { capitalizeEachWord, formatAlamatWithRW } from '@/lib/kta-format'

describe('capitalizeEachWord()', () => {
  test('kapitalkan huruf pertama tiap kata, sisanya lowercase', () => {
    assert.equal(capitalizeEachWord('budi santoso'), 'Budi Santoso')
    assert.equal(capitalizeEachWord('BUDI SANTOSO'), 'Budi Santoso')
    assert.equal(capitalizeEachWord('BuDi SaNtOsO'), 'Budi Santoso')
  })

  test('kata satu huruf tetap kekapital', () => {
    assert.equal(capitalizeEachWord('a b c'), 'A B C')
  })

  test('string kosong -> string kosong (bukan crash)', () => {
    assert.equal(capitalizeEachWord(''), '')
  })

  test('spasi di depan/belakang dipertahankan apa adanya', () => {
    // Perilaku lama yang dipertahankan: nggak ada trim.
    assert.equal(capitalizeEachWord(' budi '), ' Budi ')
  })

  test('beberapa spasi berturut-turut nggak digabung', () => {
    assert.equal(capitalizeEachWord('budi  santoso'), 'Budi  Santoso')
  })

  test('karakter non-huruf aman', () => {
    assert.equal(capitalizeEachWord('a.b c-d'), 'A.b C-d')
  })

  test('digit dan tanda baca nggak bikin crash', () => {
    assert.equal(capitalizeEachWord('123 abc'), '123 Abc')
  })
})

describe('formatAlamatWithRW()', () => {
  test('rt/rw kecil jadi /RT /RW', () => {
    assert.equal(
      formatAlamatWithRW('jl. merdeka rt 001 rw 002'),
      'Jl. Merdeka /RT 001 /RW 002'
    )
  })

  test('yang udah ada slash nggak jadi dobel slash', () => {
    const hasil = formatAlamatWithRW('jalan mawar /rt 5 /rw 6')
    assert.equal(hasil, 'Jalan Mawar /RT 5 /RW 6')
    assert.ok(!hasil.includes('//'), 'nggak boleh ada slash dobel')
  })

  test('RT/RW huruf besar juga kena', () => {
    assert.equal(formatAlamatWithRW('RT 01 RW 02'), '/RT 01 /RW 02')
  })

  test('kombinasi tanpa slash dan dengan slash', () => {
    assert.equal(
      formatAlamatWithRW('rt 1 /rw 2'),
      '/RT 1 /RW 2'
    )
  })

  test('kata yang cuma MENGANDUNG "rt" nggak boleh kena', () => {
    // Batas kata harus dihormati: "kartu" jangan jadi "ka/RTu".
    const hasil = formatAlamatWithRW('jalan kartu pos')
    assert.equal(hasil, 'Jalan Kartu Pos')
    assert.ok(!hasil.includes('/RT'), '"kartu" nggak boleh kena regex RT')
  })

  test('alamat tanpa RT/RW cuma dirapikan kapitalnya', () => {
    assert.equal(formatAlamatWithRW('jl. sudirman no 5'), 'Jl. Sudirman No 5')
  })

  test('separator titik dan titik dua dimakan, nomornya dipisah spasi', () => {
    // Penulisan resmi di banyak KTP. Sebelumnya bocor jadi "/RT.05 /RW.02".
    assert.equal(formatAlamatWithRW('RT.05 RW.02'), '/RT 05 /RW 02')
    assert.equal(formatAlamatWithRW('jl. melati RT:03'), 'Jl. Melati /RT 03')
    assert.equal(formatAlamatWithRW('rw-2'), '/RW 2')
  })

  test('label yang nempel angkanya tetap kena', () => {
    // `capitalizeEachWord` mengubah "RT5" jadi "Rt5", dan `\bRT\b` gagal cocok
    // karena nggak ada batas kata antara "t" dan "5". Sebelumnya lolos mentah.
    assert.equal(formatAlamatWithRW('RT5 RW6'), '/RT 5 /RW 6')
  })

  test('RT dan RW yang dipisah slash nggak saling makan', () => {
    // Sebelumnya slash pemisahnya dimakan, hasilnya "/RT 001RW 002".
    assert.equal(formatAlamatWithRW('RT.001/RW.002'), '/RT 001/RW 002')
    assert.equal(formatAlamatWithRW('rt.05/rw.02'), '/RT 05/RW 02')
  })

  test('spasi pemisah antar-kata nggak ikut dimakan', () => {
    // Regex yang memakai `\s*` di depan label pernah mengubah ini jadi
    // "Jl MawarRT 5". Spasi sebelum label harus utuh.
    assert.equal(formatAlamatWithRW('jl mawar RT 5, RW 6'), 'Jl Mawar /RT 5, /RW 6')
    assert.equal(
      formatAlamatWithRW('Jalan Mawar No 5 RT 002 RW 003'),
      'Jalan Mawar No 5 /RT 002 /RW 003'
    )
  })

  test('kata yang MENGANDUNG label nggak kena, termasuk yang bersufiks', () => {
    // "kartu"/"kwartir" aman karena `(?<![A-Za-z])` di depan label, bukan `\b`
    // di belakang yang justru mematikan kasus "RT5".
    assert.equal(formatAlamatWithRW('kartu setruk kwartir'), 'Kartu Setruk Kwartir')
    assert.equal(formatAlamatWithRW('kwartir cabang RT 4'), 'Kwartir Cabang /RT 4')
  })

  test('input yang sudah baku nggak bikin slash dobel', () => {
    const kasus = [
      'Jalan Mawar /RT 5 /RW 6',
      'KP. MAWAR RT.001/RW.002',
      'Jl Mawar RT.05/RW.02 Kel Sukamaju',
    ]
    for (const input of kasus) {
      const hasil = formatAlamatWithRW(input)
      assert.ok(!hasil.includes('//'), `slash dobel di ${JSON.stringify(input)}: ${hasil}`)
    }
  })

  test('string kosong -> string kosong', () => {
    assert.equal(formatAlamatWithRW(''), '')
  })
})
