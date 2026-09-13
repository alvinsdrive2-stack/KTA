/**
 * Satu tempat buat semua operasi file upload.
 *
 * Kenapa di luar `public/`: folder `public/` disajikan statis sama Next.js, jadi
 * file di dalamnya bisa diakses langsung lewat URL tanpa lewat route handler —
 * artinya cek session di route handler ke-bypass total. File anggota (KTP, foto)
 * disimpan di `storage/uploads/` dan cuma bisa diakses lewat
 * `app/uploads/[...path]/route.ts` yang punya cek session.
 */
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, resolve, sep } from 'path'
import { existsSync } from 'fs'

export type UploadCategory = 'documents' | 'payments' | 'qr-codes' | 'kta-cards'

/** Ukuran maksimum yang diizinkan, dipakai juga buat validasi di route. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Tipe MIME yang diterima → ekstensi file yang dipakai. */
export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Ekstensi → content-type, buat route yang nyajiin file. */
export const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

/**
 * Root folder penyimpanan. Di luar `public/` — ini yang nutup bypass auth.
 * Bisa dioverride lewat env `UPLOAD_DIR` (misal kalau mau naruh di volume terpisah).
 */
export function getUploadRoot(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), 'storage', 'uploads')
}

/** Buang karakter yang nggak aman dipakai jadi bagian nama file. */
function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

/**
 * Simpan file ke disk, balikin key relatif (contoh: `documents/ktp-1234-ab12cd.png`).
 * Yang disimpan ke database adalah key ini, bukan path absolut — biar pindah
 * folder/volume nggak perlu migrasi data.
 */
export async function saveUpload(
  file: File,
  category: UploadCategory,
  namePrefix?: string
): Promise<string> {
  if (!file) {
    throw new Error('File kosong')
  }

  const ext = EXT_BY_MIME[file.type]
  if (!ext) {
    throw new Error(`Tipe file tidak didukung: ${file.type || 'tidak diketahui'}`)
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file melebihi ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`)
  }

  const dir = join(getUploadRoot(), category)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const prefix = namePrefix ? `${safeSegment(namePrefix)}-` : ''
  const filename = `${prefix}${stamp}-${rand}.${ext}`

  await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()))

  return `${category}/${filename}`
}

/** Key relatif → URL yang dipakai frontend. Bentuk URL sengaja tetap `/uploads/...`. */
export function keyToUrl(key: string): string {
  return `/uploads/${key.replace(/^\/+/, '')}`
}

/**
 * Baca file dari disk berdasarkan key. Balikin `null` kalau key-nya keluar dari
 * root (path traversal) atau file-nya nggak ada.
 */
export async function readUpload(key: string): Promise<Buffer | null> {
  const root = resolve(getUploadRoot())
  const filepath = resolve(root, key)

  // Cegah path traversal: hasil resolve wajib tetap di dalam root.
  if (filepath !== root && !filepath.startsWith(root + sep)) {
    return null
  }

  if (!existsSync(filepath)) {
    return null
  }

  return readFile(filepath)
}

/** Content-type berdasarkan ekstensi, dengan fallback octet-stream. */
export function contentTypeFor(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}
