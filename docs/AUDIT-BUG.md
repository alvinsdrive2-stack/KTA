# Audit Bug — Sistem KTA Gatensi

Tanggal: 28 September 2026
Cakupan: seluruh working tree yang belum di-commit — QR/backfill/daerah-98, kompresi PDF (JPEG + palette PNG), format alamat, auth endpoint, jalur import Excel
Metode: pembacaan kode + `git diff` + `npm test` (50 test, semua lulus) + verifikasi regex/perilaku di Node
Status: **1 KRITIS, 5 TINGGI, 4 SEDANG, 2 RENDAH**

> Catatan verifikasi 28 Sep 2026: temuan #1 (KRITIS) **gugur** — reproduksi pakai kode jalan
> (`backfillEmptyFields` dengan `fotoUrl` manual + URL SIKI) balikin `terisi: []`,
> `update` tidak dipanggil, `fotoUrl` tetap file manual. Guard `kosong()` di
> `lib/kta-upgrade.ts:114` beneran jalan, bukan pajangan. `derived.fotoUrl` memang
> berisi URL SIKI (by design `resolveFotoUrl`), tapi nggak pernah ditulis karena
> kolomnya nggak kosong. Jadi sisa KRITIS tinggal #2.

> Catatan revisi: audit sebelumnya melaporkan `terisi.push('Foto')` hilang di `backfillEmptyFields()` (temuan lama #1) dan id `<input type="file">` duplikat di halaman apply. **Dua-duanya tidak terbukti di kode saat ini.** Yang pertama sudah diperbaiki (`lib/kta-upgrade.ts:141`); yang kedua tidak ada — semua 11 `id` di halaman apply unik, dan halaman itu memang tidak punya input file. Keduanya dibatalkan, bukan diteruskan.

---

## Ringkasan

| # | Temuan | Tingkat | Lokasi |
|---|---|---|---|
| 1 | ~~`backfillEmptyFields()` nimpa `fotoUrl` upload manual~~ GUGUR (terverifikasi aman, lihat §1) | — | `lib/kta-upgrade.ts:114` |
| 2 | Jalur import Excel tanpa cek role, `daerahId` dari body, `backfillEmptyFields` tanpa cek pemilik | KRITIS | `app/api/kta/import/route.ts:433-439`, `lib/kta-upgrade.ts:78-80` |
| 3 | `regenerate-qr-codes` sekarang nol hasil, dan berisiko menimpa QR semua KTA approval | TINGGI | `app/api/admin/regenerate-qr-codes/route.ts:43-67` |
| 4 | `sikiData` mentah dari client dipakai untuk menulis KTA milik user lain | TINGGI | `app/api/kta/check-upgrade/route.ts:14,29` |
| 5 | `daerahKode` di form pengajuan diambil dari daerah **sesi**, bukan daerah **tujuan** | TINGGI | `app/dashboard/kta/apply/page.tsx:136` |
| 6 | Kolom Excel "PROVINSI" diperlakukan sebagai kode daerah | TINGGI | `app/api/kta/import/route.ts:84` |
| 7 | `daerahKode` di import dipakai tanpa jatuh ke kode daerah tujuan impor | TINGGI | `app/api/kta/import/route.ts:476-477` |
| 8 | `formatAlamatWithRW()` masih bocor: `RT.05`, `RT:03`, `rw-2`, `RT.001/RW.002` | SEDANG | `lib/kta-format.ts:26-31` |
| 9 | Banding `resolveKtpUrl` di `skippedDocuments` bukan logika resolusi yang sebenarnya | SEDANG | `app/api/kta/[id]/refresh-siki/route.ts:97-99` |
| 10 | `formatNama()` bisa menghilangkan nama belakang dan mengembalikan string kosong | SEDANG | `lib/pdf-generator.ts:53-84` |
| 11 | `jenjang` kosong/`0` jadi string kosong di DB, lalu dibaca sebagai kategori AHLI | SEDANG | `lib/siki-fields.ts:171,223` |
| 12 | `orderBy: { jenjang: 'desc' }` nge-sort string, bukan angka | RENDAH | `lib/kta-upgrade.ts:203` |
| 13 | Template di-embed ulang per kartu di PDF antara | RENDAH | `lib/pdf-generator.ts:853-867` |

---

## 1. ~~`backfillEmptyFields()` nimpa `fotoUrl` hasil upload manual — KRITIS~~ GUGUR

`lib/siki-fields.ts:142-147` dan `lib/kta-upgrade.ts:104-105`

**Hasil verifikasi: klaim ini salah.** Sudah dijalankan langsung dengan kode saat ini —
`backfillEmptyFields('k1', { fotoUrl: 'https://siki.../baru.jpg' })` pada baris KTA yang
`fotoUrl`-nya `/uploads/documents/foto-manual.png`:

```
terisi: []
update dipanggil? false
fotoUrl sesudah: /uploads/documents/foto-manual.png
AMAN: manual dipertahankan
```

Analisis di bawah melewatkan satu baris. Memang benar `derived.fotoUrl` berisi URL SIKI
(`resolveFotoUrl` memang memihak SIKI), tapi nilai itu **tidak pernah ditulis**, karena
sebelum menulis ada guard:

```ts
// lib/kta-upgrade.ts:114
if (!kosong((existingKta as Record<string, unknown>)[kolom])) continue
```

`existingKta.fotoUrl` tidak kosong → `continue` → `data.fotoUrl` tidak pernah diisi →
`update` tidak dipanggil. Justru karena `current` dikirim ke `deriveSikiFields`, nilai
`derived` untuk kolom yang sudah terisi jadi ikut nilai lama — tapi hasil akhirnya sama:
kolom terisi tidak tersentuh.

Pertanyaan desain yang tersisa (bukan bug, nggak perlu tindakan): `dokumen` di jalur
backfill melewati `resolveFotoUrl`/`resolveKtpUrl` padahal aturan jalur itu "cuma kolom
kosong yang disentuh", jadi keputusan dokumen di `deriveSikiFields` memang tidak
terpakai di sini. Kalau nanti `current` dihapus dari pemanggilan ini, aturannya tetap
satu karena guard `kosong()` yang memutuskan. Tidak perlu diubah sekarang.

<details>
<summary>Analisis awal (tidak terbukti — disimpan buat jejak)</summary>

Ini persis yang dilarang user: field yang sudah terisi tidak boleh berubah. Dan yang ketimpa bukan field sepele — dokumen identitas yang di-upload manual.

Akar masalahnya dua bagian yang saling bertabrakan:

**a.** `deriveSikiFields()` memutuskan nilai dokumen pakai `resolveFotoUrl()`, yang secara desain memang "SIKI selalu menang":

```ts
// lib/siki-fields.ts:142-147
export function resolveFotoUrl(current, incoming) {
  return incoming || current
}
```

**b.** `backfillEmptyFields()` memanggilnya dengan `current` = nilai KTA lama, lalu **membuang** keputusan itu dan mengecek kekosongan sendiri dari nilai KTA asli:

```ts
// lib/kta-upgrade.ts:86-89
const derived = await deriveSikiFields(sikiData, sikiApi, {
  ktpUrl: existingKta.ktpUrl,
  fotoUrl: existingKta.fotoUrl,
})

// lib/kta-upgrade.ts:104-105, 114
{ field: 'fotoUrl', kolom: 'fotoUrl', label: 'Foto' },
...
if (!kosong((existingKta as Record<string, unknown>)[kolom])) continue
```

`resolveFotoUrl()` sengaja dibuat memihak SIKI **di jalur refresh**, karena foto di SIKI memang sering berganti. Tapi di jalur backfill aturannya kebalikan. Fungsi itu dipakai ulang di jalur yang aturannya beda, dan hasilnya dipakai tanpa dicek lagi.

KTP **tidak** kena — `resolveKtpUrl()` memang sudah memihak upload manual. Jadi cuma foto yang bocor. Tabel `kandidat` tampak seperti sudah menjaga (nilai KTA asli dicek `kosong()`), tapi nilai `derived.fotoUrl` yang dipakai sudah lebih dulu ditimpa SIKI.

**Skenario gagal:**

1. Anggota punya KTA lama, `fotoUrl = "/uploads/documents/foto-1758000000-ab12cd.png"` (upload manual BPP, karena SIKI keblokir geo).
2. Data di SIKI berubah — fotonya di-update petugas SIKI, jadi `sikiData.fotoUrl = "https://siki.gatensi.or.id/foto/baru.jpg"`.
3. Anggota mengajukan perpanjangan dengan jenjang **sama** (atau lebih rendah).
4. `checkUpgradeScenario()` menolak permohonan → benar.
5. `backfillEmptyFields()` jalan → `derived.fotoUrl = "https://siki.../baru.jpg"` → `existingKta.fotoUrl` **tidak** kosong, jadi lolos ke `data.fotoUrl = ...` → `prisma.kTARequest.update()`.
6. KTA lama yang sudah terbit sekarang menunjuk foto SIKI. Kalau URL SIKI geo-blocked dari server produksi, kartu berikutnya yang dicetak dari KTA itu kehilangan foto sama sekali (`lib/pdf-generator.ts:613-616` melempar dan foto di-skip).

**Saran perbaikan:** jangan lewatkan keputusan dokumen ke `deriveSikiFields()` di jalur backfill. Ambil nilainya langsung dari SIKI dan biarkan pengecekan `kosong()` yang memutuskan:

```ts
const kandidat = [
  ...
  { field: 'ktpUrl',  kolom: 'ktpUrl',  label: 'KTP',  nilai: sikiData?.ktpUrl },
  { field: 'fotoUrl', kolom: 'fotoUrl', label: 'Foto', nilai: sikiData?.fotoUrl },
]
```

Atau, kalau mau tetap lewat `deriveSikiFields()`, jangan kirim `current` dan pakai aturan "cuma kolom kosong yang disentuh" khusus di jalur ini. Yang mana pun dipilih, aturannya harus satu.

</details>

---

## 2. Jalur import Excel tanpa cek role, `daerahId` dari body, cek pemilik tidak ada — KRITIS

`app/api/kta/import/route.ts:433-439` dan `lib/kta-upgrade.ts:78-80`

`PUT` memeriksa session ada, lalu **tidak memeriksa role** dan menerima `daerahId` apa adanya dari body:

```ts
// app/api/kta/import/route.ts:433-436
const body = await request.json()
const { rows, daerahId } = body
...
// :439
let finalDaerahId = daerahId || session.user.daerahId
```

Jadi user role `DAERAH` bisa mengimpor ke daerah mana pun. Bandingkan dengan `app/api/kta/create/route.ts:41-60`, yang punya pemeriksaan eksplisit (`canAssignAnyDaerah`) dan menolak `403` kalau daerah tujuan bukan daerahnya. Jalur import tidak punya padanannya.

Lapisan kedua yang hilang: `backfillEmptyFields()` mengambil baris target tanpa cek hak akses sama sekali:

```ts
// lib/kta-upgrade.ts:78-80
const existingKta = await prisma.kTARequest.findUnique({
  where: { id: existingKtaId },
})
```

`existingKta.id` itu langsung dipakai sebagai target `prisma.kTARequest.update()` di `lib/kta-upgrade.ts:142-145`. Pencocokan `nik` ada di pemanggil (`checkUpgradeScenario`), dan itu memang mencari lintas daerah — itulah maksudnya.

Perlu ditegaskan supaya tidak ditakut-takuti berlebihan: **jalur tulis ini belum aktif hari ini.** `app/api/kta/import/route.ts:483` memanggil `checkUpgradeScenario` dengan `sikiData = undefined`, dan `backfillEmptyFields()` balik `[]` di baris pertama kalau `sikiData` falsy. Jadi pagarnya cuma ketidakhadiran satu argumen — begitu ada yang mengirim `sikiData` ke situ (parameternya sudah ada di signature), penulisan lintas daerah langsung hidup, termasuk tulisan ke KTA yang `nik`-nya sama tapi bukan milik si pemanggil.

Satu bug yang **aktif sekarang**: `requestedBy` di `app/api/kta/import/route.ts:518` diisi `session.user.id`, jadi atribusi baris impor massal menunjuk petugas yang mengunggah Excel, bukan anggota yang datanya diimpor. Untuk data legacy, atribusi ini salah dan tidak bisa direkonstruksi belakangan.

**Saran perbaikan:**
- Batasi `PUT` import ke role `PUSAT`/`ADMIN`/`00`, dan validasi `daerahId` terhadap `session.user.daerahId` untuk role `DAERAH` — samakan dengan `create/route.ts:41-60`.
- Tambah parameter `actorId` + `actorRole` ke `checkUpgradeScenario()`, dan di `backfillEmptyFields()` tolak kalau `existingKta.requestedBy !== actorId` dan role bukan admin/pusat.
- Putuskan sadar nilai `requestedBy` untuk baris impor (mis. user sistem khusus impor) dan tulis alasannya di komentar, jangan warisi pengunggah.

---

## 3. `regenerate-qr-codes` sekarang nol hasil, dan berisiko menimpa QR semua KTA approval — TINGGI

`app/api/admin/regenerate-qr-codes/route.ts:43-67`

Route ini ditulis buat era `qrCodePath` berisi data URL base64, dan validasinya masih memakai bentuk itu:

```ts
const qrCodePath = await QRCodeGenerator.generateKTAQR({ nik: kta.nik })

// Check if the new QR code is valid (should be > 1000 characters for base64)
const base64Part = qrCodePath.split(',')[1]
if (base64Part && base64Part.length > 1000) { ... }
```

Sejak `lib/qr-generator.ts:25-32` diubah, `generateKTAQR()` mengembalikan `"/uploads/qr-codes/qr-<nik>.png"` — **tidak ada koma** di dalamnya, jadi `split(',')[1]` = `undefined`. `base64Part` falsy → masuk cabang `skipped++` → cabang suksesnya **tidak pernah tercapai**.

Dua konsekuensi:

1. **Fungsinya mati.** Dipanggil ADMIN, responsnya selalu `{ regenerated: 0, skipped: <semua> }`. Tidak ada error, tidak ada peringatan — diam-diam tidak melakukan apa-apa.
2. **Kalau validasinya diperbaiki tanpa mengubah alamat tulisnya, kerusakannya lebih besar.** `generateKTAQR()` menimpa file di path deterministik `qr-codes/qr-<nik>.png` (`lib/qr-generator.ts:41-43`) dan menulis nilai itu ke kolom `qrCodePath` tiap KTA. Route ini menyapu **semua** KTA berstatus `APPROVED_BY_PUSAT`, `READY_TO_PRINT`, `PRINTED`, `UPGRADE_PAID` (`:20-25`). Kalau ada dua KTA dengan `nik` sama di dua daerah (persis kasus yang dibebaskan oleh aturan daerah 98), keduanya berbagi satu file QR. Yang belakangan diproses menang, dan KTA yang satunya memakai QR milik kartu yang lain.

**Saran perbaikan:** ganti validasinya jadi cek keberadaan file hasil tulis, bukan panjang base64:

```ts
const url = await QRCodeGenerator.generateKTAQR({ nik: kta.nik })
const buf = await readUpload(url.replace(/^\/?uploads\//, ''))
if (buf && buf.length > 1000) { ... }
```

Dan pertimbangkan menambah `id` ke nama file (`qr-<nik>-<ktaId>.png`) supaya dua KTA ber-NIK sama tidak saling menimpa.

---

## 4. `sikiData` mentah dari client dipakai untuk menulis KTA milik user lain — TINGGI

`app/api/kta/check-upgrade/route.ts:14` dan `:29`

Endpoint ini menerima `sikiData` mentah dari **body request**, lalu meneruskannya apa adanya ke `backfillEmptyFields()`:

```ts
const { nik, jenjang, subklasifikasi, daerahKode, sikiData } = await request.json()
...
const result = await checkUpgradeScenario(nik, parseInt(jenjang), subklasifikasi || '',
  sikiData, ...)
```

Server tidak pernah memverifikasi `sikiData` terhadap SIKI, dan `nik` juga dari body. Yang dikirim halaman apply adalah objek SIKI hasil fetch di browser, dan objek itu **tidak** memuat `fotoData` — foto base64 cuma dirakit di server (`app/api/kta/[id]/generate-pdf/route.ts:190-198`), karena URL SIKI keblokir geo dari sisi browser.

Akibatnya jalur backfill yang lewat halaman web **tidak pernah** mengisi `fotoData`, sementara kalau dipanggil dengan payload yang lengkap, itu bisa. Jadi angka "field yang dilaporkan terisi" di UI bergantung dari mana fungsi itu dipanggil, padahal aturannya seharusnya satu.

Lebih jauh: karena `sikiData` datang dari client, **isinya bisa apa saja**. `authMiddleware` menutup pintu anonim, tapi tidak menutup "user login A menulis ke KTA milik B" — `backfillEmptyFields()` tidak memeriksa `requestedBy` (lihat temuan #2).

**Saran perbaikan:** jangan percaya `sikiData` dari client. Ambil dari SIKI di server pakai `idIzin`/`nik` seperti `refresh-siki` (`app/api/kta/[id]/refresh-siki/route.ts:52-61`). Kalau mau menghindari fetch dobel, kirim id-nya saja, bukan payload-nya. Dan batasi siapa yang boleh memicu penulisan: minimal `requestedBy === session.user.id` atau role PUSAT/ADMIN.

---

## 5. `daerahKode` di form pengajuan diambil dari daerah sesi, bukan daerah tujuan — TINGGI

`app/dashboard/kta/apply/page.tsx:136`

```tsx
// Kode daerah buat pengecekan NIK — daerah 98 dibebaskan dari cek lintas daerah.
// Halaman ini cuma pegang `selectedDaerahId`, jadi kodenya diambil dari sesi.
const daerahKode = session?.user?.daerah?.kodeDaerah
```

Komentarnya mengakui sendiri keterbatasannya. Yang jadi masalah bukan cuma petugas yang pindah daerah — halaman ini sudah punya `selectedDaerahId` (dipakai buat hitung harga lewat `daerah/price`), dan `daerahKode` **tidak** diambil dari sana.

Sementara `app/api/kta/create/route.ts:122` memakai `daerah?.kodeDaerah` dari **daerah tujuan** (`daerahId` yang sudah divalidasi terhadap hak akses user di `:54`). Jadi dua pengecekan untuk NIK yang sama memakai filter daerah yang berbeda:

- Pengecekan di form (yang menentukan tombol submit aktif/tidak dan pesan alasan) pakai kode daerah **sesi**.
- Pengecekan di server saat create pakai kode daerah **tujuan**.

**Skenario gagal (arah 98 → luar):**

1. Petugas di daerah 98 mengisi pengajuan untuk anggota yang **sudah punya KTA di luar 98** (mis. 32), dan memilih daerah tujuan 32.
2. Form mengirim `daerahKode: '98'` → server memfilter `{ daerah: { kodeDaerah: '98' } }` → KTA di 32 tidak terlihat → `canUpgrade: true` → tombol submit aktif, harga muncul.
3. Petugas klik submit → `app/api/kta/create/route.ts` memakai `daerah?.kodeDaerah = '32'` → filter jadi `{ daerah: { isNot: { kodeDaerah: '98' } } }` → KTA di 32 ketemu → `canUpgrade: false` → `400` dengan `reason` yang **tidak ditampilkan** (route create membalas `{ error }`, sementara halaman apply menampilkan `upgradeInfo.reason`).
4. Petugas cuma lihat "Tidak dapat membuat permohonan KTA" tanpa penjelasan, setelah mengisi seluruh form dan menjalankan fetch SIKI.

Arah sebaliknya juga salah, cuma lebih jarang kelihatan: petugas luar 98 yang mengajukan ke daerah 98 tidak dapat pengecualian di form, jadi anggota yang seharusnya boleh mengajukan malah ke-blok di UI (lalu lolos di server — tidak fatal, cuma bikin petugas mengira tidak bisa).

**Saran perbaikan:** kirim kode daerah **tujuan**, bukan kode daerah sesi. Halaman sudah punya `selectedDaerahId`; ambil peta id → kode dari endpoint yang sudah ada (`app/api/daerah/route.ts`) atau kirim `daerahId` saja dan biarkan server yang me-resolve, konsisten dengan `create`. Tambahan: di `create`, sertakan `upgradeCheck.reason` di body respons error supaya UI bisa menampilkannya.

---

## 6. Kolom Excel "PROVINSI" diperlakukan sebagai kode daerah — TINGGI

`app/api/kta/import/route.ts:84`

```ts
daerahKode: ['DAERAH', 'KODE_DAERAH', 'KODEDAERAH', 'WILAYAH', 'REGION', 'REGION_CODE', 'PROVINSI', 'PROVINCE'],
```

Nilai yang ketemu di kolom mana pun dari daftar itu dipakai apa adanya sebagai kode daerah, lalu dibandingkan `===` dengan `daerah.kodeDaerah` (2 digit, mis. `'32'`, `'98'`).

Kolom Excel berjudul **PROVINSI** hampir pasti berisi nama provinsi (`"JAWA BARAT"`), bukan kode. `'JAWA BARAT'` tidak akan pernah cocok dengan `daerah.kodeDaerah` mana pun. Efeknya:

- Baris dengan kolom PROVINSI berisi nama provinsi → kode tidak cocok → `rowKodeDaerah = undefined` → filter daerah jadi `{}` → pengecekan NIK jadi lintas semua daerah. Hasilnya senyap: tidak ada peringatan bahwa kolom PROVINSI tidak terbaca.
- Kalau ada sistem lain yang menulis kode provinsi sebagai `32` di kolom PROVINSI, itu baru cocok — dan bertabrakan dengan makna `kodeDaerah`, yang di schema pun dipisah dari `kodePropinsi` (`prisma/schema.prisma:86`).

Jadi alias `PROVINSI`/`PROVINCE` mencampur dua konsep yang seharusnya berbeda.

**Saran perbaikan:** buang `PROVINSI`/`PROVINCE` dari daftar alias `daerahKode`, atau petakan lewat `Daerah.kodePropinsi` secara eksplisit, dan laporkan di hasil import berapa baris yang kode daerahnya tidak terbaca — jangan diam-diam jatuh ke "semua daerah".

---

## 7. `daerahKode` di import dipakai tanpa jatuh ke kode daerah tujuan impor — TINGGI

`app/api/kta/import/route.ts:476-477`

```ts
const rowDaerahKode = row.daerahKode ? String(row.daerahKode).trim() : ''
const rowKodeDaerah = kodeDaerahValid.has(rowDaerahKode) ? rowDaerahKode : undefined
```

`rowKodeDaerah` diambil dari kolom Excel baris itu, tapi kalau kolomnya kosong/tidak valid, filternya jadi `{}` — bukan kode daerah sesi, padahal `finalDaerahId` yang dipakai untuk menulis barisnya adalah `daerahId || session.user.daerahId` (`:439`).

Jadi untuk file Excel tanpa kolom daerah (kasus paling umum — semua baris masuk ke daerah pengunggah), pengecekan NIK berjalan **tanpa filter daerah sama sekali**. Petugas daerah 32 yang mengimpor 500 baris historis akan mendapat penolakan untuk setiap NIK yang punya KTA di daerah mana pun, bukan cuma di daerah 32. Itu kebalikan dari yang dimaksud: `create` dan `create-manual` dua-duanya memakai kode daerah tujuan.

Lebih buruk lagi, aturan pengecualian 98 tidak jalan di sini: baris dengan NIK yang punya KTA di 98 akan diblok, padahal di jalur lain tidak.

**Saran perbaikan:** pakai `rowKodeDaerah ?? daerah?.kodeDaerah` — jatuh ke kode daerah tujuan impor kalau baris tidak menyebut daerahnya sendiri. Itu bikin ketiga jalur (create, create-manual, import) memakai aturan yang sama.

---

## 8. `formatAlamatWithRW()` masih bocor di beberapa variasi input — SEDANG

`lib/kta-format.ts:26-31`

Perbaikan lookbehind memang menutup kasus slash dobel — sudah diverifikasi, dan **aman** untuk kasus itu. Tapi perbaikannya cuma menyelesaikan gejala yang dilaporkan; pola RT/RW tanpa spasi masih bocor karena `\b` gagal mencocok di dalam urutan alfanumerik atau di antara titik dua. Hasil eksekusi nyata:

| input | hasil sekarang | hasil yang benar |
|---|---|---|
| `RT.05 RW.02` | `/RT.05 /RW.02` | `/RT 05 /RW 02` |
| `RT.001/RW.002` | `/RT.001/RW.002` | `/RT 001 /RW 002` |
| `RT/RW 05/02` | `/RT/RW 05/02` | kebijakan (mungkin memang begitu) |
| `jl. melati RT:03` | `/Jl. Melati /RT:03` | `/RT 03` |
| `rw-2` | tidak cocok sama sekali | `/RW 2` |
| `jl mawar RT 5, RW 6` | `Jl Mawar /RT 5, /RW 6` | benar |

Yang paling sering muncul di lapangan adalah bentuk **`RT.05`** dan **`RT.001/RW.002`** — penulisan resmi di banyak KTP dan dokumen kelurahan. Untuk dua bentuk itu, output sekarang salah: angka RT/RW menempel ke label tanpa spasi, jadi kartu cetak menampilkan `/RT.001/RW.002` alih-alih `/RT 001 /RW 002`.

**Skenario gagal:** KTP anggota beralamat `"KP. MAWAR RT.001/RW.002"` → hasil format `"Kp. Mawar /RT.001/RW.002"` → tercetak di kartu dan tampil di halaman verifikasi QR. Bukan crash, tapi kartu itu beda dari konvensi `/RT 001 /RW 002` yang dipakai kartu lain.

**Saran perbaikan:** jadikan separator bagian dari pola, bukan mengandalkan `\b`:

```ts
formatted = formatted.replace(/[\s.\-:/]*\b(rt|rw)\b[\s.:-]*(\d{1,3})/gi, (_m, label, num) => `/${label.toUpperCase()} ${num}`)
```

Lalu tambah test untuk `RT.05 RW.02`, `RT.001/RW.002`, dan `RT:03`. Pastikan juga `kartu`/`setruk`/`kwartir` tetap aman (`\b` di depan label wajib dipertahankan).

---

## 9. Banding `resolveKtpUrl` di `skippedDocuments` bukan logika resolusi sebenarnya — SEDANG

`app/api/kta/[id]/refresh-siki/route.ts:97-99`

```ts
const skippedDocuments: string[] = []
if (ktaRequest.ktpUrl && resolveKtpUrl(ktaRequest.ktpUrl, sikiData.data?.ktpUrl) !== sikiData.data?.ktpUrl) {
  skippedDocuments.push('KTP')
}
```

`resolveKtpUrl(current, incoming)` mengembalikan `current` kalau `incoming` falsy. Jadi kalau SIKI **tidak** mengirim `ktpUrl` sama sekali (`null`/`undefined`), hasilnya `current`, dan `current !== undefined` → benar → `skippedDocuments` berisi `'KTP'`.

Padahal tidak ada yang di-skip: tidak ada dokumen SIKI yang ditolak, memang tidak ada dokumen SIKI. Ini membandingkan "apakah nilai SIKI beda dari hasil resolusi", bukan "apakah saya menolak nilai SIKI".

**Skenario gagal:** Anggota punya KTA dengan `ktpUrl = "/uploads/documents/ktp-manual.jpg"`. SIKI balas tanpa field `ktpUrl` (field-nya absen, bukan `null` eksplisit — yang lazim di salah satu dari dua format respons). Response refresh berisi `skippedDocuments: ["KTP"]` → UI menampilkan "dokumen KTP manual Anda dipertahankan, SIKI punya versi berbeda" padahal SIKI tidak punya apa-apa.

**Saran perbaikan:** cek langsung kondisi sebenarnya — ada dokumen SIKI, tapi ditolak:

```ts
const incomingKtp = sikiData.data?.ktpUrl
if (incomingKtp && ktaRequest.ktpUrl && isLocalUpload(ktaRequest.ktpUrl)) {
  skippedDocuments.push('KTP')
}
```

---

## 10. `formatNama()` bisa menghilangkan nama belakang dan mengembalikan string kosong — SEDANG

`lib/pdf-generator.ts:53-84`

Untuk nama dengan lebih dari 2 kata, `formatNama()` menyusun `abbreviated` dari kata pertama + inisial kata tengah, lalu:

```ts
if ((abbreviated + ' ' + lastWord).length <= maxChars) {
  abbreviated += ' ' + lastWord
}
return abbreviated        // tanpa cabang else
```

Kalau gabungan kata pertama + inisial + kata terakhir sudah melewati 25 karakter, blok terakhir tidak jalan dan fungsi mengembalikan `abbreviated` yang isinya cuma kata pertama plus inisial — kata terakhir **hilang**.

Dua sisi masalahnya:
1. **Data hilang tanpa peringatan** — nama belakang anggota tidak muncul di kartu.
2. **Bisa mengembalikan string kosong.** Kalau `words[0]` adalah string kosong (nama berawalan spasi, mis. `" Budi Santoso Agung"`), `abbreviated` mulai dari `''`, loop inisial bisa kena `break`, dan hasilnya `''` → `page.drawText('', ...)` menggambar nol karakter. Kartu terbit dengan kolom nama kosong.

**Skenario gagal:** nama `"Muhammad Rizky Ramadhan Saputra Wijaya"` (5 kata). `abbreviated` = `"Muhammad R. R. R."` (20 karakter) + `" Wijaya"` = 29 > 25 → tidak ditempel → hasil `"Muhammad R. R. R."`, kata `"Wijaya"` hilang padahal itu nama belakang yang biasanya dipakai di dokumen resmi.

**Saran perbaikan:** tambah cabang else yang memotong dengan elipsis (`nama.slice(0, 22) + '...'`), dan `trim()` nama sebelum di-split. Tambah test untuk nama panjang dan nama berawalan spasi.

---

## 11. `jenjang` kosong/`0` jadi string kosong di DB, lalu dibaca sebagai kategori AHLI — SEDANG

`lib/siki-fields.ts:171` dan `:223`

```ts
let jenjang: string | number = data?.jenjang || ''
...
jenjang: String(jenjang),
```

`data.jenjang` bertipe `string | number | null`. Kalau SIKI mengirim angka `0` (atau `klasifikasiKualifikasi.jenjang` bernilai `0`), `|| ''` menganggapnya falsy → `jenjang` jadi `''` → `String('')` = `''`. Kolom `jenjang` NOT NULL tapi boleh string kosong, jadi ini lolos ke DB sebagai baris tanpa jenjang.

Yang lebih buruk kalau nilainya lewat `parseInt`: `getJenjangCategory()` (`lib/kta-upgrade.ts:49`) melakukan `parseInt('', 10)` = `NaN`, dan `NaN <= 3` = `false`, `NaN <= 6` = `false` → jatuh ke `'AHLI'`. Jadi KTA tanpa jenjang diperlakukan sebagai kategori jenjang 7-9. Sementara `getHargaBaseByJenjang('')` di `app/api/kta/create/route.ts:9-13` melakukan `parseInt('')=NaN`, `NaN >= 7` = false → harga Rp 100.000. Kategori dan harga jadi tidak konsisten untuk input yang sama.

Komentar di `lib/siki-fields.ts:65` menyebut "Schema nyimpen jenjang sebagai String — jangan kirim number ke Prisma" — itu benar, tapi tidak ada penjagaan terhadap nilai tak-valid.

**Saran perbaikan:** validasi di `deriveSikiFields()`: kalau `jenjang` tidak bisa di-parse jadi 1-9, lempar error atau tandai supaya pemanggil bisa menolak, jangan diam-diam menulis string kosong:

```ts
const jenjangNum = typeof jenjang === 'number' ? jenjang : parseInt(String(jenjang), 10)
if (!Number.isFinite(jenjangNum) || jenjangNum < 1 || jenjangNum > 9) {
  throw new Error(`Jenjang SIKI tidak valid: ${JSON.stringify(data?.jenjang)}`)
}
```

---

## 12. `orderBy: { jenjang: 'desc' }` nge-sort string, bukan angka — RENDAH

`lib/kta-upgrade.ts:203`

```ts
orderBy: { jenjang: 'desc' }  // Get highest jenjang first
```

Kolom `jenjang` bertipe `String`, dan Prisma mengurutkan string secara leksikografis: `"9" > "8" > ... > "3" > "2" > "10" > "1"`. Efeknya baru kelihatan kalau ada jenjang dua digit, dan validasi import membolehkan sampai 10 (`app/api/kta/import/route.ts:296`), jadi itu bukan kasus yang mustahil. Kalau sudah ada, KTA jenjang 10 tidak terbaca sebagai tertinggi sehingga perbandingan jenjang salah.

Belum jadi bug aktif karena data sekarang cuma 1-9. Perbaikannya butuh ubah tipe kolom atau pindah sorting ke aplikasi — perubahan yang lebih besar, jadi sengaja tidak diambil di audit ini.

---

## 13. Template di-embed ulang per kartu di PDF antara — RENDAH

`lib/pdf-generator.ts:853-867`

`generateBulkKTACards()` memanggil `generateKTACard()` per kartu, masing-masing membuat `PDFDocument` baru, lalu `copyPages` memindahkan halamannya. Binary template di-embed ulang di tiap PDF antara yang langsung dibuang — boros CPU, **tapi tidak boros ukuran** karena `copyPages` berbagi referensi XObject.

Encode sharp-nya sendiri sudah di-cache proses-level (`templateImage`, `templateImageBack`) dan `templateMtime` menjaga cache tetap valid (`:292`, `:382`), jadi tiap proses cuma sekali encode. Dampaknya cuma CPU.

---

## Yang dicek dan ternyata aman

- **`embedJpg` vs `embedPng` tidak ketuker.** Ketiga jalur template memakai `.jpeg()` dari sharp dan di-embed dengan `embedJpg` (`lib/pdf-generator.ts:472`, `:837`), dan jalur fallback (`:341-350`, `:431-440`) juga `.jpeg()`. QR tetap PNG di semua jalur dan di-embed dengan `embedPng` (`:804`). Foto pakai palette PNG → `embedPng` (`:697`, `:701`). Tidak ada buffer JPEG yang di-embed lewat `embedPng`, atau sebaliknya.
- **Kompresi template tidak menghilangkan alpha yang dibutuhkan.** Template digambar `fit: 'cover'` memenuhi seluruh halaman, jadi tidak ada region transparan yang perlu dipertahankan. Foto yang butuh alpha (sudut membulat) tetap PNG.
- **`readLocalQrFile()` menangani dua lokasi.** Prefix `uploads/` dibuang sebelum jadi key (`lib/pdf-generator.ts:41`), dan `readUpload()` menolak path traversal lewat pemeriksaan `resolve()` (`lib/upload-storage.ts:99-105`). Fallback ke `public/` tanpa cek traversal tapi tidak berbahaya karena `qrCodePath` berasal dari DB, bukan input user.
- **Jaring pengaman QR tidak bisa menggandakan QR.** `qrImageBytes` di-set `undefined` sebelum blok fallback (`lib/pdf-generator.ts:764`, `:777`), dan blok fallback (`:791-800`) cuma jalan kalau nilainya falsy.
- **`authMiddleware` di `check-upgrade` benar-benar terpasang.** Terkonfirmasi di `git diff` (`+import { authMiddleware }` di baris 3 dan blok 401 di baris 9-12). Endpoint itu memang satu-satunya dari `app/api/kta/**` yang tadinya terbuka; sisanya sudah punya auth, kecuali `public/[id]/[nomorKTA]` yang memang sengaja publik.
- **Pengecualian daerah 98 dua arah benar.** `filterDaerah` (`lib/kta-upgrade.ts:168-172`) dipasang di **dua** query — pending (`:178`) dan completed (`:198`). Pengajuan di 98 cuma melihat KTA di 98; pengajuan di luar 98 melihat semua kecuali 98. `undefined` mengembalikan `{}` seperti perilaku lama. Diverifikasi lewat `tests/unit/kta-upgrade.test.ts` ("pengecualian daerah kode '98'").
- **`terisi.push('Foto')` ADA** di `lib/kta-upgrade.ts:141`, jadi kasus "cuma `fotoData` yang kosong" sudah tertangani dan `update` tetap dipanggil. Ada unit test khusus untuk ini (`tests/unit/backfill-fotodata.test.ts`), dan suite-nya hijau.
- **Tidak ada id DOM duplikat di halaman apply.** Semua 11 `id` unik (`bulkIdIzin`, `idIzin`, `daerah`, `nik`, `nama`, `jabatan`, `subklasifikasi`, `jenjang`, `telp`, `email`, `alamat`), dan halaman itu tidak punya `<input type="file">` sama sekali. Yang punya input file (`app/dashboard/kta/[id]/page.tsx:604,654`) memakai id dinamis per-KTA.
- **Tanggal cetak tidak berubah setelah backfill.** `print` (`app/api/kta/[id]/print/route.ts`) tidak pernah menulis ke KTA sama sekali, jadi jalur cetak ulang tidak bisa memicu backfill dan tanggal cetak asli tetap utuh.
- **`resolveKtpUrl` tidak bocor di jalur backfill.** Berbeda dari `resolveFotoUrl`, fungsi ini memang secara desain memihak dokumen upload manual, jadi bertabrakan dengan aturan backfill pun hasilnya kebetulan benar.

---

## Celah cakupan

- **Tidak ada test untuk jalur import**, padahal temuan #2, #6, dan #7 semuanya di situ.
- **Tidak ada test untuk `daerahKode` dari client** (`check-upgrade`), jadi temuan #4 dan #5 tidak terjaga.
- **Mock Prisma bukan Prisma.** Query `where`/`orderBy` ditiru manual, jadi perilaku MySQL yang sebenarnya (termasuk `orderBy` leksikografis di temuan #12) tidak diuji.
- **Perubahan baru di `app/dashboard/kta/apply/page.tsx` belum diuji di browser.** Temuan #5 cuma dari pembacaan kode.
- **Temuan #12 dan #13 tidak diperbaiki**, cuma dicatat. Keduanya butuh keputusan yang belum diambil.
