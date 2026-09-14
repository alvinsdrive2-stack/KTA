-- Snapshot harga invoice.
--
-- Masalah yang dibetulin: PDF/Excel/halaman invoice menghitung ulang total dari
-- `daerah`.`diskonPersen` dan `kta_requests`.`hargaFinal` yang dibaca saat itu
-- juga. Kalau diskon daerah berubah setelah invoice terbit, angka di invoice
-- ikut berubah — padahal `bulk_payments`.`totalNominal` dan `payments`.`jumlah`
-- sudah nyimpen nominal yang benar sejak invoice dibuat.
--
-- Kolom di bawah nyimpen angka harga saat invoice dibuat, biar invoice jadi
-- catatan tetap. Semua NULLABLE dan tanpa backfill: invoice lama biarin apa
-- adanya, nanti dihitung dari selisih totalNominal vs harga dasar.
--
-- MySQL. Jalanin lewat `npm run db:migrate` — idempotency-nya di runner, bukan
-- di sini (MySQL nggak punya `ADD COLUMN IF NOT EXISTS`).
-- Manual + kolomnya udah ada = error 1060, artinya udah pernah jalan.

ALTER TABLE `bulk_payments` ADD COLUMN `totalHargaBase` INT NULL;
ALTER TABLE `bulk_payments` ADD COLUMN `diskonPersen` INT NULL;
ALTER TABLE `payments`      ADD COLUMN `hargaBaseSnapshot` INT NULL;
