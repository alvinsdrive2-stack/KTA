/**
 * Whitelist field KTA yang boleh diubah lewat permohonan perubahan KTA.
 *
 * Kenapa whitelist, bukan enum Prisma: `fieldName` di tabel `kta_change_requests`
 * disimpan sebagai string biasa. Enum MySQL bikin nambah satu field butuh
 * `ALTER TABLE`, dan itu harus dilakuin di server tiap kali daftarnya berubah.
 * Dengan whitelist di kode, nambah field cukup ubah file ini.
 *
 * Konsekuensinya: SEMUA input `fieldName` dari request WAJIB lewat
 * `getFieldDef()` dulu. Jangan pernah pakai `body.fieldName` langsung buat
 * `prisma.kTARequest.update({ data: { [fieldName]: ... } })` — itu jalan
 * sebagai mass-assignment dan bisa nulis ke kolom apa pun di tabel, termasuk
 * `status`, `hargaRegion`, `nomorKTA`, atau `requestedBy`.
 */

/** Tipe nilai yang mungkin dikirim ke kolom Prisma. */
export type FieldValue = string

export interface KTAChangeFieldDef {
  /** Nama kolom di tabel `kta_requests`. Ini yang dipakai Prisma. */
  key: string
  /** Label buat ditampilin di UI. */
  label: string
  /**
   * Nama field di respons SIKI (`sikiApi.getPekerjaByIdIzin`) yang jadi
   * pembanding buat field ini. `null` = SIKI nggak nyediain nilainya, jadi
   * preview-nya nggak bisa nunjukin perbandingan.
   */
  sikiKey: string | null
  /** Keterangan singkat buat placeholder / bantuan di form. */
  hint?: string
}

/**
 * Field yang didukung. Urutannya sekaligus jadi urutan tampil di form.
 *
 * Yang SENGAJA nggak ada di sini dan alasannya:
 *   - `status`, `nomorKTA`, `kartuGeneratedPath`, `qrCodePath` — dikelola alur
 *     approval/penerbitan, bukan data yang boleh diubah lewat permohonan.
 *   - `hargaRegion`, `diskonPersen`, `hargaBase`, `hargaFinal`, `hargaLama`,
 *     `hargaUpgrade` — angka duit. Perubahannya harus lewat alur harga, bukan
 *     permohonan data.
 *   - `daerahId`, `requestedBy`, `subklasifikasiId` — relasi. Ganti daerah atau
 *     pemilik KTA bukan "perubahan data", itu pemindahan.
 *   - `idIzin` — identitas dari SIKI. Kalau salah, yang benerin bukan permohonan
 *     perubahan, tapi tarik ulang data.
 *   - `fotoUrl` / `ktpUrl` — dokumen. Jalurnya lewat upload + refresh SIKI,
 *     bukan permohonan perubahan teks. Kalau nanti dibutuhin, masukin ke sini
 *     bareng penanda khusus dokumen.
 */
export const KTA_CHANGE_FIELDS: KTAChangeFieldDef[] = [
  { key: 'nama', label: 'Nama Lengkap', sikiKey: 'nama' },
  { key: 'nik', label: 'NIK', sikiKey: 'nik' },
  {
    key: 'jabatanKerja',
    label: 'Jabatan Kerja',
    sikiKey: 'jabatan',
    hint: 'Di SIKI field-nya `jabatan`. Isinya nama jabatan kerja.',
  },
  {
    key: 'jenjang',
    label: 'Kualifikasi',
    sikiKey: 'jenjang',
    hint: 'Jenjang kualifikasi, misal "Ahli Muda" atau "Terampil".',
  },
  { key: 'noTelp', label: 'No. Telepon', sikiKey: 'telp' },
  { key: 'email', label: 'Email', sikiKey: 'email' },
  { key: 'alamat', label: 'Alamat', sikiKey: 'alamat' },
  {
    key: 'subklasifikasi',
    label: 'Subklasifikasi',
    sikiKey: null,
    hint: 'Di SIKI isinya kode, bukan nama. Perbandingan otomatis nggak tersedia — isi manual.',
  },
]

/** Cari definisi field dari nama kolomnya. `undefined` = field nggak didukung. */
export function getFieldDef(key: string): KTAChangeFieldDef | undefined {
  return KTA_CHANGE_FIELDS.find((f) => f.key === key)
}

/** Cari definisi field dari labelnya. Dipakai buat nerjemahin input lama. */
export function getFieldDefByLabel(label: string): KTAChangeFieldDef | undefined {
  return KTA_CHANGE_FIELDS.find((f) => f.label === label)
}

/**
 * Ambil nilai satu field dari objek KTARequest. Dipakai buat nge-snapshot
 * `oldValue` saat permohonan dibuat, dan buat nampilin nilai sekarang di UI.
 *
 * Selalu balikin string — `null`/`undefined` jadi `''`.
 */
export function readFieldValue(
  kta: Record<string, unknown>,
  key: string
): string {
  const raw = kta[key]
  if (raw === null || raw === undefined) return ''
  if (raw instanceof Date) return raw.toISOString()
  return String(raw)
}

/**
 * Ambil nilai pembanding dari respons SIKI. Balikin `null` kalau field ini
 * nggak punya padanan di SIKI, atau SIKI nggak ngirim nilainya.
 *
 * Bedanya `null` dan `''` penting di UI: `null` = "SIKI nggak punya datanya,
 * nggak bisa dibandingin", `''` = "SIKI bilang field-nya kosong".
 */
export function readSikiValue(
  sikiData: Record<string, unknown> | null | undefined,
  def: KTAChangeFieldDef
): string | null {
  if (!def.sikiKey || !sikiData) return null
  const raw = sikiData[def.sikiKey]
  if (raw === null || raw === undefined) return null
  return String(raw)
}

/**
 * Bandingin nilai lama dan nilai baru. Sengaja di-trim dan case-insensitive
 * buat deteksi "nggak ada perubahan" — biar BPP nggak ngajuin permohonan yang
 * isinya cuma beda spasi atau huruf besar-kecil.
 *
 * Nilai yang dikirim ke database tetap string aslinya, bukan hasil trim —
 * yang di-trim cuma buat perbandingan.
 */
export function isSameValue(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Status permohonan. Sama persis dengan `enum ChangeStatus` di schema.prisma. */
export const CHANGE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type ChangeStatusValue = (typeof CHANGE_STATUSES)[number]

/** Label Indonesia buat status, dipakai di badge dan filter. */
export const CHANGE_STATUS_LABEL: Record<ChangeStatusValue, string> = {
  PENDING: 'Menunggu Konfirmasi',
  APPROVED: 'Diterima',
  REJECTED: 'Ditolak',
}
