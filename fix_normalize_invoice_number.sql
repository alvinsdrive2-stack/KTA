-- Normalisasi invoice number: ganti slash (/) jadi dash (-)
-- Kenapa: Midtrans order_id cuma terima alphanumeric + - _ ~ .
-- Invoice lama masih "INV/KTA-BPP/2026/08.004", order_id Midtrans sudah disanitize jadi "INV-KTA-BPP-2026-08.004-<timestamp>"
-- Biar webhook notification bisa match order_id ke invoice number di DB.
-- Catatan: jalanin ini SEBELUM bikin invoice baru / deploy, biar urutan sequence nggak bentrok.

-- 1. Cek dulu berapa baris yang kena (opsional)
SELECT COUNT(*) AS bulk_kontrak FROM bulk_payments WHERE invoiceNumber LIKE '%/%';
SELECT COUNT(*) AS payment_kontrak FROM payments WHERE invoiceNumber LIKE '%/%';

-- 2. Update bulk_payments (invoiceNumber unik - kalau ada konflik unique di sini, berhenti & lapor)
UPDATE bulk_payments SET invoiceNumber = REPLACE(invoiceNumber, '/', '-') WHERE invoiceNumber LIKE '%/%';

-- 3. Update payments (ikut konsisten biar tampilan sama)
UPDATE payments SET invoiceNumber = REPLACE(invoiceNumber, '/', '-') WHERE invoiceNumber LIKE '%/%';
