import type { KTARequest } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deriveSikiFields, type SikiDataInput } from '@/lib/siki-fields'
import { addYearsWib } from '@/lib/utils'

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

/** Kode subklasifikasi K3. Daerah di luar 98 nggak boleh ngajuin ini. */
export const KODE_SUBKLASIFIKASI_K3 = 'MP01'

/**
 * Masa berlaku KTA, tahun. Harus sama dengan yang dipakai `lib/kta-expiry.ts`
 * dan cron `check-expired-kta`; kalau salah satu berubah, yang lain ikut.
 */
export const MASA_BERLAKU_TAHUN = 5

/** Nama subklasifikasi K3 yang tersimpan di baris KTA (jalur manual tanpa kode). */
const NAMA_SUBKLASIFIKASI_K3 = 'KESELAMATAN KONSTRUKSI'

/**
 * K3 cuma boleh masuk ke daerah 98.
 *
 * Cek dua sumber sekaligus: kode `MP01` (jalur SIKI — acuan utama) dan nama
 * 'KESELAMATAN KONSTRUKSI' (jalur manual/import yang cuma nyimpan nama).
 * Yang dicek kode daerah **tujuan**, bukan daerah akun yang login: PUSAT/ADMIN/
 * daerah Pusat (kode 99) boleh milih daerah tujuan mana pun, dan yang menentukan sah-tidaknya
 * KTA itu adalah daerah tempat KTA-nya nanti terbit.
 */
export function isSubklasifikasiK3(kodeSubklasifikasi?: string | null): boolean {
  return (kodeSubklasifikasi || '').trim().toUpperCase() === KODE_SUBKLASIFIKASI_K3
}

/** Jalur manual cuma punya nama subklasifikasi, bukan kode — cocokkan namanya. */
export function isSubklasifikasiK3ByName(nama?: string | null): boolean {
  return (nama || '').trim().toUpperCase() === NAMA_SUBKLASIFIKASI_K3
}

export function isK3AllowedForDaerah(kodeDaerah?: string | null): boolean {
  return (kodeDaerah || '').trim() === KODE_DAERAH_BEBAS_NIK
}

/** K3 ke daerah selain 98 = pelanggaran. `true` berarti tolak. */
export function isK3Violation(
  subklasifikasi: { kode?: string | null; nama?: string | null } | null | undefined,
  kodeDaerah?: string | null
): boolean {
  const isK3 = isSubklasifikasiK3(subklasifikasi?.kode) || isSubklasifikasiK3ByName(subklasifikasi?.nama)
  return isK3 && !isK3AllowedForDaerah(kodeDaerah)
}

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
 * Peringkat senioritas kategori. Angka lebih besar = lebih tinggi.
 *
 * Dipakai buat mutusin naik/turun kategori. Urutan Operator < Teknisi < Ahli
 * sama dengan penomoran resmi klasifikasi (Operator = klasifikasi 3, Teknisi =
 * 2, Ahli = 1), cuma dibalik biar perbandingannya `new > old` = naik.
 */
const KATEGORI_RANK: Record<JenjangCategory, number> = {
  OPERATOR: 1,
  TEKNISI: 2,
  AHLI: 3,
}

export function getJenjangRank(jenjang: number | string): number {
  return KATEGORI_RANK[getJenjangCategory(jenjang)]
}

/**
 * Masa berlaku KTA lama sudah lewat?
 *
 * Dipakai `checkUpgradeScenario` buat nolak upgrade dari KTA yang kadaluarsa.
 * Nggak pakai `isKTAExpired()` dari `lib/kta-expiry.ts` karena file itu narik
 * `prisma` di top-level; modul ini dipakai halaman client lewat
 * `components/ui/jenjang-badge` dan `app/dashboard/kta/apply`.
 */
export function isTanggalDaftarExpired(tanggalDaftar: Date | string): boolean {
  return new Date() > addYearsWib(tanggalDaftar, MASA_BERLAKU_TAHUN)
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
    // Pengecualian: DRAFT yang sebenarnya KTA kadaluarsa.
    //
    // Cron `check-expired-kta` (dan `checkAndUpdateExpiredKTA`) menandai KTA
    // lewat masa berlaku sebagai DRAFT, dan DRAFT masuk daftar status pending.
    // Tanpa pengecualian ini, anggota yang KTA-nya kadaluarsa diblokir permanen
    // dengan alasan "permohonan sedang diproses" padahal nggak ada permohonan
    // apa pun — dan pengajuan barunya nggak pernah bisa jalan.
    const pendingKadaluarsa =
      pendingKta.status === 'DRAFT' &&
      !!pendingKta.tanggalDaftar &&
      isTanggalDaftarExpired(pendingKta.tanggalDaftar)

    if (!pendingKadaluarsa) {
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

  // Kategori sama, jenjang beda -> bukan upgrade.
  //
  // Naik jenjang di dalam satu kategori (Ahli 7 -> 8, Operator 1 -> 2) bukan
  // kenaikan klasifikasi, cuma perpindahan jabatan kerja. KTA-nya tetap sah
  // sampai masa berlakunya habis, dan yang berubah bukan kartunya — cukup
  // permohonan perubahan Jabatan Kerja lewat `/api/kta/change-request`.
  // Sebelumnya jalur ini lolos sebagai upgrade: bikin baris KTA baru, nomor
  // baru, dan `tanggalDaftar` baru — artinya masa berlaku ikut direset padahal
  // seharusnya tetap.
  if (oldCategory === newCategory) {
    const backfilledFields = await backfillEmptyFields(existingKta.id, sikiData)

    // Arahannya beda: naik jenjang di kategori sama memang bisa diselesaikan
    // lewat permohonan perubahan Jabatan Kerja, sedangkan turun jenjang nggak
    // — jadi jangan arahkan ke sana.
    const reason =
      newJenjangNum > oldJenjang
        ? `Jenjang ${oldJenjang} dan ${newJenjangNum} masih kategori ${JENJANG_LABEL[oldCategory]}. Ini bukan upgrade — ajukan permohonan perubahan Jabatan Kerja, KTA Anda tetap berlaku sampai masa berlakunya habis.`
        : `Anda sudah memiliki KTA jenjang ${oldJenjang} kategori ${JENJANG_LABEL[oldCategory]}. Jenjang ${newJenjangNum} bukan kenaikan klasifikasi, jadi tidak bisa diterbitkan.`

    return {
      isUpgrade: false,
      canUpgrade: false,
      existingKta,
      newJenjang: newJenjangNum,
      oldJenjang,
      hargaBaru: newJenjangNum >= 7 ? 300000 : 100000,
      hargaLama: oldJenjang >= 7 ? 300000 : 100000,
      hargaUpgrade: 0,
      reason,
      ...(backfilledFields.length > 0 ? { backfilledFields } : {})
    }
  }

  // Turun kategori -> ERROR (downgrade not allowed)
  if (getJenjangRank(newJenjangNum) < getJenjangRank(oldJenjang)) {
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

  // Naik kategori, tapi masa berlaku KTA lamanya sudah habis -> bukan upgrade,
  // tapi pengajuan baru (bayar penuh).
  //
  // Masa berlaku dihitung dari `tanggalDaftar`, dan `tanggalDaftar` di-reset di
  // jalur pembayaran. Jadi KTA yang sudah lewat masa berlakunya bukan "KTA
  // aktif" lagi: nggak boleh jadi dasar upgrade, tapi juga nggak boleh
  // memblokir — pengajuan barunya diteruskan sebagai permohonan baru.
  // `existingKta` sengaja `null`: pemanggil (`app/api/kta/create`) menulis
  // `upgradeFromKtaId` dari situ, dan buat pengajuan baru kolom itu harus kosong.
  if (isTanggalDaftarExpired(existingKta.tanggalDaftar)) {
    const batas = addYearsWib(existingKta.tanggalDaftar, MASA_BERLAKU_TAHUN)

    return {
      isUpgrade: false,
      canUpgrade: true,
      existingKta: null,
      newJenjang: newJenjangNum,
      oldJenjang: null,
      hargaBaru: newJenjangNum >= 7 ? 300000 : 100000,
      hargaLama: 0,
      hargaUpgrade: newJenjangNum >= 7 ? 300000 : 100000,
      reason: `KTA jenjang ${oldJenjang} Anda sudah kadaluarsa sejak ${batas.toLocaleDateString('id-ID')}, jadi ini bukan upgrade melainkan permohonan KTA baru.`
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
