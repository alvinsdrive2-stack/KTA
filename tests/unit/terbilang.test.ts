import { test } from 'node:test'
import assert from 'node:assert/strict'
import { terbilang, terbilangRupiah } from '../../lib/terbilang'

// Kasus yang dulu rusak: sisa nol tetap diucapkan "Nol".
test('angka bulat ribuan tanpa ekor nol', () => {
  assert.equal(terbilang(1_200_000), 'Satu Juta Dua Ratus Ribu')
  assert.equal(terbilangRupiah(1_200_000), 'Satu Juta Dua Ratus Ribu Rupiah')
  assert.equal(terbilang(100_000), 'Seratus Ribu')
  assert.equal(terbilang(2_000_000), 'Dua Juta')
})

test('ratusan dan ribuan', () => {
  assert.equal(terbilang(0), 'Nol')
  assert.equal(terbilang(1), 'Satu')
  assert.equal(terbilang(11), 'Sebelas')
  assert.equal(terbilang(19), 'Sembilan Belas')
  assert.equal(terbilang(20), 'Dua Puluh')
  assert.equal(terbilang(21), 'Dua Puluh Satu')
  assert.equal(terbilang(100), 'Seratus')
  assert.equal(terbilang(101), 'Seratus Satu')
  assert.equal(terbilang(200), 'Dua Ratus')
  assert.equal(terbilang(999), 'Sembilan Ratus Sembilan Puluh Sembilan')
  assert.equal(terbilang(1000), 'Seribu')
  assert.equal(terbilang(1500), 'Seribu Lima Ratus')
  assert.equal(terbilang(2000), 'Dua Ribu')
})

test('juta dan miliar', () => {
  assert.equal(terbilang(1_000_000), 'Satu Juta')
  assert.equal(terbilang(1_000_001), 'Satu Juta Satu')
  assert.equal(terbilang(123_456_789), 'Seratus Dua Puluh Tiga Juta Empat Ratus Lima Puluh Enam Ribu Tujuh Ratus Delapan Puluh Sembilan')
  assert.equal(terbilang(1_000_000_000), 'Satu Miliar')
  assert.equal(terbilang(1_001_000_000), 'Satu Miliar Satu Juta')
})

test('harga tipikal KTA', () => {
  assert.equal(terbilang(300_000), 'Tiga Ratus Ribu')
  assert.equal(terbilang(100_000), 'Seratus Ribu')
  assert.equal(terbilangRupiah(0), 'Nol Rupiah')
})
