-- Snapshot harga invoice.
--
-- Masalah yang dibetulin: PDF/Excel/halaman invoice menghitung ulang total dari
-- "daerah"."diskonPersen" dan "kta_requests"."hargaFinal" yang dibaca saat itu
-- juga. Kalau diskon daerah berubah setelah invoice terbit, angka di invoice
-- ikut berubah — padahal "bulk_payments"."totalNominal" dan "payments"."jumlah"
-- sudah nyimpen nominal yang benar sejak invoice dibuat.
--
-- Kolom di bawah nyimpen angka harga saat invoice dibuat, biar invoice jadi
-- catatan tetap. Semua NULLABLE dan tanpa backfill: invoice lama biarin apa
-- adanya, nanti dihitung dari selisih totalNominal vs harga dasar.
--
-- Aman dijalanin berulang kali (IF NOT EXISTS).

ALTER TABLE "bulk_payments" ADD COLUMN IF NOT EXISTS "totalHargaBase" INTEGER;
ALTER TABLE "bulk_payments" ADD COLUMN IF NOT EXISTS "diskonPersen" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "hargaBaseSnapshot" INTEGER;
