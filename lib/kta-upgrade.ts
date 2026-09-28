import type { KTARequest } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deriveSikiFields, type SikiDataInput } from '@/lib/siki-fields'

export interface UpgradeCheckResult {
  isUpgrade: boolean
  canUpgrade: boolean
  existingKta: KTARequest | null
  newJenjang: number
  oldJenjang: number | null
  hargaBaru: number
  hargaLama: number
  hargaUpgrade: number
  reason?: string
  /** Nama field di KTA lama yang ikut terisi dari data SIKI saat permohonan ditolak. */
  backfilledFields?: string[]
}

/**
 * Daerah yang dibebaskan dari pengecekan NIK lintas daerah.
 *
 * Pengecekan NIK normalnya GLOBAL: NIK yang sama di daerah mana pun saling
 * memblokir. Daerah 98 satu-satunya pengecualian, dan berlaku dua arah —
 * KTA di 98 nggak memblokir pengajuan di daerah lain, dan pengajuan di 98
 * nggak diblokir KTA di daerah lain.
 */
export const KODE_DAERAH_BEBAS_NIK = '98'

export type JenjangCategory = 'OPERATOR' | 'TEKNISI' | 'AHLI'

/** Label tampilan buat tiap kategori — dipakai UI, bukan buat perbandingan. */
export const JENJANG_LABEL: Record<JenjangCategory, string> = {
  OPERATOR: 'Operator',
  TEKNISI: 'Teknisi/Analis',
  AHLI: 'Ahli',
}

/**
 * Kategori jenjang dari angka 1-9.
 *
 * Satu-satunya sumber: sebelumnya ada dua versi terpisah (`lib/kta-upgrade` dan
 * `components/ui/jenjang-badge`) yang balikin label beda — satu 'TEKNISI', satu
 * 'Teknisi/Analis' — jadi dua halaman nampilin "Kualifikasi" dengan tulisan
 * berbeda buat data yang sama. Sekarang yang ini yang dipakai dua-duanya.
 *
 * Catatan: input yang nggak bisa diparse jatuh ke 'AHLI', sama seperti perilaku
 * dua versi lama. Sengaja dipertahankan biar nggak ngubah hasil yang udah jalan.
 */
export function getJenjangCategory(jenjang: number | string): JenjangCategory {
  const jenjangNum = typeof jenjang === 'string' ? parseInt(jenjang, 10) : jenjang
  if (jenjangNum <= 3) return 'OPERATOR' // 1-3
  if (jenjangNum <= 6) return 'TEKNISI' // 4-6
  return 'AHLI' // 7-9
}

/**
 * Isi field yang masih kosong di KTA lama pakai data SIKI terbaru.
 *
 * Dipanggil di jalur penolakan karena jenjang: permohonannya tetap ditolak, tapi
 * data SIKI yang barusan di-fetch nggak dibuang percuma — kalau KTA lama punya
 * kolom yang masih kosong, itu diisi.
 *
 * Aturan pengisian: cuma null dan string kosong yang disentuh (keputusan user:
 * "Null + string kosong"). Nilai yang sudah ada isinya tidak pernah ditimpa,
 * sekalipun SIKI punya nilai yang berbeda. Jadi fungsi ini idempoten dan aman
 * dipanggil berkali-kali.
 *
 * Field dokumen (KTP/foto) pakai aturan yang sama dengan refresh SIKI, lewat
 * `deriveSikiFields()` — lihat komentar di `lib/siki-fields.ts`.
 *
 * Balikin daftar nama field yang benar-benar terisi, buat dilaporkan ke UI.
 */
export async function backfillEmptyFields(
  existingKtaId: string,
  sikiData: SikiDataInput | null | undefined
): Promise<string[]> {
  if (!sikiData) return []

  const existingKta = await prisma.kTARequest.findUnique({
    where: { id: existingKtaId },
  })

  if (!existingKta) return []

  const { sikiApi } = await import('@/lib/siki-api')

  const derived = await deriveSikiFields(sikiData, sikiApi, {
    ktpUrl: existingKta.ktpUrl,
    fotoUrl: existingKta.fotoUrl,
  })

  // Cuma null / string kosong yang dianggap "belum ada isi".
  const kosong = (value: unknown): boolean =>
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

  // Field yang diperiksa: kolom nullable di schema + kolom teks NOT NULL yang
  // bisa berisi string kosong (nama, jabatanKerja, noTelp, email, alamat).
  const kandidat: { field: keyof typeof derived; kolom: string; label: string }[] = [
    { field: 'nama', kolom: 'nama', label: 'Nama' },
    { field: 'jabatanKerja', kolom: 'jabatanKerja', label: 'Jabatan Kerja' },
    { field: 'subklasifikasiId', kolom: 'subklasifikasiId', label: 'Subklasifikasi' },
    { field: 'noTelp', kolom: 'noTelp', label: 'No. Telepon' },
    { field: 'email', kolom: 'email', label: 'Email' },
    { field: 'alamat', kolom: 'alamat', label: 'Alamat' },
    { field: 'ktpUrl', kolom: 'ktpUrl', label: 'KTP' },
    { field: 'fotoUrl', kolom: 'fotoUrl', label: 'Foto' },
  ]

  const data: Record<string, unknown> = {}
  const terisi: string[] = []

  for (const { field, kolom, label } of kandidat) {
    const nilaiBaru = derived[field]
    if (nilaiBaru === null || nilaiBaru === undefined || nilaiBaru === '') continue
    if (!kosong((existingKta as Record<string, unknown>)[kolom])) continue

    data[kolom] = nilaiBaru
    terisi.push(label)
  }

  // `subklasifikasiId` nullable di schema, tapi `subklasifikasi` (nama) bukan —
  // ikut isi kalau baris subklasifikasinya baru kebentuk.
  if (data.subklasifikasiId !== undefined && kosong(existingKta.subklasifikasi)) {
    const sub = await prisma.subklasifikasi.findUnique({
      where: { id: String(data.subklasifikasiId) },
      select: { subklasifikasi: true },
    })
    if (sub?.subklasifikasi) {
      data.subklasifikasi = sub.subklasifikasi
    }
  }

  // Foto base64 — cuma diisi kalau memang kosong, dan cuma kalau SIKI ngirim.
  // `fotoData` nggak dideklarasikan di SikiDataInput (bukan field standar respons
  // SIKI), jadi dibaca lewat cast.
  const fotoDataSiki = (sikiData as { fotoData?: unknown }).fotoData
  if (kosong(existingKta.fotoData) && typeof fotoDataSiki === 'string' && fotoDataSiki) {
    data.fotoData = fotoDataSiki
    // Wajib dicatat di sini. Sebelumnya cuma `data` yang diisi, jadi kalau
    // fotoData satu-satunya kolom yang kosong, `terisi` tetap kosong dan fungsi
    // ini balik lebih awal tanpa nulis apa pun — foto dari SIKI dibuang percuma.
    terisi.push('Foto')
  }

  if (terisi.length === 0) return []

  await prisma.kTARequest.update({
    where: { id: existingKtaId },
    data,
  })

  return terisi
}

export async function checkUpgradeScenario(
  nik: string,
  newJenjang: number,
  subklasifikasi: string,
  sikiData?: SikiDataInput | null,
  daerahKode?: string | null
): Promise<UpgradeCheckResult> {
  // Filter daerah. Pengecekan NIK tetap GLOBAL, kecuali kalau daerah 98 terlibat —
  // lihat KODE_DAERAH_BEBAS_NIK. Dua arahnya:
  //   - pengajuan DI 98  -> cuma lihat KTA yang juga di 98
  //   - pengajuan di lain -> lihat semua KECUALI yang di 98
  // Kalau `daerahKode` nggak dikirim, perilaku lama dipertahankan apa adanya:
  // cari lintas semua daerah tanpa pengecualian.
  const filterDaerah = !daerahKode
    ? {}
    : daerahKode === KODE_DAERAH_BEBAS_NIK
      ? { daerah: { kodeDaerah: KODE_DAERAH_BEBAS_NIK } }
      : { daerah: { isNot: { kodeDaerah: KODE_DAERAH_BEBAS_NIK } } }

  // First, check if there's any pending KTA (not yet completed) with the same NIK
  const pendingKta = await prisma.kTARequest.findFirst({
    where: {
      nik,
      ...filterDaerah,
      status: { in: ['DRAFT', 'FETCHED_FROM_SIKI', 'EDITED', 'WAITING_PAYMENT', 'UPGRADE_PENDING', 'READY_FOR_PUSAT'] }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (pendingKta) {
    // There's a pending KTA - cannot create new one
    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta: pendingKta,
      newJenjang,
      oldJenjang: parseInt(pendingKta.jenjang, 10),
      hargaBaru: newJenjang >= 7 ? 300000 : 100000,
      hargaLama: 0,
      hargaUpgrade: 0,
      reason: `Anda memiliki permohonan KTA yang sedang diproses (Status: ${pendingKta.status}). Selesaikan terlebih dahulu sebelum membuat permohonan baru.`
    }
  }

  // Get existing completed KTA (only fully printed ones count for upgrade)
  const existingKta = await prisma.kTARequest.findFirst({
    where: {
      nik,
      ...filterDaerah,
      status: { in: ['READY_TO_PRINT', 'PRINTED'] }
    },
    orderBy: { jenjang: 'desc' }  // Get highest jenjang first
  })

  if (!existingKta) {
    // No existing completed KTA - new application
    return {
      isUpgrade: false,
      canUpgrade: true,
      existingKta: null,
      newJenjang,
      oldJenjang: null,
      hargaBaru: newJenjang >= 7 ? 300000 : 100000,
      hargaLama: 0,
      hargaUpgrade: newJenjang >= 7 ? 300000 : 100000
    }
  }

  const oldJenjang = parseInt(existingKta.jenjang, 10)
  const newJenjangNum = newJenjang

  // Check jenjang category
  const oldCategory = getJenjangCategory(oldJenjang)
  const newCategory = getJenjangCategory(newJenjangNum)

  // Same jenjang -> ERROR
  if (oldJenjang === newJenjangNum) {
    // Permohonan ditolak, tapi data SIKI-nya nggak dibuang: isi field kosong di
    // KTA lama. `canUpgrade` tetap false — ini murni penyelamatan data.
    const backfilledFields = await backfillEmptyFields(existingKta.id, sikiData)

    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta,
      newJenjang: newJenjangNum,
      oldJenjang,
      hargaBaru: newJenjangNum >= 7 ? 300000 : 100000,
      hargaLama: oldJenjang >= 7 ? 300000 : 100000,
      hargaUpgrade: 0,
      reason: `Anda sudah memiliki KTA jenjang ${oldJenjang}. Tidak bisa membuat KTA dengan jenjang yang sama.`,
      ...(backfilledFields.length > 0 ? { backfilledFields } : {})
    }
  }

  // Same category but not higher jenjang -> ERROR
  if (oldCategory === newCategory && newJenjangNum < oldJenjang) {
    const backfilledFields = await backfillEmptyFields(existingKta.id, sikiData)

    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta,
      newJenjang: newJenjangNum,
      oldJenjang,
      hargaBaru: newJenjangNum >= 7 ? 300000 : 100000,
      hargaLama: oldJenjang >= 7 ? 300000 : 100000,
      hargaUpgrade: 0,
      reason: `Anda sudah memiliki KTA jenjang ${oldJenjang} (${oldCategory}). Tidak bisa downgrade ke jenjang ${newJenjangNum}.`,
      ...(backfilledFields.length > 0 ? { backfilledFields } : {})
    }
  }

  // Lower category -> ERROR (downgrade not allowed)
  if (newJenjangNum < oldJenjang) {
    const backfilledFields = await backfillEmptyFields(existingKta.id, sikiData)

    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta,
      newJenjang: newJenjangNum,
      oldJenjang,
      hargaBaru: newJenjangNum >= 7 ? 300000 : 100000,
      hargaLama: oldJenjang >= 7 ? 300000 : 100000,
      hargaUpgrade: 0,
      reason: `Anda sudah memiliki KTA jenjang ${oldJenjang} (${oldCategory}). Tidak bisa downgrade ke jenjang ${newJenjangNum}.`,
      ...(backfilledFields.length > 0 ? { backfilledFields } : {})
    }
  }

  // Valid upgrade - calculate price
  const hargaBaru = newJenjangNum >= 7 ? 300000 : 100000
  const hargaLama = oldJenjang >= 7 ? 300000 : 100000
  const hargaUpgrade = hargaBaru - hargaLama

  return {
    isUpgrade: true,
    canUpgrade: true,
    existingKta,
    newJenjang: newJenjangNum,
    oldJenjang,
    hargaBaru,
    hargaLama,
    hargaUpgrade
  }
}
