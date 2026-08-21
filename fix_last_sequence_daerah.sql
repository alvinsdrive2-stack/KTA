-- ============================================================
-- UPDATE LAST SEQUENCE KTA PER DAERAH
-- Sumber: "nomor kta terakhir.docx"
-- Tabel: daerah (match by kodePropinsi)
-- Format nomor: XX.YY.ZZZZZZ
--   XX = kode provinsi, YY = 01 Ahli / 02 Teknisi / 03 Operator
-- ============================================================
-- Aturan update: hanya naik, tidak pernah turun.
-- Kolom di-update hanya jika nilai baru LEBIH BESAR dari nilai
-- existing (GREATEST). Baris dilewati jika semua nilai baru
-- sama atau lebih kecil (clause WHERE).
-- ============================================================
-- Catatan koreksi typo dari dokumen sumber:
--   Lampung            : label Ahli/Teknisi tertukar, diperbaiki
--                        berdasarkan segmen kode (18.01=Ahli=24,
--                        18.02=Teknisi=67)
--   Kalsel Operator    : tertulis 63.02.000001 -> sequence = 1
--   Papua Operator     : tertulis 94.02.000000 -> sequence = 0
--   Maluku, Sulbar,    : belum ada nomor terpakai (00) -> tidak
--   Sulut, PBD           di-update di sini
-- ============================================================

START TRANSACTION;

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 79),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 137),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '11' -- Aceh
  AND (lastSequenceAhli < 79 OR lastSequenceTeknisi < 137);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 4),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 35),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '15' -- Jambi
  AND (lastSequenceAhli < 4 OR lastSequenceTeknisi < 35);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 32),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 129),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '13' -- Sumatera Barat
  AND (lastSequenceAhli < 32 OR lastSequenceTeknisi < 129);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 156),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 726),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 13)
WHERE kodePropinsi = '16' -- Sumatera Selatan
  AND (lastSequenceAhli < 156 OR lastSequenceTeknisi < 726 OR lastSequenceOperator < 13);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 24),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 67),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 15)
WHERE kodePropinsi = '18' -- Lampung
  AND (lastSequenceAhli < 24 OR lastSequenceTeknisi < 67 OR lastSequenceOperator < 15);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 75),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 161),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 37)
WHERE kodePropinsi = '19' -- Bangka Belitung
  AND (lastSequenceAhli < 75 OR lastSequenceTeknisi < 161 OR lastSequenceOperator < 37);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 46),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 253),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 1)
WHERE kodePropinsi = '21' -- Kepri
  AND (lastSequenceAhli < 46 OR lastSequenceTeknisi < 253 OR lastSequenceOperator < 1);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 246),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 438),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 30)
WHERE kodePropinsi = '31' -- DKI Jakarta
  AND (lastSequenceAhli < 246 OR lastSequenceTeknisi < 438 OR lastSequenceOperator < 30);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 262),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 925),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 65)
WHERE kodePropinsi = '32' -- Jawa Barat
  AND (lastSequenceAhli < 262 OR lastSequenceTeknisi < 925 OR lastSequenceOperator < 65);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 409),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 1447),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 16)
WHERE kodePropinsi = '33' -- Jawa Tengah
  AND (lastSequenceAhli < 409 OR lastSequenceTeknisi < 1447 OR lastSequenceOperator < 16);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 35),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 194),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 3)
WHERE kodePropinsi = '34' -- DI Yogyakarta
  AND (lastSequenceAhli < 35 OR lastSequenceTeknisi < 194 OR lastSequenceOperator < 3);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 208),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 1334),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 33)
WHERE kodePropinsi = '35' -- Jawa Timur
  AND (lastSequenceAhli < 208 OR lastSequenceTeknisi < 1334 OR lastSequenceOperator < 33);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 44),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 267),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 12)
WHERE kodePropinsi = '36' -- Banten
  AND (lastSequenceAhli < 44 OR lastSequenceTeknisi < 267 OR lastSequenceOperator < 12);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 139),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 860),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '52' -- NTB
  AND (lastSequenceAhli < 139 OR lastSequenceTeknisi < 860);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 175),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 312),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 5)
WHERE kodePropinsi = '53' -- NTT
  AND (lastSequenceAhli < 175 OR lastSequenceTeknisi < 312 OR lastSequenceOperator < 5);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 46),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 621),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 15)
WHERE kodePropinsi = '61' -- Kalimantan Barat
  AND (lastSequenceAhli < 46 OR lastSequenceTeknisi < 621 OR lastSequenceOperator < 15);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 0),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 8),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 4)
WHERE kodePropinsi = '62' -- Kalimantan Tengah
  AND (lastSequenceTeknisi < 8 OR lastSequenceOperator < 4);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 220),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 285),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 1)
WHERE kodePropinsi = '63' -- Kalimantan Selatan
  AND (lastSequenceAhli < 220 OR lastSequenceTeknisi < 285 OR lastSequenceOperator < 1);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 203),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 986),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '64' -- Kalimantan Timur
  AND (lastSequenceAhli < 203 OR lastSequenceTeknisi < 986);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 29),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 108),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '72' -- Sulawesi Tengah
  AND (lastSequenceAhli < 29 OR lastSequenceTeknisi < 108);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 183),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 382),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 1)
WHERE kodePropinsi = '73' -- Sulawesi Selatan
  AND (lastSequenceAhli < 183 OR lastSequenceTeknisi < 382 OR lastSequenceOperator < 1);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 0),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 4),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '75' -- Gorontalo
  AND lastSequenceTeknisi < 4;

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 142),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 592),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 72)
WHERE kodePropinsi = '51' -- Bali
  AND (lastSequenceAhli < 142 OR lastSequenceTeknisi < 592 OR lastSequenceOperator < 72);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 37),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 356),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '91' -- Papua Barat
  AND (lastSequenceAhli < 37 OR lastSequenceTeknisi < 356);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 30),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 264),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE kodePropinsi = '94' -- Papua
  AND (lastSequenceAhli < 30 OR lastSequenceTeknisi < 264);

UPDATE daerah
SET lastSequenceAhli    = GREATEST(lastSequenceAhli, 2328),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 2886),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 558)
WHERE kodePropinsi = '00' -- Pusat
  AND (lastSequenceAhli < 2328 OR lastSequenceTeknisi < 2886 OR lastSequenceOperator < 558);

-- Verifikasi
SELECT '[VERIFIKASI LAST SEQUENCE]' AS info;
SELECT namaDaerah, kodeDaerah, kodePropinsi,
       lastSequenceAhli, lastSequenceTeknisi, lastSequenceOperator
FROM daerah
WHERE kodePropinsi IN ('00','11','13','15','16','18','19','21','31','32','33','34','35','36',
                       '51','52','53','61','62','63','64','72','73','75','91','94')
ORDER BY kodePropinsi;

-- ============================================================
-- Uncomment untuk eksekusi
-- ============================================================
COMMIT;
