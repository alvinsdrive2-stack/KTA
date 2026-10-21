# Audit UI/UX — Sistem KTA Gatensi

Tanggal: 28 September 2026
Cakupan: `app/dashboard/kta/**` (apply, daftar, detail, print), `app/dashboard/permohonan`, `app/dashboard`, `app/auth/login`, layout dashboard + navigasi sidebar, plus komponen shadcn/ui yang dipakai berulang.
Metode: pembacaan kode saja (read-only). Tidak ada server dev, tidak ada browser, tidak ada perubahan kode.
Standar: WCAG 2.2 AA.

---

## Siapa user-nya

Empat peran, satu aplikasi, dan mereka bukan versi satu sama lain yang beda warna:

| Peran | Kode | Yang dia kerjain | Frekuensi | Yang dia nggak ngerti |
|---|---|---|---|---|
| BPD (pengurus daerah) | `DAERAH` | Ambil data dari SIKI dengan ID Izin, simpan permohonan, bayar invoice, unggah KTP/foto kalau kosong | Harian, sering batch 30-50 ID Izin sekali duduk | Istilah DB (`backfill`, `field`, status enum), aturan upgrade |
| BPP (pusat) | `PUSAT` | Ajukan, lihat semua daerah, refresh SIKI, ajukan perubahan data | Harian | Sama, tapi lebih paham alur |
| Keuangan | `KEUANGAN` | Verifikasi pembayaran, tolak dengan alasan, cetak laporan | Harian | Alasan penolakan harus sampai ke BPD — ini jalur komunikasi mereka |
| Admin | `ADMIN` | Kelola user, import, edit semua field KTA | Sesekali | — |

Implikasi paling penting: BPD adalah user yang paling tertekan waktunya dan paling nggak paham istilah teknis, tapi mereka peran yang paling jarang jadi subjek saat halaman ditulis. Layar yang gagal buat BPD (misalnya penolakan jenjang) adalah layar yang paling mahal buat organisasi — orang harus telepon kantor pusat.

---

## Ringkasan Eksekutif — 5 Masalah Paling Berdampak

Urut dari paling berdampak.

### 1. Alasan penolakan jenjang tidak memberi tahu user harus ngapain, dan menyebut field dengan istilah teknis

`app/dashboard/kta/apply/page.tsx:1072-1088`

Blok `Alert` penolakan menampilkan `upgradeInfo.reason` — string yang dirakit di `lib/kta-upgrade.ts:240`:

> "Anda sudah memiliki KTA jenjang 5. Tidak bisa membuat KTA dengan jenjang yang sama."

String ini menyebut masalahnya, tapi berhenti di situ. User nggak tahu ini jalan buntu permanen atau ada yang bisa dilakuin. NN/g menyebut pesan error harus "offer some potential remedies" dan "reduce error-correction effort" — bukan cuma mendeskripsikan masalah.

Yang lebih parah, kalau ada backfill, UI menambah:

> "Data KTA yang sudah ada ikut dilengkapi dari SIKI: Subklasifikasi, KTP. Field yang sudah terisi tidak diubah."

Kata "field" bocor ke user. BPD nggak tahu "field" itu apa. Frasa "Data KTA yang sudah ada ikut dilengkapi" juga ambigu — user nggak lihat KTA lama dan nggak bisa verifikasi apa yang berubah (`lib/kta-upgrade.ts:72-148` mengubah kolom di baris KTA lama secara diam-diam). Perubahan data yang tidak diminta dan tidak bisa dilihat user, lalu dilaporkan dengan istilah yang tidak dia pahami.

Label yang benar adalah nama kolom dalam bahasa layar, bukan bahasa DB: "Subklasifikasi" (nama DB `subklasifikasiId`) dan "KTP" (nama DB `ktpUrl`) — lihat `lib/kta-upgrade.ts:97-106`.

Rekomendasi:
- Ganti pesan jadi format tetap tiga bagian: (1) apa yang terjadi, (2) kenapa, (3) harus ngapain. Contoh: "Nama ini sudah punya KTA Kualifikasi 5. KTA baru harus lebih tinggi dari 5, atau sama dengan 5 tidak perlu diajukan lagi. Kalau datanya berubah, pakai tombol Refresh SIKI di halaman detail KTA."
- Ganti "Field yang sudah terisi tidak diubah." → "Kolom yang sudah ada isinya tidak ditimpa."
- Daftar field jangan dipisah koma dalam satu paragraf. Pakai daftar dengan nama kolom bahasa layar: Kualifikasi, Subklasifikasi, Jabatan Kerja, No. Telepon, Email, Alamat, KTP, Foto.
- Tautkan ke KTA lama yang diubah — user harus bisa lihat sendiri apa yang berubah.

### 2. "Simpan Permohonan" dibuat disabled dengan alasan yang tidak dijelaskan

`app/dashboard/kta/apply/page.tsx:1207-1221`

```jsx
<Button
  onClick={completeCurrentAndNext}
  disabled={isLoading || (upgradeInfo && !upgradeInfo.canUpgrade)}
```

Saat penolakan jenjang, tombol utama mati. User lihat tombol abu-abu, nggak ada yang bilang kenapa. Yang tersisa cuma "Batal & Cari Ulang" (`:1198-1205`) yang me-reload seluruh halaman — artinya antrian ID Izin (bisa 50 item) hilang total, tanpa konfirmasi apa pun.

Ini kombinasi yang buruk: satu-satunya jalan keluar yang kelihatan justru menghapus kerjaan user. NN/g juga menekankan "preserve the user's input so they can edit rather than restart".

Rekomendasi:
- Tombol disabled harus punya teks alasan di sebelahnya (`aria-describedby` ke id pesan penolakan di `:1072`). Jangan mengandalkan posisi visual saja.
- "Batal & Cari Ulang" ganti jadi "Kembali ke Antrian" yang me-reset item saat ini tanpa reload, atau minimal pakai `Dialog` konfirmasi: "Antrian berisi N ID Izin akan hilang. Lanjut?"
- Tombol "Lewati" untuk maju ke ID Izin berikutnya juga tidak muncul di state ini (hanya muncul kalau `status === 'error'`, `:1172`). Padahal di sini user paling butuh lewati item ini. Tambahkan.

### 3. Tabel daftar KTA melanggar aksesibilitas dan rusak di layar sempit

`app/dashboard/kta/page.tsx:421-518`

- `<table>` nggak punya `<caption>` dan header `<th>` nggak punya `scope="col"`.
- `<SortableHeader>` (`components/ui/sortable-header.tsx:26-34`) merender `<button>` di dalam `<th>` tanpa `aria-sort`. Screen reader nggak bisa ngumumin kolom mana yang terurut dan arahnya.
- Baris `<tr>` punya `onClick` untuk navigasi (`:471-476`) tapi bukan elemen yang bisa di-focus dan nggak bisa diaktifkan lewat keyboard (Enter/Space). Pelanggaran 2.1.1 Keyboard — navigasi utama daftar cuma bisa pakai mouse.
- Baris terpilih ditandai `bg-blue-50/70 scale-[1.01]` (`:473-475`) — penanda pilihan pakai warna dan skala saja. Pelanggaran 1.4.1 Use of Color.
- Checkbox pilih baris (`:482-492`) nggak punya label aksesibel. Pelanggaran 4.1.2 Name, Role, Value / 1.3.1.
- Tabel 8-9 kolom dengan `px-4 py-3` di dalam `overflow-hidden` (bukan `overflow-x-auto`) di `:420`.

Rekomendasi: Tabel ini butuh kerja nyata, bukan tempelan. Prioritas: `scope="col"` di semua `<th>`, `aria-sort` di `SortableHeader` (nilai `ascending`/`descending`/`none`), baris jadikan `<Link>` atau beri `tabIndex={0}` + `onKeyDown` Enter/Space, checkbox beri `aria-label={"Pilih " + request.nama}`, ubah `overflow-hidden` → `overflow-x-auto`.

### 4. Heading lompat dari `<h1>` ke `<h3>` di hampir semua halaman

Terdeteksi di `app/dashboard/kta/page.tsx:264` → `:280`, `app/dashboard/permohonan/page.tsx:213` → `:279`, `app/dashboard/kta/apply/page.tsx:529` → `:1236`, `app/dashboard/kta/[id]/page.tsx:516` → `:579`. Tidak ada `<h2>` sama sekali di halaman-halaman ini.

Pelanggaran 1.3.1 Info and Relationships dan 2.4.6 Headings and Labels (AA). Efeknya nyata buat yang pakai screen reader: struktur halaman jadi rata, user nggak bisa lompat antar-seksi.

Rekomendasi: Audit `CardTitle` di `components/ui/card.tsx`: pakai `<h2>` untuk judul card tingkat halaman, `<h3>` untuk sub-bagian. Di detail KTA, `<h3>` "KTP (Kartu Tanda Penduduk)" (`:579`) dan "Pas Foto 3x4" (`:631`) sebenarnya `<h4>` — induknya CardTitle.

### 5. Pesan error memakai `alert()` bawaan browser, dan tidak ada `aria-live` untuk error inline

`alert()` di `app/dashboard/kta/[id]/page.tsx:242,269,273`, `app/dashboard/kta/page.tsx:236`, `app/dashboard/layout-client.tsx:495,498`.

`alert()` memblokir thread, tidak bisa di-style, tidak konsisten dengan `toast` yang sudah ada di aplikasi ini (`components/ui/toast.tsx` dipakai di `app/dashboard/kta/[id]/page.tsx` untuk kasus serupa). User harus menutup dialog browser yang keluar dari konteks.

Error inline pakai `<p>` biasa tanpa `role="alert"` atau `aria-live`: `app/dashboard/kta/apply/page.tsx:802-807`, `components/auth/login-form.tsx:99-103,123-127`, `app/auth/change-password/page.tsx:114-118`. Screen reader tidak akan otomatis membacanya saat muncul. Pelanggaran 4.1.3 Status Messages (AA).

Rekomendasi: Ganti semua `alert()` jadi `toast({variant:'destructive'})` yang sudah ada. Untuk error inline, bungkus dengan `role="alert"` atau beri `aria-live="polite"` pada kontainernya.

---

## Temuan per Halaman

### `app/dashboard/kta/apply/page.tsx` — Permohonan KTA Baru (prioritas tertinggi)

Hierarki informasi. Halaman ini menumpuk sampai 5 Card sekaligus saat antrian aktif: Progress (`:539-612`), Bulk Input (`:708-765`), Search (`:768-863`), Header Item (`:869-905`), Data Pemohon (`:908-1046`), Pembayaran (`:1049-1166`), plus action bar fixed (`:1169-1224`). Nggak ada petunjuk mana yang harus dibaca dulu.

Label dan kejelasan. Bagus: `<Label htmlFor>` sudah benar dan cocok dengan id input di semua field (`:719,788,813,925-994`). Ini di atas rata-rata.

Yang kurang: field "ID Izin" punya tiga teks bantuan berturut-turut (`:796-801`) yang saling tumpang tindih:

> "Masukkan 21 digit nomor ID Izin yang Anda dapatkan dari SIKI."
> "Dapat dipisahkan dengan koma, atau spasi untuk menambahkan banyak ID Izin sekaligus."

Lalu tombol "Banyak" (`:848-858`) membuka mode input massal yang fungsinya sama. Tiga cara buat tujuan yang sama (ketik banyak di satu field, tombol "Banyak", tombol "Tambah" di progress bar `:555-563`). User nggak tahu bedanya.

Placeholder `:791` juga aneh: ada spasi di depan, dan contoh 21 digit `I-202600000000000000` sebenarnya 22 karakter. Kalau user percaya "21 digit" dan contohnya beda, yang salah siapa?

Penempatan aksi utama. Tombol "Simpan Permohonan" ada di bar `fixed bottom-0` (`:1169`). Di desktop dengan sidebar, bar ini `left-0 right-0` — menimpa sidebar, meski ada `lg:pl-64` di `<main>`. Perlu diverifikasi visual, tapi dari kelas CSS-nya `left-0` di dalam `<main>` yang punya `lg:pl-64` berarti bar mulai dari tepi kiri viewport. Bandingkan floating bar di `layout-client.tsx:69-72` yang benar: `lg:left-64`.

State kosong. Kalau `idIzinQueue.length === 0`, yang tampil cuma form pencarian. Tidak ada penjelasan bahwa user boleh masukin banyak ID sekaligus, dan tidak ada contoh alur. Halaman dashboard justru punya empty state yang bagus (`app/dashboard/page.tsx:620-633`) — tidak konsisten.

Pesan error. `:350` menempel emoji silang ke pesan error. Emoji dibaca screen reader sebagai "cross mark". Ada juga `:353` dengan emoji yang sama. String error di `:256-260` mencampur istilah: "ID Izin tidak valid. Pastikan ID Izin yang Anda masukkan benar." — ngasih tahu apa yang salah, nggak ngasih tahu harus ngapain.

Alert penolakan `:1072-1088` — sudah dibahas di Ringkasan #1. Detail tambahan soal kontras: Alert memakai `variant="destructive"` dengan override `className="border-red-200 bg-red-50"` dan `AlertDescription className="text-red-800 text-sm"`. Kontras `text-red-800` (#991b1b) di atas `bg-red-50` (#fef2f2) = 7.60:1 — aman. Paragraf di dalamnya (`:1078`) memakai `text-red-700` (#b91c1c) di atas `bg-red-50` = 6.47:1 — juga aman. Jadi masalahnya bukan kontras, murni isi pesan.

Satu hal lagi: pengecekan `checkUpgrade` (`:149-186`) jalan async. Sebelum respons datang, `upgradeInfo` masih `null`, jadi user bisa menekan "Simpan Permohonan" dan langsung dapat error dari server. Tidak ada indikator "sedang cek kelayakan". Kalau cek-nya gagal (`:180-182` hanya `console.error`), user nggak tahu sama sekali, dan tombol tetap aktif — jadi dia dapat error server yang lebih membingungkan.

### `app/dashboard/kta/page.tsx` — Data KTA

Kejelasan label. Header `:282` sangat panjang dalam satu paragraf. Kalimatnya juga rusak:

> "...untuk mengunduh laporan data KTA dalam format Excel data dapat difilter berdasarkan rentang tanggal di sebelah kiri tombol."

Kalimat kedua nggak punya subjek dan tanda bacanya hilang. Koma-nya harusnya titik.

State kosong. `:414-418` bagus — ada icon + pesan. Tapi pesan "Belum ada KTA yang terverifikasi" nggak membedakan "memang belum ada" vs "filter Anda nggak cocok". Kalau user baru saja pasang filter tanggal, dia dapat pesan yang sama, dan bisa mengira datanya hilang.

Filter. `:307-319` — dua `<Input type="date">` tanpa `<Label>`. Yang ada cuma icon Calendar dan teks "sd". Input date nggak punya nama aksesibel sama sekali. Pelanggaran 4.1.2 dan 3.3.2 Labels or Instructions. Selain itu tidak ada tombol reset filter — untuk menghapus rentang tanggal, user harus menghapus dua input date manual, dan `onChange` pada date input di browser nggak selalu memberi nilai kosong.

Tombol. `:325` tombol Excel `bg-emerald-600` — kontras teks putih di atas #059669 sekitar 3.6:1 (di bawah 4.5:1 untuk teks normal). `:344` `bg-blue-600` aman. `:352` `bg-purple-800 text-white` sekitar 5.08:1, aman, tapi pasangan hover `hover:text-purple-100` + `hover:bg-purple-950` bikin teks keabu-abuan di atas ungu sangat gelap.

Kolom "No. Invoice". `:443` header biasa (bukan SortableHeader, wajar). Isinya `getInvoiceNumber` (`:190-192`) selalu ambil `payments[0]`. Kalau ada lebih dari satu pembayaran, yang tampil cuma yang pertama — dan nggak ada indikator ada yang lain.

### `app/dashboard/kta/[id]/page.tsx` — Detail KTA

Kartu Nomor KTA `:542-554` punya kontras yang rusak. Ini bug visual, bukan preferensi. Card diberi `text-white` tapi anak-anaknya menimpanya:

- `:547` `text-slate-700` (#334155)
- `:548` `text-slate-800` (#1e293b) untuk nomor KTA ukuran `text-3xl`

Latar Card adalah gradient `from-blue-600 to-blue-700` (#2563eb ke #1d4ed8). Rasio `#1e293b` di atas `#2563eb` = 3.90:1 — di bawah 4.5:1. Nomor KTA adalah informasi paling penting di halaman ini dan justru paling susah dibaca. Pelanggaran 1.4.3 Contrast Minimum.

Perbaikannya gampang: hapus `text-slate-700` dan `text-slate-800`, biarkan `text-white` dari parent. Putih di atas #1e40af = 8.72:1.

Edit inline `:397-462` hanya bisa pakai mouse. `renderEditableField` membuat `div` ber-`onClick` untuk "Kosong - klik untuk isi" (`:429-441`). Nggak ada `tabIndex`, nggak ada `role="button"`, nggak ada handler keyboard. Admin yang tidak bisa pakai mouse nggak akan pernah bisa mengisi field kosong. Pelanggaran 2.1.1 Keyboard.

Tombol ikon tanpa nama aksesibel, `:418-423` — ikon Save dan X di dalam `Button` tanpa `aria-label`. Screen reader mengumumkan "button" tanpa nama. Sama di `:448-455`, `:811-818`, `:838-845`, `:866-873`, `:915-922`. Pelanggaran 4.1.2 Name, Role, Value.

Yang lebih halus: tombol edit di state normal (`:449-455`) pakai `opacity-0 group-hover:opacity-100`. Artinya tombol itu invisible sampai mouse hover. Keyboard user yang tab ke situ akan fokus ke tombol yang nggak kelihatan — pelanggaran 2.4.7 Focus Visible dan 2.4.11 Focus Not Obscured. Solusi: tambahkan `group-focus-within:opacity-100` dan `focus-visible:opacity-100`.

Tombol "Preview & Download" `:1033-1046` aktif walau PDF nggak tersedia. `handleDownloadPDF` (`:238-248`) mengecek status dan memanggil `alert()`. Jadi tombolnya kelihatan aktif, user klik, dapat dialog browser: "PDF belum tersedia. KTA harus sudah diverifikasi dan siap cetak." Di bawahnya (`:1047-1051`) ada teks kecil "PDF belum tersedia" — jadi sistem sudah tahu statusnya tapi tetap membiarkan tombol aktif. Lebih baik `disabled` sejak awal.

Modal preview PDF `:1069-1073`. `<iframe>` ke `generate-pdf`. Nggak ada fallback kalau iframe kosong. Nggak ada indikator loading.

Modal refresh SIKI `:1090-1193`. Ini modul terbaik di halaman ini. Perbandingan lama vs baru jelas, pakai label teks "Data Lama" / "Data Baru (SIKI)", dan ada thumbnail foto. Satu masalah kontras: `text-green-600` (#16a34a) di atas putih = 3.30:1, gagal 1.4.3 untuk teks normal. Ganti ke `green-700` (#15803d, 5.02:1).

Status badge `:464-473` tidak punya entri `REJECTED`, jadi jatuh ke default `{label: status}` yang menampilkan enum mentah `REJECTED` ke user.

### `app/dashboard/permohonan/page.tsx` — Data Permohonan

Filter status `:305-318` menyembunyikan status yang paling penting. Opsi yang tersedia hanya: Semua Status, Draft, Menunggu Pembayaran, Siap Cetak. Padahal `getStatusLabel` (`:184-198`) mendefinisikan 10 status termasuk `REJECTED` dan `IMPORTED_PENDING_DOCS`. User nggak bisa memfilter "mana yang ditolak" — justru daftar yang paling perlu ditindaklanjuti.

Tidak ada alasan penolakan di daftar. Badge "Ditolak" (`:404-406`) cuma label. User harus klik masuk ke detail, dan di `app/dashboard/kta/[id]/page.tsx` tidak ada tampilan alasan penolakan sama sekali — malah menampilkan enum mentah `REJECTED`.

Jadi alur penolakan BPD saat ini: lihat badge "Ditolak" di daftar, klik, lihat badge "REJECTED", nggak ada alasannya, telepon kantor pusat. Ini kebocoran istilah DB terburuk di aplikasi.

Pesan empty state `:349-352` bagus karena menyebut penyebab spesifik: "Anda belum di-assign ke daerah. Silakan hubungi administrator." Ini contoh yang harus ditiru halaman lain.

### `app/auth/login/page.tsx` + `components/auth/login-form.tsx`

Halaman login bersih dan di atas rata-rata. Label benar (`:83,107`), `htmlFor` cocok dengan `id`. Pesan error `:53` untuk `ACTIVE_SESSION_EXISTS` sangat bagus — spesifik, menyebut durasi idle, memberi dua opsi.

Masalah:

1. Error di `:75-80` tidak punya `role="alert"`. Screen reader nggak akan membacanya. Pelanggaran 4.1.3 Status Messages.
2. Checkbox "Ingat saya" `:131-137` tidak berfungsi. Tidak ada state, tidak ada `register`, tidak ada handler. User centang, tidak ada efek apa pun. Ini lebih buruk daripada tidak ada checkbox — user mengira sesinya akan diingat, lalu kaget ke-logout. Fungsi idle logout (`useIdleLogout`, `app/dashboard/layout-client.tsx:549`) membuat perilakunya makin tidak terduga.
3. `console.log` di jalur login `:41,48,59` membocorkan email user ke console produksi. Bukan masalah UI, tapi ada di jalur UI.
4. Kontras ikon `text-gray-400` (#9ca3af) di atas putih = 2.54:1. Ikon dekoratif dikecualikan dari 1.4.3 kalau tidak menyampaikan informasi, dan di sini memang dekoratif (ada label teks). Aman.
5. `text-slate-500` di footer `:54` (#64748b di atas `bg-slate-100`) sekitar 4.5:1 — pas di ambang. Ukuran 12px jadi tetap harus 4.5:1. Aman tapi jangan digelapkan lagi.

### Layout dashboard + sidebar (`app/dashboard/layout-client.tsx`, `components/dashboard/dashboard-nav.tsx`)

Bagus: overlay mobile tutup sidebar (`:590-596`), ESC menutup sidebar (`:565-573`), body scroll dikunci saat sidebar terbuka (`:576-585`). Ini detail yang sering kelewat dan di sini dikerjakan.

Masalah:

1. Tombol hamburger `:699-706` tanpa `aria-label`. Cuma ikon Menu. Screen reader bilang "button". Pelanggaran 4.1.2. Perlu `aria-label` "Buka menu" dan `aria-expanded` yang terikat ke `sidebarOpen`.
2. Typo di `:720` — ada backslash literal sebelum BPD di teks sapaan header. Tampil sebagai garis miring terbalik lalu BPD. Bug teks.
3. Bahasa campur di header: "Selamat datang kembali, BPP Budi" tapi untuk keuangan jadi "Finance" (Inggris) — sementara di `:738` role KEUANGAN ditampilkan sebagai "Keuangan". Dua terjemahan berbeda untuk role yang sama.
4. Ikon nav di `dashboard-nav.tsx:290-293` tanpa `aria-hidden="true"`, jadi nama ikon ikut terbaca di samping teks link.
5. Indikator aktif `dashboard-nav.tsx:270-283`: teks putih di atas `from-blue-700` (#1d4ed8) = 6.7:1, aman. Item non-aktif `text-slate-600` di atas `bg-white/70` sekitar 7:1, aman.
6. Floating bar `:69-72` pakai `fixed bottom-0 left-0 right-0` dan `lg:left-64`. Ini benar (memperhitungkan sidebar), berbeda dari action bar di apply page yang `left-0` tanpa kompensasi. Inkonsisten.
7. Input "Alasan penolakan..." di `:415-422` tanpa `<Label>`, cuma `placeholder`. Placeholder hilang saat user mulai mengetik. Pelanggaran 3.3.2 dan 4.1.2. Ini input yang menentukan apakah pembayaran ditolak — user harus ingat apa yang sedang dia tulis.
8. Overlay `:594` sudah `aria-hidden="true"` — benar.

### `app/dashboard/page.tsx` — Dashboard

Halaman paling matang secara kosmetik. Empty state `:620-633` adalah yang terbaik di aplikasi: icon, judul, penjelasan, tombol aksi. Kartu "Permohonan Terbaru" punya deskripsi `:616` yang jujur soal berapa dari berapa yang ditampilkan.

Masalah:

- `:654` `bg-Gatensi-blue` — bukan class Tailwind valid (huruf besar di tengah). Tidak ada di `tailwind.config.js`. Class ini tidak menghasilkan apa pun, jadi avatar inisial tidak punya latar. Bug visual.
- `:501` tombol Refresh `border-white/40 text-black hover:bg-white/20 hover:text-white` — teks hitam di atas gradient biru #1E3A8A terlihat salah dan rusak saat hover (teks berubah putih sambil latar juga memutih).
- Stat card "Draft" `:464` berdeskripsi "Belum Mencetak Invoice" — membingungkan, karena `waitingApproval` dihitung dari status `DRAFT` (`:224-226`) yang artinya "belum diajukan", bukan "belum cetak invoice".
- `:397,406` kondisi `userRole === 'PUSAT' || userRole === 'ADMIN'` nggak menyertakan `KEUANGAN`, padahal `isPusatOrAdmin` (`:467`) menyertakan. Jadi user KEUANGAN tidak pernah dapat refresh chart saat periode berubah.

### `app/dashboard/kta/[id]/print/page.tsx`

- `:49` — pesan error berisi string rusak: campur Inggris dengan kata "Terkonfirmasiing" yang bukan kata apa pun. Jelas sisa find-and-replace yang gagal.
- `:52` — pesan error berbahasa Inggris ke user Indonesia.
- `:120-124` halaman error menampilkan pesan teknis mentah di dalam Card tanpa langkah selanjutnya.
- `handleDownloadPDF` (`:63-81`) tidak punya state loading dan tidak menampilkan error ke user (hanya `console.error`). User klik, nggak terjadi apa-apa, nggak ada penjelasan.

---

## Aksesibilitas (WCAG 2.2 AA)

Tingkat: KRITIS = memblokir user / kehilangan data; SERIUS = gagal AA / user tidak bisa menyelesaikan tugas; SEDANG = menyulitkan, ada workaround; RINGAN = kosmetik.

### KRITIS

Tabel di bawah ini pakai pipe. Kolom: nomor, lokasi, masalah, kriteria WCAG, perbaikan.

| # | Lokasi | Masalah | Kriteria | Perbaikan |
|---|---|---|---|---|
| A1 | `app/dashboard/kta/[id]/page.tsx:542-548` | Nomor KTA ditulis `text-slate-800` (#1e293b) di atas gradient `from-blue-600 to-blue-700`. Rasio 3.90:1 di bagian terang. Info terpenting halaman, paling susah dibaca. `text-white` di Card tertimpa. | 1.4.3 Contrast (Minimum) | Hapus `text-slate-700` dan `text-slate-800` di `:547,548`; biarkan inherit `text-white` dari Card. |
| A2 | `app/dashboard/kta/[id]/page.tsx:429-441,796-805,900-910` | "Kosong - klik untuk isi" adalah `div` ber-`onClick` tanpa `tabIndex`, `role`, atau `onKeyDown`. Jalur satu-satunya mengisi field kosong, hanya bisa mouse. | 2.1.1 Keyboard | Jadikan `button type="button"` dengan `aria-label` yang menyebut nama kolomnya. |
| A3 | `app/dashboard/kta/page.tsx:471-476`, `app/dashboard/permohonan/page.tsx:388-392`, `app/dashboard/page.tsx:647-651` | Baris tabel navigasi pakai `tr` ber-`onClick` tanpa `tabIndex`, `role`, atau handler keyboard. Navigasi utama tidak bisa keyboard. | 2.1.1 Keyboard | Bungkus isi sel pertama dengan `Link` yang membentang, atau `tr` dengan `tabIndex={0}` dan `onKeyDown`. |

### SERIUS

| # | Lokasi | Masalah | Kriteria | Perbaikan |
|---|---|---|---|---|
| B1 | `app/dashboard/kta/apply/page.tsx:802-807`, `components/auth/login-form.tsx:99-103,123-127`, `app/auth/change-password/page.tsx:114-118`, `login-form.tsx:75-80` | Error form dirender sebagai `p` atau `div` tanpa `role="alert"` atau `aria-live`. Screen reader tidak mengumumkan saat error muncul. | 4.1.3 Status Messages (AA) | `role="alert"` pada kontainer error, atau `aria-live="assertive"`. Hubungkan ke input dengan `aria-describedby` dan `aria-invalid`. |
| B2 | `components/ui/sortable-header.tsx:26-34` | `button` di dalam `th` tanpa `aria-sort`. Screen reader tidak tahu kolom mana terurut dan arahnya. | 4.1.2 Name, Role, Value | Tambah `aria-sort` pada `th` dengan nilai `ascending`, `descending`, atau `none`. |
| B3 | `app/dashboard/kta/page.tsx:421`, `app/dashboard/permohonan/page.tsx:356` | `table` tanpa `caption`; `th` tanpa `scope="col"`. | 1.3.1 Info and Relationships | Tambah `caption` dengan kelas `sr-only` dan `scope="col"` di semua `th`. |
| B4 | `kta/page.tsx:264` menuju `:280`, `permohonan/page.tsx:213` menuju `:279`, `apply/page.tsx:529` menuju `:1236`, `kta/[id]/page.tsx:516` menuju `:579` | Lompatan `h1` ke `h3` tanpa `h2`. Struktur halaman rata. | 1.3.1, 2.4.6 Headings and Labels (AA) | CardTitle jadi `h2`, sub-bagian jadi `h3`. Audit `components/ui/card.tsx`. |
| B5 | `app/dashboard/kta/page.tsx:307-319` | Dua `Input type="date"` tanpa `Label` apa pun. Hanya icon dan teks "sd". | 3.3.2 Labels or Instructions, 4.1.2 | `Label htmlFor` yang cocok dengan `id` baru, atau label `sr-only`. |
| B6 | `layout-client.tsx:415-422` | Input alasan penolakan pembayaran hanya punya `placeholder`, tanpa `Label`. Placeholder hilang saat mengetik. | 3.3.2, 4.1.2 | `Label htmlFor="rejectionReason"` dengan kelas `sr-only`. |
| B7 | `app/dashboard/kta/[id]/page.tsx:418-423,448-455,811-818,838-845,866-873,915-922` | Tombol ikon-saja (Save, X, Pencil) tanpa nama aksesibel. | 4.1.2 Name, Role, Value | Tambah `aria-label` spesifik per field, mis. "Simpan perubahan nama". |
| B8 | `layout-client.tsx:699-706` | Tombol hamburger tanpa `aria-label`, tanpa `aria-expanded`. | 4.1.2 | `aria-label` "Buka menu navigasi" plus `aria-expanded` yang terikat ke `sidebarOpen`. |
| B9 | `app/dashboard/kta/[id]/page.tsx:449-455,814-818,839-845,867-873,916-922` | Tombol edit `opacity-0 group-hover:opacity-100`. Fokus keyboard mendarat di tombol tak terlihat. | 2.4.7 Focus Visible (AA), 2.4.11 Focus Not Obscured (AA, baru 2.2) | Tambah `focus-visible:opacity-100 group-focus-within:opacity-100`. |
| B10 | `app/dashboard/kta/page.tsx:482-492` | Checkbox baris tanpa label aksesibel. Checkbox header `:428-433` juga. | 4.1.2, 1.3.1 | `aria-label` yang menyebut nama pemilik baris, dan label untuk checkbox header. |

### SEDANG

| # | Lokasi | Masalah | Kriteria | Perbaikan |
|---|---|---|---|---|
| C1 | `app/dashboard/kta/[id]/page.tsx:1149-1154` | Label "Data Baru (SIKI)" pakai `text-green-600` (#16a34a) di atas putih = 3.30:1. Gagal untuk teks 14px. | 1.4.3 | Ganti `green-600` ke `green-700` (#15803d, 5.02:1). |
| C2 | `app/dashboard/kta/page.tsx:325` | Tombol `bg-emerald-600` dengan teks putih sekitar 3.6:1. Gagal untuk teks 14px. | 1.4.3 | `bg-emerald-700`. |
| C3 | `app/dashboard/kta/[id]/page.tsx:435-438,801-804,906-909` | Teks "Kosong - klik untuk isi" pakai `text-amber-600` (#d97706) di atas putih = 3.19:1. | 1.4.3 | Ganti `amber-600` ke `amber-700` (#b45309, 4.84:1 di atas amber-50) atau `amber-800` (7.09:1). |
| C4 | `app/dashboard/kta/page.tsx:473-475` | Baris terpilih dibedakan lewat `bg-blue-50/70` dan `scale-[1.01]` saja (warna dan ukuran). | 1.4.1 Use of Color | Tambah ikon centang di kolom pertama saat `isSelected`. |
| C5 | `app/dashboard/kta/apply/page.tsx:586-607` | Status antrian (selesai, error, proses, pending) dibedakan lewat warna border dan ikon, tanpa teks status. Ikon ada, jadi lolos 1.4.1 secara teknis, tapi ikon tidak punya label dan tombolnya tanpa `aria-label`. | 1.4.1, 4.1.2 | `aria-label` yang menyebut ID Izin dan statusnya dalam kata. Tampilkan juga teks status kecil. |
| C6 | `app/dashboard/kta/apply/page.tsx:1072-1088` | Alert penolakan tampil setelah `checkUpgrade` async selesai, tapi tidak ada pengumuman. User screen reader nggak tahu kelayakan berubah. | 4.1.3 | Beri `aria-live="polite"` pada area Pembayaran, atau `role="status"` pada pembungkus hasil cek. |
| C7 | `app/dashboard/kta/[id]/page.tsx:1291-1304` | Tombol zoom di panel pratinjau tidak punya `aria-label`; ada dua set (desktop dan mobile) yang duplikat, screen reader bisa membaca keduanya. | 4.1.2 | `aria-label` "Perbesar" dan "Perkecil", plus `aria-hidden` pada set yang disembunyikan CSS. |

Catatan: badge jenjang di `components/ui/jenjang-badge.tsx:16-27` sudah aman — `text-yellow-700` di atas `bg-yellow-100` sekitar 4.7:1, dan setiap warna punya label teks, jadi lolos 1.4.1 dan 1.4.3. Tidak ada aksi.

### RINGAN

| # | Lokasi | Masalah | Kriteria | Perbaikan |
|---|---|---|---|---|
| D1 | `app/dashboard/kta/apply/page.tsx:350,353` | Emoji silang di dalam string error. Dibaca screen reader sebagai "cross mark". | 1.1.1 (non-teks) | Hapus emoji; gunakan ikon Lucide dengan `aria-hidden`. |
| D2 | `layout-client.tsx:612-618,643-651,685-693,744-762` | Banyak `Image` latar peta Indonesia dan duplikat `alt="Logo Shadow"` untuk logo yang sama. Gambar dekoratif harus `alt=""`. | 1.1.1 | Latar dekoratif: `alt=""`. Logo shadow: `aria-hidden` atau hapus elemennya. |
| D3 | `dashboard-nav.tsx:290-293` | Ikon nav tanpa `aria-hidden="true"`, jadi nama ikon ikut terbaca di samping teks link. | 1.1.1 | `aria-hidden="true"` pada wrapper ikon. |
| D4 | `components/ui/loading-spinner.tsx:27,43` | `Image alt="Loading..."` pada gambar yang berputar terus akan mengganggu. `PulseLogo` dipakai di banyak tempat. | 1.1.1 | `alt=""` plus `aria-hidden`, dan beri kontainer `span` dengan `role="status"` dan kelas `sr-only` berisi teks "Memuat". |

### Yang sudah benar (jangan diutak-atik)

- `Label htmlFor` di `apply/page.tsx` cocok dengan `input id` di semua field. Ini pekerjaan yang benar dan sering dilupakan.
- `components/ui/alert.tsx:30` sudah punya `role="alert"` di root. Semua `Alert` di aplikasi otomatis terumumkan.
- Overlay mobile sidebar `layout-client.tsx:590-596` punya `aria-hidden="true"` dan menutup saat diklik.
- ESC menutup sidebar (`:565-573`) dan body scroll dikunci (`:576-585`).
- Modal refresh SIKI menyandingkan "Data Lama" dan "Data Baru (SIKI)" dengan label teks, bukan cuma warna.
- Semua gambar `img` di `apply/page.tsx:1317,1368` dan `kta/[id]/page.tsx:639,709,1119,1134` punya `alt` yang bermakna.
- `focus-visible:ring-2` sudah jadi default di `components/ui/button.tsx:7` dan `input.tsx:14`.

---

## Konsistensi Desain

Yang dipakai berulang tapi beda bentuk.

1. Tombol aksi utama punya 5 gaya berbeda untuk peran yang sama:
   - `bg-slate-800 text-slate-100` di `apply/page.tsx:1210`, `permohonan/page.tsx:228`, `kta/page.tsx:561`
   - `bg-blue-800 text-slate-100` di `apply/page.tsx:838,1255`
   - `bg-blue-600` di `kta/[id]/page.tsx:1036`, `layout-client.tsx:398`
   - `bg-slate-800` tanpa `text-slate-100` di `dashboard/page.tsx:627`
   - `bg-brand-blue-600` (default Button) di `components/ui/button.tsx:15`

   Jadi ada 3 biru berbeda (`blue-600` #2563eb, `blue-800` #1e40af, `brand-blue-600` #2563eb) dan 2 slate. User nggak bisa belajar "tombol utama = warna X".

2. Dua komponen Progress yang berbeda: `components/ui/progress.tsx` dan `components/ui/animated-progress.tsx` ada, tapi `apply/page.tsx:576-581` membuat progress bar sendiri dengan `div` ber-`bg-slate-200 rounded-full h-2`. Tiga implementasi.

3. Spacing halaman tidak seragam: `space-y-5` di `kta/page.tsx:260`, `permohonan/page.tsx:209`, `dashboard/page.tsx:471`; tapi `space-y-6` di `kta/[id]/page.tsx:503`. Padding dalam layout `p-6 lg:p-8` (`layout-client.tsx:770`) vs `px-6` di header (`:697`) juga tidak kelipatan yang sama.

4. Ukuran judul halaman: `text-2xl font-semibold` konsisten di `kta/page.tsx:264`, `permohonan/page.tsx:213`, `apply/page.tsx:529`, `kta/[id]/page.tsx:516`. Tapi dashboard pakai `text-3xl font-bold` (`dashboard/page.tsx:487`) di banner — beda perlakuan.

5. Judul Card campur antara `text-base` (`apply/page.tsx:618,711,771,910,1051`, `kta/page.tsx:375`) dan `text-lg` (`kta/[id]/page.tsx:696,959,998,1027`). Tidak ada aturan.

6. `CardHeader` dengan `border-b border-slate-200 bg-slate-50/50` diulang di sekitar 15 tempat sebagai string literal. Kalau warnanya berubah, ada 15 tempat yang harus diubah. Layak jadi varian Card.

Komponen shadcn/ui yang dipakai: `alert`, `badge`, `button`, `card`, `dialog`, `input`, `label`, `select`, `separator`, `textarea`, `toast`/`toaster`/`use-toast`, `progress` (terdefinisi tapi jarang dipakai), `sortable-header` (buatan sendiri), `jenjang-badge` (buatan sendiri), `autocomplete`, `loading-spinner`, `animated-progress`, `current-date`, `page-transition`.

Yang tidak dipakai padahal tersedia: `textarea` (dipakai elemen `textarea` mentah di `apply/page.tsx:720,995`), `select` (dipakai elemen `select` mentah di `apply/page.tsx:814`), `dialog` (dipakai panel `fixed` manual di `apply/page.tsx:1265-1391`). Tiga kasus di mana komponen yang sudah ada dilewati.

Kelas CSS yang tidak ada di config:
- `bg-Gatensi-blue` (`dashboard/page.tsx:654`) — Tailwind case-sensitive, tidak ada definisinya, tidak menghasilkan apa pun.
- `card-3d`, `sidebar-shimmer`, `hero-pattern`, `nav-link`, `btn-ripple`, `custom-scrollbar`, `animate-slide-up-stagger`, `stagger-1` sampai `stagger-6` — dipakai di mana-mana. Perlu dicek di `app/globals.css`; kalau tidak ada, banyak animasi yang tidak jalan.

---

## Responsif

Tabel lebar yang bermasalah di HP:

1. `app/dashboard/kta/page.tsx:420` — dibungkus `div` ber-`overflow-hidden`, bukan `overflow-x-auto`. Tabel 9 kolom. Di layar 375px, kolom akan dihimpit, bukan bisa di-scroll. Bandingkan `permohonan/page.tsx:355` dan `dashboard/page.tsx:635` yang pakai `overflow-x-auto` dengan benar. Ini inkonsistensi sekaligus bug.

2. `app/dashboard/kta/page.tsx:294-320` — baris pencarian, dua date input, tombol Excel, dan (untuk admin) dua tombol lagi dalam `flex flex-wrap gap-3`. Di HP akan menumpuk jadi 3-4 baris. `min-w-[250px]` di search (`:295`) dan `w-[160px]` di tiap date (`:311,318`) membuat satu baris butuh sekitar 520px minimum. Layar 375px: search turun sendiri, dua date tetap berdampingan (250+160 = 410px, masih lebih dari 375). Kemungkinan overflow horizontal.

3. `app/dashboard/kta/page.tsx:528-576` — pagination `flex items-center justify-between` dengan 7 tombol. Di HP, teks "Halaman X dari Y" plus "Sebelumnya" plus 5 nomor plus "Selanjutnya" tidak akan muat. Tidak ada pengecilan.

4. `app/dashboard/kta/apply/page.tsx:1169-1171` — action bar `fixed bottom-0 left-0 right-0` dengan `max-w-5xl mx-auto px-6 py-4`, isinya 2-3 tombol dalam `flex gap-3`. Tombol "Simpan & Lanjut ke Berikutnya" (`:1217`) punya teks panjang di `flex-1`. Di HP 375px dengan "Lewati" dan "Coba Lagi" juga muncul, teks tombol utama akan terpotong atau overflow. Nggak ada `flex-wrap`.

5. `app/dashboard/kta/apply/page.tsx:584-609` — antrian ID Izin `flex gap-2 overflow-x-auto` dengan tiap item `min-w-[120px]`. Untuk 50 item, ini scroll horizontal panjang tanpa indikator posisi kecuali scrollbar. Tidak ada ringkasan "3 dari 50" — padahal header `:533` menyebut "Memproses 3 dari 50".

6. `app/dashboard/kta/apply/page.tsx:625` — ringkasan `grid grid-cols-3 gap-4` tanpa prefiks responsif. Di 375px, tiga kolom angka besar (`text-2xl`) akan sempit. Seharusnya `grid-cols-1 sm:grid-cols-3`.

7. `app/dashboard/kta/[id]/page.tsx:692` — `grid-cols-1 lg:grid-cols-3` — benar, sudah responsif.

8. `layout-client.tsx:770-771` — `p-6 lg:p-8` sedang, tapi `min-h-[630px]` memaksa tinggi minimum di HP.

9. `app/dashboard/kta/[id]/print/page.tsx` — halaman print, layout print biasanya aman, tapi tombol header dalam `flex items-center justify-between` akan sempit di HP.

Kesimpulan: daftar KTA dan action bar halaman apply adalah dua tempat yang paling mungkin rusak. Keduanya bisa diperbaiki dengan `overflow-x-auto` (1 baris) dan `flex-wrap` (1 baris).

---

## Bahasa dan Penulisan

Campur Indonesia dan Inggris yang tidak konsisten:

| Lokasi | Teks | Masalah |
|---|---|---|
| `app/dashboard/kta/[id]/print/page.tsx:52` | "Failed to fetch KTA data" | Inggris penuh ke user Indonesia |
| `layout-client.tsx:495,498` | "Failed to download files" | Inggris penuh |
| `app/dashboard/admin/regenerate-qr/page.tsx:24` | "Failed to regenerate QR codes" | Inggris |
| `app/dashboard/admin/kta-sequence-import/page.tsx:43` | "Failed to download template" | Inggris |
| `app/dashboard/kta/[id]/print/page.tsx:49` | "KTA not Terkonfirmasiing" | Rusak. Sisa find-replace yang gagal. Bukan bahasa apa pun. |
| `app/dashboard/kta/page.tsx:330` | "Downloading..." | Sementara tombol lain bilang "Memproses..." (`layout-client.tsx:367`) dan "Menyimpan..." (`change-password/page.tsx:179`) |
| `app/dashboard/kta/[id]/page.tsx:530` | "Refreshing..." | Inggris; `:1181` bilang "Mengupdate..." — dua pola |
| `app/dashboard/kta/[id]/page.tsx:615,665` | "Uploading..." | Inggris |
| `app/dashboard/kta/[id]/page.tsx:1039` | "Downloading..." | Inggris |
| `layout-client.tsx:720` | "Finance" | Inggris, padahal `:738` bilang "Keuangan" |
| `app/dashboard/admin/data-manage/page.tsx:149,151,155` | "Upgrade Pending", "Import Pending Docs", "Pending" | Inggris, sementara `permohonan/page.tsx:186-196` punya label Indonesia untuk status yang sama |
| `app/dashboard/kta/apply/page.tsx:1083` | "Field yang sudah terisi tidak diubah." | "Field" bocor ke user |
| `app/dashboard/kta/apply/page.tsx:1076` | `upgradeInfo.reason` | "jenjang" dipakai tanpa dijelaskan bahwa itu sama dengan "Kualifikasi" yang dipakai di kartu berikutnya (`:1092`) |
| `app/dashboard/kta/[id]/page.tsx:570` | "Format yang diterima: JPG, PNG, atau PDF (maksimal 5MB)" | "5MB" tanpa spasi — seharusnya "5 MB" |

Label status yang berbeda antar halaman untuk status yang sama:

| Status | `permohonan/page.tsx:184-198` | `dashboard/page.tsx:426-439` | `kta/[id]/page.tsx:464-473` |
|---|---|---|---|
| `READY_FOR_PUSAT` | "Siap ke Pusat" | "Siap Verifikasi Pusat" | tidak ada |
| `APPROVED_BY_PUSAT` | "Terkonfirmasi" | "Terkonfirmasi" | "Terverifikasi" |
| `PRINTED` | "Sudah Cetak" | "Sudah Dicetak" | "Sudah Cetak" |
| `IMPORTED_PENDING_DOCS` | "Import - Perlu Dokumen" | tidak ada | "Perlu Dokumen" |
| `READY_TO_PRINT` | "Siap Cetak" | "Siap Cetak" | "Siap Cetak" |
| `REJECTED` | "Ditolak" | "Ditolak" | "REJECTED" (enum mentah) |

Tiga file, tiga definisi label, dua di antaranya berbeda. `kta/[id]/page.tsx` bahkan tidak punya entri untuk `REJECTED`, jadi user melihat enum mentah. Seharusnya ada satu modul `lib/status-label.ts` (file ini belum ada di `lib/`).

Pesan error yang tidak memberi tahu user harus ngapain:

| Lokasi | Pesan | Kenapa gagal |
|---|---|---|
| `app/dashboard/admin/data-manage/page.tsx:297,325,353` | "Terjadi kesalahan saat memuat data" | Tidak bilang data apa, tidak bilang harus ngapain, tidak ada tombol coba lagi |
| `app/dashboard/admin/data-manage/page.tsx:422` | "Terjadi kesalahan saat memperbarui data" | Idem |
| `app/auth/change-password/page.tsx:67`, `login-form.tsx:67` | "Terjadi kesalahan. Silakan coba lagi." | "Coba lagi" tanpa menyebut kemungkinan penyebab. Kalau masalahnya bukan jaringan, ulang sebanyak apa pun tidak akan menolong |
| `app/dashboard/admin/daerah-diskon/page.tsx:86,122` | "Terjadi kesalahan saat mengambil data" | Tidak ada langkah lanjut |
| `app/dashboard/kta/apply/page.tsx:256-260` | "ID Izin tidak valid. Pastikan ID Izin yang Anda masukkan benar." | Memberi tahu apa yang salah, tidak memberi tahu bentuk yang benar. Bandingkan dengan bantuan di `:797` yang menyebut "21 digit" |

Kontras dengan yang bagus: `login-form.tsx:53` — "Masih ada sesi aktif di perangkat lain. Silakan logout dari perangkat tersebut dulu, atau tunggu sampai idle 5 menit." Menyebut masalah, sebab, dan dua jalan keluar. Ini standar yang harus dipakai di tempat lain.

Istilah teknis yang bocor ke user:
- "Field" — `apply/page.tsx:1083`
- Enum mentah — `REJECTED` di `kta/[id]/page.tsx:472`; `IMPORTED_PENDING_DOCS` dan `DRAFT` akan bocor sama di halaman yang sama
- "jenjang" dipakai bergantian dengan "Kualifikasi" untuk data yang sama, sering dalam satu layar: `apply/page.tsx:865` ("Jenjang Info" di komentar) vs label `:1092` ("Kualifikasi") vs `lib/kta-upgrade.ts:240` ("jenjang 5")
- "SIKI" — singkatan yang tidak dijelaskan di mana pun. BPD baru mungkin tidak tahu itu Sistem Informasi Konstruksi Indonesia
- "backfill" — tidak muncul di UI, tapi konsepnya muncul sebagai "ikut dilengkapi dari SIKI" di `apply/page.tsx:1079` tanpa penjelasan

---

## Yang Sudah Bagus

Jangan ubah ini saat memperbaiki yang lain.

1. Empty state dashboard (`app/dashboard/page.tsx:620-633`). Icon, judul, penjelasan, tombol aksi. Ini pola terbaik di aplikasi dan harus jadi standar untuk halaman lain.
2. Empty state permohonan dengan penyebab spesifik (`permohonan/page.tsx:349-352`). "Anda belum di-assign ke daerah. Silakan hubungi administrator." Menyebut situasi dan tindakan.
3. Modal refresh SIKI (`kta/[id]/page.tsx:1090-1193`). Perbandingan lama dan baru, thumbnail foto, teks penjelas untuk dokumen yang bukan gambar. Keputusan sadar untuk tidak menampilkan URL SIKI yang panjang (komentar `:1111-1113`) — itu keputusan UX yang baik.
4. Pesan `ACTIVE_SESSION_EXISTS` (`login-form.tsx:53`). Spesifik, menyebut durasi, memberi dua opsi.
5. Detail state mobile pada sidebar — ESC, overlay klik, body scroll lock (`layout-client.tsx:565-596`). Sering dilupakan, di sini dikerjakan.
6. Label form yang benar di `apply/page.tsx` — semua `Label htmlFor` cocok dengan `input id`.
7. Loading skeleton bukan spinner di daftar (`kta/page.tsx:447-465`, `permohonan/page.tsx:370-385`) — mempertahankan layout, mengurangi lompatan.
8. Teks footer harga (`apply/page.tsx:1154`): "Harga berdasarkan jenjang: 1-6 = Rp 100.000, 7-9 = Rp 300.000". Aturan bisnis dinyatakan langsung ke user, bukan disembunyikan.
9. Peringatan `Alert` read-only (`apply/page.tsx:916-921`): "Data diambil dari SIKI. Data bersifat read-only dan tidak dapat diubah." Mencegah user frustrasi mencari cara mengedit.
10. Peringatan amber "Pembayaran dapat dilakukan setelah permohonan disimpan" (`apply/page.tsx:1158-1163`) — menjawab pertanyaan berikutnya sebelum ditanya.
11. Dashboard cache dengan batas waktu 5 menit (`dashboard/page.tsx:47-48,240-256`) — halaman terasa cepat saat dibuka ulang, dan cache dibuang saat kedaluwarsa.

---

## Prioritas Perbaikan

Urut dari paling murah tapi paling berdampak. "Murah" = jumlah baris yang berubah.

| # | Perbaikan | Lokasi | Dampak | Biaya | Kriteria |
|---|---|---|---|---|---|
| 1 | Hapus `text-slate-700` dan `text-slate-800` di kartu Nomor KTA, biarkan `text-white` | `kta/[id]/page.tsx:547,548` | Nomor KTA jadi terbaca (3.9:1 ke 8.7:1) | 2 baris | 1.4.3 |
| 2 | Tulis ulang pesan penolakan jadi 3 bagian, ganti "Field" jadi "Kolom" | `apply/page.tsx:1076-1084`, `lib/kta-upgrade.ts:240,258,276` | BPD paham kenapa ditolak dan harus ngapain; telepon ke pusat berkurang | sekitar 10 baris | Kejelasan |
| 3 | `role="alert"` pada semua kontainer error form | `apply/page.tsx:778,802`, `login-form.tsx:75,99,123`, `change-password/page.tsx:114,134,154` | Error terbaca screen reader | sekitar 8 baris | 4.1.3 |
| 4 | `aria-label` pada semua tombol ikon-saja | `kta/[id]/page.tsx:418-423,448-455,811-818,838-845,866-873,915-922` | Tombol bisa dipakai tanpa lihat | sekitar 12 baris | 4.1.2 |
| 5 | `overflow-hidden` jadi `overflow-x-auto` di tabel KTA | `kta/page.tsx:420` | Tabel bisa di-scroll di HP | 1 baris | Responsif |
| 6 | `flex-wrap` di action bar apply | `apply/page.tsx:1171` | Tombol utama tidak terpotong di HP | 1 baris | Responsif |
| 7 | `aria-sort` pada SortableHeader | `components/ui/sortable-header.tsx:27` | Screen reader tahu kolom terurut | 1 baris | 4.1.2 |
| 8 | `scope="col"` dan `caption` pada tabel | `kta/page.tsx:424-443`, `permohonan/page.tsx:358-366` | Struktur tabel terbaca | sekitar 10 baris | 1.3.1 |
| 9 | `focus-visible:opacity-100` pada tombol edit ber-`opacity-0` | `kta/[id]/page.tsx:451` plus 4 tempat | Fokus keyboard terlihat | 5 baris | 2.4.7 |
| 10 | Ganti semua `alert()` jadi `toast` | `kta/[id]/page.tsx:242,269,273`, `kta/page.tsx:236`, `layout-client.tsx:495,498` | Error konsisten, tidak memblokir | sekitar 20 baris | Konsistensi |
| 11 | Hapus checkbox "Ingat saya" atau implementasikan | `login-form.tsx:131-137` | Menghilangkan janji palsu | 6 baris | Kepercayaan |
| 12 | `green-600` jadi `green-700`, `amber-600` jadi `amber-800`, `emerald-600` jadi `emerald-700` | `kta/[id]/page.tsx:1150`, `:435,801,906`, `kta/page.tsx:325` | Lolos kontras AA | sekitar 6 baris | 1.4.3 |
| 13 | Tambah `REJECTED` dan alasan penolakan di detail KTA | `kta/[id]/page.tsx:464-473` | BPD tahu kenapa ditolak tanpa telepon | sekitar 25 baris | Kejelasan |
| 14 | Jadikan "Kosong - klik untuk isi" elemen `button` | `kta/[id]/page.tsx:431-440,797-805,901-910` | Field kosong bisa diisi via keyboard | sekitar 15 baris | 2.1.1 |
| 15 | Baris tabel jadi bisa keyboard | `kta/page.tsx:471`, `permohonan/page.tsx:388`, `dashboard/page.tsx:647` | Navigasi utama bisa keyboard | sekitar 20 baris | 2.1.1 |
| 16 | Satu modul label status bersama (`lib/status-label.ts`) | 3 file, 10 status | User lihat nama status yang sama di mana pun | sekitar 40 baris | Konsistensi |
| 17 | Tambah `h2`; CardTitle jadi heading yang benar | 4 halaman plus `card.tsx` | Struktur halaman terbaca | sekitar 30 baris | 1.3.1, 2.4.6 |
| 18 | Ikutkan `REJECTED` di filter status permohonan | `permohonan/page.tsx:313-317` | BPD bisa lihat daftar yang perlu ditindaklanjuti | 1 baris | Kejelasan |
| 19 | Label pada input date dan input alasan penolakan | `kta/page.tsx:307-319`, `layout-client.tsx:415-422` | Input punya nama aksesibel | sekitar 6 baris | 3.3.2 |
| 20 | Selaraskan tombol utama jadi satu gaya dan satu warna biru | 8 file | User belajar satu bahasa visual | sekitar 25 baris | Konsistensi |
| 21 | `aria-label` dan status teks pada antrian apply | `apply/page.tsx:586-607` | Antrian terbaca screen reader | sekitar 10 baris | 4.1.2, 4.1.3 |
| 22 | `grid-cols-3` jadi `grid-cols-1 sm:grid-cols-3` di ringkasan | `apply/page.tsx:625` | Ringkasan tidak sempit di HP | 1 kelas | Responsif |
| 23 | Perbaiki `bg-Gatensi-blue` (hapus atau definisikan) | `dashboard/page.tsx:654` | Avatar inisial punya latar | 1 baris | Bug |
| 24 | Perbaiki typo backslash di teks sapaan header | `layout-client.tsx:720` | Menghilangkan karakter nyasar di header | 1 karakter | Bug |
| 25 | Perbaiki pesan error rusak dan string Inggris di halaman print | `print/page.tsx:49,52` | Error bisa dipahami | 2 baris | Bahasa |

Catatan penutup. Tiga hal teratas (nomor 1, 2, 3) berjumlah di bawah 25 baris perubahan dan menyelesaikan masalah yang paling mahal: nomor KTA yang tidak terbaca, user yang tidak paham kenapa ditolak, dan error yang tidak terdengar screen reader. Kerjakan itu lebih dulu sebelum menyentuh apa pun yang lain.

---

## Status Pengerjaan — 28 September 2026

Ngomong-ngomong soal "tiga hal teratas": nomor 1, 2, dan 3 **sudah dikerjakan**, plus beberapa item murah lain. Ini yang sudah masuk:

| # | Perbaikan | Status | Catatan |
|---|---|---|---|
| 1 | Nomor KTA terbaca | **Beres** | `text-slate-700`/`text-slate-800` diganti `text-blue-100`/`text-white` di kartu berlatar biru |
| 2 | Pesan penolakan dijelaskan | **Sebagian** | Istilah "Field" diganti "Kolom"; tombol "Simpan Permohonan" yang disabled sekarang punya `title` yang menjelaskan alasannya. Teks `reason` di `lib/kta-upgrade.ts` belum ditulis ulang jadi tiga bagian |
| 5 | `overflow-hidden` → `overflow-x-auto` | **Beres** | Tabel KTA bisa di-scroll di HP |
| 7 | `aria-sort` pada SortableHeader | **Beres** | Cuma diisi di kolom yang benar-benar terurut |
| 10 | `alert()` → `toast` | **Sebagian** | `kta/page.tsx:236` sudah pakai `toast`. Sisanya (`kta/[id]/page.tsx`, `layout-client.tsx`) belum — 2 file, sekitar 15 pemanggilan |

Yang **belum** dikerjakan dari daftar ini: item 3, 4, 6, 8, 9, 11–25. Item 3 (`role="alert"`) dan 4 (`aria-label` tombol ikon) paling layak dikerjakan berikutnya — keduanya di bawah 15 baris dan langsung menutup pelanggaran WCAG level A.

---

## Sumber

Yang terbesar dan paling mahal bukan salah satu item di tabel: halaman apply (`apply/page.tsx`, 1394 baris) menangani tiga tugas sekaligus — pencarian, antrian batch, dan peninjauan kelayakan — dalam satu file dengan 12 blok kondisional. Setiap tambahan fitur ke depan akan makin sulit. Tapi memecahnya jadi beberapa komponen itu pekerjaan tersendiri, bukan bagian dari perbaikan cepat, dan sebaiknya dilakukan setelah pesan error dan aksesibilitas dasar beres.

---

## Sumber

- W3C, Web Content Accessibility Guidelines (WCAG) 2.2, W3C Recommendation. Kriteria yang dirujuk: 1.1.1, 1.3.1, 1.4.1, 1.4.3, 2.1.1, 2.4.6, 2.4.7, 2.4.11, 3.3.2, 4.1.2, 4.1.3. Tersedia di https://www.w3.org/TR/WCAG22/
- Nielsen Norman Group, Error-Message Guidelines. https://www.nngroup.com/articles/error-message-guidelines/ — dasar rekomendasi "sebutkan masalah, jelaskan, tawarkan jalan keluar", pertahankan input user agar bisa diedit bukan diulang dari nol, dan pakai bahasa manusia bukan jargon teknis.
