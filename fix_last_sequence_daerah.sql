-- ============================================================
-- UPDATE LAST SEQUENCE KTA PER DAERAH
-- Sumber: "nomor kta terakhir.docx" (diekstrak dari word/document.xml)
-- Tabel: daerah (match kodeDaerah ATAU kodePropinsi)
-- Format nomor: XX.YY.ZZZZZZ
--   XX = kode provinsi, YY = 01 Ahli / 02 Teknisi / 03 Operator
-- ============================================================
-- Aturan update: hanya naik, tidak pernah turun.
-- Kolom di-update hanya jika nilai baru LEBIH BESAR dari nilai
-- existing (GREATEST). Baris dilewati jika semua nilai baru
-- sama atau lebih kecil (clause WHERE).
-- ============================================================
-- Anomali di doc (angka tetap dipakai, lihat scripts/setup-kta-sequences.ts):
--   Lampung (18)  : Ahli tertulis 18.02.000067 (segmen .02) -> Ahli=67
--   NTB (52)      : Teknisi tertulis "52.02.0008 60" kepotong -> 860
--   Kalsel (63)   : Operator tertulis 63.02.000001 (segmen .02) -> 1
--   Papua (94)    : Operator tertulis 94.02.000000 -> 0
--   Kaltim (64), Sulteng (72), PBD (92): Operator "00" -> 0, tidak ngubah
--   Maluku (81), Sulbar (76), Sulut (71): semua "00" -> tidak ada di sini
-- Kode Papua ikut fix_kode_daerah_papua.sql: Papua=94, Papua Barat=91,
--   Papua Barat Daya=92. Pusat baris kode '00', nomor prefix 99.x.
-- ============================================================

START TRANSACTION;

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 86),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 137),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '11' OR kodePropinsi = '11') -- Aceh
  AND (lastSequenceAhli < 86 OR lastSequenceTeknisi < 137);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 4),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 36),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '15' OR kodePropinsi = '15') -- Jambi
  AND (lastSequenceAhli < 4 OR lastSequenceTeknisi < 36);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 33),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 130),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '13' OR kodePropinsi = '13') -- Sumatera Barat
  AND (lastSequenceAhli < 33 OR lastSequenceTeknisi < 130);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 156),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 731),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 13)
WHERE (kodeDaerah = '16' OR kodePropinsi = '16') -- Sumatera Selatan
  AND (lastSequenceAhli < 156 OR lastSequenceTeknisi < 731 OR lastSequenceOperator < 13);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 67),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 68),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 15)
WHERE (kodeDaerah = '18' OR kodePropinsi = '18') -- Lampung
  AND (lastSequenceAhli < 67 OR lastSequenceTeknisi < 68 OR lastSequenceOperator < 15);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 76),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 163),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 37)
WHERE (kodeDaerah = '19' OR kodePropinsi = '19') -- Bangka Belitung
  AND (lastSequenceAhli < 76 OR lastSequenceTeknisi < 163 OR lastSequenceOperator < 37);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 47),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 254),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 1)
WHERE (kodeDaerah = '21' OR kodePropinsi = '21') -- Kepri
  AND (lastSequenceAhli < 47 OR lastSequenceTeknisi < 254 OR lastSequenceOperator < 1);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 253),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 442),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 30)
WHERE (kodeDaerah = '31' OR kodePropinsi = '31') -- DKI Jakarta
  AND (lastSequenceAhli < 253 OR lastSequenceTeknisi < 442 OR lastSequenceOperator < 30);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 263),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 925),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 65)
WHERE (kodeDaerah = '32' OR kodePropinsi = '32') -- Jawa Barat
  AND (lastSequenceAhli < 263 OR lastSequenceTeknisi < 925 OR lastSequenceOperator < 65);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 409),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 1460),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 16)
WHERE (kodeDaerah = '33' OR kodePropinsi = '33') -- Jawa Tengah
  AND (lastSequenceAhli < 409 OR lastSequenceTeknisi < 1460 OR lastSequenceOperator < 16);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 35),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 194),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 3)
WHERE (kodeDaerah = '34' OR kodePropinsi = '34') -- DI Yogyakarta
  AND (lastSequenceAhli < 35 OR lastSequenceTeknisi < 194 OR lastSequenceOperator < 3);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 213),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 1374),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 33)
WHERE (kodeDaerah = '35' OR kodePropinsi = '35') -- Jawa Timur
  AND (lastSequenceAhli < 213 OR lastSequenceTeknisi < 1374 OR lastSequenceOperator < 33);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 45),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 267),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 12)
WHERE (kodeDaerah = '36' OR kodePropinsi = '36') -- Banten
  AND (lastSequenceAhli < 45 OR lastSequenceTeknisi < 267 OR lastSequenceOperator < 12);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 141),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 860),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '52' OR kodePropinsi = '52') -- NTB
  AND (lastSequenceAhli < 141 OR lastSequenceTeknisi < 860);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 177),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 312),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 5)
WHERE (kodeDaerah = '53' OR kodePropinsi = '53') -- NTT
  AND (lastSequenceAhli < 177 OR lastSequenceTeknisi < 312 OR lastSequenceOperator < 5);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 117),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 639),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 15)
WHERE (kodeDaerah = '61' OR kodePropinsi = '61') -- Kalimantan Barat
  AND (lastSequenceAhli < 117 OR lastSequenceTeknisi < 639 OR lastSequenceOperator < 15);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 0),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 8),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 4)
WHERE (kodeDaerah = '62' OR kodePropinsi = '62') -- Kalimantan Tengah
  AND (lastSequenceTeknisi < 8 OR lastSequenceOperator < 4);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 220),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 285),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 1)
WHERE (kodeDaerah = '63' OR kodePropinsi = '63') -- Kalimantan Selatan
  AND (lastSequenceAhli < 220 OR lastSequenceTeknisi < 285 OR lastSequenceOperator < 1);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 203),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 986),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '64' OR kodePropinsi = '64') -- Kalimantan Timur
  AND (lastSequenceAhli < 203 OR lastSequenceTeknisi < 986);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 29),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 108),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '72' OR kodePropinsi = '72') -- Sulawesi Tengah
  AND (lastSequenceAhli < 29 OR lastSequenceTeknisi < 108);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 183),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 382),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 1)
WHERE (kodeDaerah = '73' OR kodePropinsi = '73') -- Sulawesi Selatan
  AND (lastSequenceAhli < 183 OR lastSequenceTeknisi < 382 OR lastSequenceOperator < 1);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 0),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 4),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '75' OR kodePropinsi = '75') -- Gorontalo
  AND lastSequenceTeknisi < 4;

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 144),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 595),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 72)
WHERE (kodeDaerah = '51' OR kodePropinsi = '51') -- Bali
  AND (lastSequenceAhli < 144 OR lastSequenceTeknisi < 595 OR lastSequenceOperator < 72);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 37),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 356),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '91' OR kodePropinsi = '91') -- Papua Barat
  AND (lastSequenceAhli < 37 OR lastSequenceTeknisi < 356);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 35),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 270),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '94' OR kodePropinsi = '94') -- Papua
  AND (lastSequenceAhli < 35 OR lastSequenceTeknisi < 270);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 1),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 3),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 0)
WHERE (kodeDaerah = '92' OR kodePropinsi = '92') -- Papua Barat Daya
  AND (lastSequenceAhli < 1 OR lastSequenceTeknisi < 3);

UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 2391),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 2963),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 564)
WHERE (kodeDaerah = '00' OR kodePropinsi = '00') -- Pusat (nomor prefix 99.x)
  AND (lastSequenceAhli < 2391 OR lastSequenceTeknisi < 2963 OR lastSequenceOperator < 564);

-- K3 (98.x): jalan hanya kalau baris 98 udah ada di tabel daerah,
-- kalau affected rows = 0 berarti belum ada — bikin manual dulu.
UPDATE daerah
SET lastSequenceAhli = GREATEST(lastSequenceAhli, 11),
    lastSequenceTeknisi = GREATEST(lastSequenceTeknisi, 6),
    lastSequenceOperator = GREATEST(lastSequenceOperator, 56)
WHERE (kodeDaerah = '98' OR kodePropinsi = '98') -- K3
  AND (lastSequenceAhli < 11 OR lastSequenceTeknisi < 6 OR lastSequenceOperator < 56);

-- Verifikasi (jalanin sebelum COMMIT)
SELECT '[VERIFIKASI LAST SEQUENCE]' AS info;
SELECT namaDaerah, kodeDaerah, kodePropinsi,
       lastSequenceAhli, lastSequenceTeknisi, lastSequenceOperator
FROM daerah
WHERE kodeDaerah IN ('00','11','13','15','16','18','19','21','31','32','33','34','35','36',
                     '51','52','53','61','62','63','64','72','73','75','91','92','94','98')
   OR kodePropinsi IN ('00','11','13','15','16','18','19','21','31','32','33','34','35','36',
                     '51','52','53','61','62','63','64','72','73','75','91','92','94','98')
ORDER BY kodeDaerah;

-- Kalau verifikasi oke: COMMIT; kalau ada yang aneh: ROLLBACK;
COMMIT;
