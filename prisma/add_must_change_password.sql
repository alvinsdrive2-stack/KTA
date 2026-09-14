-- Wajib ganti password saat login pertama.
-- default false: user yang sudah ada TIDAK dipaksa ganti.
--
-- MySQL. Jalanin lewat `npm run db:migrate`.
--
-- DDL-nya sengaja polos, tanpa penjaga "kalau belum ada": MySQL nggak punya
-- `ADD COLUMN IF NOT EXISTS` (itu cuma ada di MariaDB), dan `PREPARE`/`EXECUTE`
-- nggak bisa dipakai karena runner ngirim per-perintah di koneksi yang beda-beda.
-- Yang ngurus idempotency itu `scripts/migrate.ts` — perintah yang gagal dengan
-- kode "sudah ada" dihitung skip, bukan error.
--
-- Kalau dijalanin manual dan kolomnya udah ada, error-nya 1060
-- "Duplicate column name". Itu artinya migrasinya udah pernah jalan, bukan gagal.

ALTER TABLE `users`
  ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;
