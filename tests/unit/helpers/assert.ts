/**
 * Assertion helper.
 *
 * Proyek ini belum punya test runner sebagai dependency (lihat
 * `docs/AUDIT-UNIT-TEST.md`), tapi `node:test` udah bawaan Node 22 — dipakai
 * langsung, tanpa nambah apa pun ke `package.json`. File ini cuma nambah
 * assertion yang ergonomis dengan pesan error yang nunjukin nilai ASLI vs
 * harapan, karena `assert.equal` bawaan print "Expected values to be strictly
 * equal" doang — susah dipakai buat nge-triage test yang gagal.
 */
import assert from 'node:assert/strict'
import { describe as nodeDescribe, test as nodeTest } from 'node:test'

/**
 * Runner dari `node:test` bawaan Node 22, diteruskan biar file test cukup
 * ngimpor satu tempat.
 *
 * `expect(...)` ala Jest sengaja nggak ada di sini — assertion-nya fungsi lepas
 * (`toBe`, `toEqual`, ...) karena harness-nya `node:test`, bukan Jest, dan
 * bikin ulang API `expect` cuma nambah lapisan yang nggak perlu.
 */
export const describe = nodeDescribe
export const test = nodeTest

/**
 * `expect` gaya Jest — tapi cuma wadah, bukan matcher berantai.
 *
 * Sama seperti `describe`/`test`, ini lapisan tipis di atas fungsi lepas di
 * bawah. Bentuknya sengaja `expect.toBe(a, b, label)`, bukan
 * `expect(a).toBe(b)`, supaya nggak perlu bikin objek matcher per assertion.
 * Label opsional sebagai argumen terakhir diteruskan apa adanya.
 */
export const expect = {
  toBe,
  toEqual,
  toBeTrue,
  toBeFalse,
  toBeNonEmpty,
  toContain,
  notToContain,
  toBeCloseTo,
  toThrow,
}

/** Assertion gagal — dibedain dari error biasa biar trace jelas. */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssertionError'
  }
}

/** Cetak nilai apa adanya buat pesan error. String dibungkus kutip. */
export function tampilkan(nilai: unknown): string {
  if (typeof nilai === 'string') return JSON.stringify(nilai)
  if (nilai === null) return 'null'
  if (nilai === undefined) return 'undefined'
  if (typeof nilai === 'bigint') return `${nilai}n`
  try {
    return JSON.stringify(nilai)
  } catch {
    return String(nilai)
  }
}

/** Assertion: `===` — primitif atau referensi yang sama. */
export function toBe(actual: unknown, expected: unknown, label = 'toBe'): void {
  if (!Object.is(actual, expected)) {
    throw new AssertionError(`${label}: harap ${tampilkan(expected)}, dapat ${tampilkan(actual)}`)
  }
}

/** Assertion: kesamaan dalam (deep) — buat objek/array. */
export function toEqual(actual: unknown, expected: unknown, label = 'toEqual'): void {
  try {
    assert.deepStrictEqual(actual, expected)
  } catch {
    throw new AssertionError(
      `${label}: harap ${tampilkan(expected)}, dapat ${tampilkan(actual)}`
    )
  }
}

/** Assertion: nilai wajib `true`. */
export function toBeTrue(actual: unknown, label = 'toBeTrue'): void {
  if (actual !== true) {
    throw new AssertionError(`${label}: harap true, dapat ${tampilkan(actual)}`)
  }
}

/** Assertion: nilai wajib `false`. */
export function toBeFalse(actual: unknown, label = 'toBeFalse'): void {
  if (actual !== false) {
    throw new AssertionError(`${label}: harap false, dapat ${tampilkan(actual)}`)
  }
}

/**
 * Assertion: nilai wajib "ada isinya" — bukan null/undefined dan bukan string
 * kosong/cuma spasi.
 *
 * Ini yang bikin test yang nggak ada gunanya ketahuan: kalau assertion-nya cuma
 * "nggak error", test-nya bisa lulus walau produknya balikin apa-apa.
 */
export function toBeNonEmpty(actual: unknown, label = 'toBeNonEmpty'): void {
  const kosong =
    actual === null ||
    actual === undefined ||
    (typeof actual === 'string' && actual.trim() === '')
  if (kosong) {
    throw new AssertionError(`${label}: nilainya kosong (${tampilkan(actual)})`)
  }
}

/** Assertion: `actual` mengandung `needle` (substring string, atau elemen array). */
export function toContain(
  actual: string | readonly unknown[] | null | undefined,
  needle: unknown,
  label = 'toContain'
): void {
  const ok =
    typeof actual === 'string'
      ? actual.includes(String(needle))
      : Array.isArray(actual) && actual.includes(needle)
  if (!ok) {
    throw new AssertionError(
      `${label}: ${tampilkan(actual)} nggak mengandung ${tampilkan(needle)}`
    )
  }
}

/** Assertion: `actual` nggak boleh mengandung `needle`. */
export function notToContain(
  actual: string | readonly unknown[] | null | undefined,
  needle: unknown,
  label = 'notToContain'
): void {
  const ada =
    typeof actual === 'string'
      ? actual.includes(String(needle))
      : Array.isArray(actual) && actual.includes(needle)
  if (ada) {
    throw new AssertionError(
      `${label}: ${tampilkan(actual)} unexpectedly mengandung ${tampilkan(needle)}`
    )
  }
}

/** Assertion: dua angka dianggap sama kalau selisihnya <= toleransi. */
export function toBeCloseTo(
  actual: unknown,
  expected: number,
  toleransi = 0.001,
  label = 'toBeCloseTo'
): void {
  if (typeof actual !== 'number' || Number.isNaN(actual)) {
    throw new AssertionError(`${label}: dapat ${tampilkan(actual)}, bukan angka`)
  }
  if (Math.abs(actual - expected) > toleransi) {
    throw new AssertionError(
      `${label}: harap ~${expected}, dapat ${actual} (selisih ${Math.abs(actual - expected)})`
    )
  }
}

/**
 * Assertion: `fn` wajib melempar. Balikin pesan errornya biar bisa dicek lagi
 * (misal `expect(await toThrow(fn)).toContain('not found')`).
 */
export async function toThrow(
  fn: () => unknown | Promise<unknown>,
  label = 'toThrow'
): Promise<string> {
  try {
    await fn()
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
  throw new AssertionError(`${label}: nggak melempar apa-apa`)
}
