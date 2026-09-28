/**
 * Penurunan field KTA dari respons SIKI.
 *
 * Satu-satunya sumber buat nerjemahin data mentah SIKI jadi nilai kolom KTARequest.
 * Dipakai dua tempat:
 * - `app/api/kta/[id]/refresh-siki/route.ts` — refresh penuh satu permohonan
 * - `backfillEmptyFields()` di `lib/kta-upgrade.ts` — isi field kosong di KTA lama
 *
 * Kenapa dipisah: dua tempat itu butuh aturan yang sama persis (dua format respons
 * SIKI, penamaan subklasifikasi dari API v2, aturan dokumen KTP vs foto). Kalau
 * disalin, cepat atau lambat dua salinan bakal menyimpang — pola yang sama sudah
 * pernah kejadian di kategori jenjang (`getJenjangCategory`), makanya sekarang
 * semua yang butuh turunan SIKI lewat sini.
 */
import { prisma } from '@/lib/prisma'

/** Satu entri klasifikasi_kualifikasi dari respons SIKI (format 1). */
interface KlasifikasiKualifikasi {
  id_jabatan_kerja?: string | null
  subklasifikasi?: string | null
  klasifikasi?: string | null
  jenjang?: string | number | null
}

/**
 * Bentuk minimal respons SIKI yang dipakai di sini.
 *
 * Sengaja longgar karena SIKI punya dua format respons yang berbeda dan keduanya
 * masih dipakai di lapangan. Tipe ketat di sini cuma bikin pemanggil harus cast,
 * bukan bikin lebih aman.
 *
 * Nggak ada index signature di sini: `SIKIData` di `lib/siki-api.ts` nggak punya,
 * dan index signature bikin tipe apa pun yang punya field mirip jadi nggak
 * assignable. Field tambahan yang nggak dideklarasikan tetap kebaca lewat cast
 * di pemakaian (`fotoData`).
 */
export interface SikiDataInput {
  nik?: string | null
  nama?: string | null
  jabatan?: string | null
  subklasifikasi?: string | null
  jenjang?: string | number | null
  telp?: string | null
  telepon?: string | null
  email?: string | null
  alamat?: string | null
  ktpUrl?: string | null
  fotoUrl?: string | null
  klasifikasi_kualifikasi?: KlasifikasiKualifikasi[] | null
}

/** Bagian `sikiApi` yang dipakai buat nurunin field — biar gampang di-mock. */
export interface SikiApiLike {
  getSubklasifikasiName(kode: string): Promise<string | null | undefined>
  getJabatanKerjaByCode(kode: string): Promise<string | null | undefined>
}

/** Hasil penurunan: nilai kolom KTARequest, siap dipakai update. */
export interface DerivedSikiFields {
  /** `nik` nullable di schema KTARequest? Tidak — tapi SIKI bisa nggak ngirim. */
  nik: string | undefined
  nama: string | undefined
  jabatanKerja: string
  subklasifikasiId: string | null
  /**
   * Schema nyimpen jenjang sebagai String — jangan kirim number ke Prisma.
   *
   * `undefined` kalau SIKI nggak ngirim jenjang, dan itu SENGAJA bukan `''`.
   * Prisma nge-skip field yang `undefined`, sedangkan `''` ikut tertulis dan
   * menimpa jenjang yang udah bener jadi kosong — akibatnya `generateNomorKTA()`
   * gagal (`parseInt('')` = NaN) dan KTA-nya nggak pernah bisa terbit.
   */
  jenjang: string | undefined
  noTelp: string | undefined
  email: string | undefined
  alamat: string | undefined
  ktpUrl: string | undefined
  fotoUrl: string | undefined
}

/**
 * Cari/bikin baris `subklasifikasi` dari kode SIKI, sekaligus sinkronkan namanya
 * dengan yang dikasih API v2.
 *
 * Dipakai dua format respons, makanya dijadikan fungsi sendiri: bedanya cuma
 * dari mana `idKlasifikasi` diambil.
 */
async function resolveSubklasifikasi(
  kodeSubklasifikasi: string,
  idKlasifikasi: string,
  subklasifikasiName: string
): Promise<string> {
  let subklasifikasi = await prisma.subklasifikasi.findUnique({
    where: { kodeSubklasifikasi },
  })

  if (!subklasifikasi) {
    subklasifikasi = await prisma.subklasifikasi.create({
      data: {
        idKlasifikasi,
        idSubklasifikasi: kodeSubklasifikasi.substring(2).toUpperCase(),
        kodeSubklasifikasi,
        subklasifikasi: subklasifikasiName,
      },
    })
  } else if (subklasifikasiName && subklasifikasi.subklasifikasi !== subklasifikasiName) {
    subklasifikasi = await prisma.subklasifikasi.update({
      where: { id: subklasifikasi.id },
      data: { subklasifikasi: subklasifikasiName },
    })
  }

  return subklasifikasi.id
}

/**
 * Nilai dokumen bisa berupa path lokal (`/uploads/...` dari upload manual) atau
 * URL absolut ke SIKI. Yang lokal harus menang: kalau SIKI kebalikin null atau
 * URL lama, jangan timpa dokumen yang udah di-upload anggota.
 */
export function isLocalUpload(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('http')
}

/**
 * Putuskan nilai `ktpUrl` akhir.
 *
 * - SIKI nggak kirim apa-apa (null/undefined) -> pertahankan nilai lama.
 * - Nilai lama hasil upload manual -> tetap dipakai, abaikan URL SIKI.
 * - Nilai lama masih URL SIKI / kosong -> terima URL baru dari SIKI.
 */
export function resolveKtpUrl(
  current: string | null,
  incoming: string | null | undefined
): string | null {
  if (!incoming) return current
  if (isLocalUpload(current)) return current
  return incoming
}

/**
 * Putuskan nilai `fotoUrl` akhir.
 *
 * Beda dari KTP: foto sering berganti di SIKI, jadi URL baru selalu menang —
 * termasuk kalau yang lama hasil upload manual. Yang tetap dijaga cuma kasus
 * SIKI balikin null; itu artinya datanya nggak ada di respons, bukan berarti
 * fotonya dihapus, jadi nilai lama dipertahankan.
 */
export function resolveFotoUrl(
  current: string | null,
  incoming: string | null | undefined
): string | null {
  return incoming || current
}

/**
 * Turunin field KTA dari data SIKI.
 *
 * `current` dipakai cuma buat dua kolom dokumen (lihat `resolveKtpUrl` /
 * `resolveFotoUrl`); field lain selalu ikut nilai SIKI terbaru.
 *
 * Efek samping: bisa bikin/meng-update baris `subklasifikasi`. Itu memang
 * perilaku lama yang dipertahankan.
 */
export async function deriveSikiFields(
  data: SikiDataInput | null | undefined,
  sikiApi: SikiApiLike,
  current?: { ktpUrl?: string | null; fotoUrl?: string | null }
): Promise<DerivedSikiFields> {
  // Dua format respons SIKI yang masih dipakai:
  // - Format 1: ada array `klasifikasi_kualifikasi`
  // - Format 2: field `subklasifikasi` langsung di root
  const klasifikasiKualifikasi = data?.klasifikasi_kualifikasi?.[0]

  let subklasifikasiId: string | null = null
  let idJabatanKerja: string | null = null
  let jabatanKerja = data?.jabatan || 'N/A'
  // Sengaja `undefined`, bukan `''` — lihat komentar di DerivedSikiFields.jenjang.
  let jenjang: string | number | undefined = data?.jenjang ?? undefined
  // Sama: `undefined` biar Prisma nge-skip, jangan `''` yang menimpa nilai lama.
  const noTelp: string | undefined = data?.telp || data?.telepon || undefined
  if (klasifikasiKualifikasi) {
    // Format 1
    idJabatanKerja = klasifikasiKualifikasi.id_jabatan_kerja || null
    const kodeSubklasifikasi = klasifikasiKualifikasi.subklasifikasi || null
    const idKlasifikasi = klasifikasiKualifikasi.klasifikasi
    // `??` bukan `||`: jenjang "0" itu falsy tapi nilai sah.
    jenjang = klasifikasiKualifikasi.jenjang ?? jenjang

    if (kodeSubklasifikasi && idKlasifikasi) {
      // Nama resmi diambil dari API v2; kalau gagal, pakai kodenya apa adanya.
      const nameFromAPI = await sikiApi.getSubklasifikasiName(String(kodeSubklasifikasi))
      const subklasifikasiName = nameFromAPI || kodeSubklasifikasi

      subklasifikasiId = await resolveSubklasifikasi(
        String(kodeSubklasifikasi),
        String(idKlasifikasi),
        String(subklasifikasiName)
      )
    }
  } else if (data?.subklasifikasi) {
    // Format 2
    const kodeSubklasifikasi = String(data.subklasifikasi)
    // Di format ini `jabatan` berisi kode jabatan kerja, bukan namanya.
    idJabatanKerja = (data.jabatan as string | null) || null

    const nameFromAPI = await sikiApi.getSubklasifikasiName(kodeSubklasifikasi)
    const subklasifikasiName = nameFromAPI || kodeSubklasifikasi

    const idKlasifikasi = kodeSubklasifikasi.substring(0, 2).toUpperCase()

    subklasifikasiId = await resolveSubklasifikasi(
      kodeSubklasifikasi,
      idKlasifikasi,
      String(subklasifikasiName)
    )
  }

  // Nama jabatan kerja juga diambil dari API v2 — di kedua format kodenya yang
  // tersimpan, bukan namanya.
  if (idJabatanKerja) {
    const nameFromAPI = await sikiApi.getJabatanKerjaByCode(String(idJabatanKerja))
    if (nameFromAPI) {
      jabatanKerja = nameFromAPI
    }
  }

  return {
    nik: data?.nik ?? undefined,
    nama: data?.nama ?? undefined,
    jabatanKerja,
    subklasifikasiId,
    // `String(undefined)` jadi "undefined" — string yang lebih parah dari kosong.
    jenjang: jenjang === undefined || jenjang === null ? undefined : String(jenjang),
    noTelp,
    email: data?.email || undefined,
    alamat: data?.alamat || undefined,
    ktpUrl: resolveKtpUrl(current?.ktpUrl ?? null, data?.ktpUrl) ?? undefined,
    fotoUrl: resolveFotoUrl(current?.fotoUrl ?? null, data?.fotoUrl) ?? undefined,
  }
}
