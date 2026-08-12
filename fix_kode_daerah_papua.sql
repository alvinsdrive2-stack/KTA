-- ============================================================
-- FIX KODE DAERAH PAPUA FINAL
-- Database: gatensi_kta
-- ============================================================
-- Koreksi kode daerah & nomorKTA
-- ============================================================
-- | Daerah           | Kode DB | -> Fix |
-- | Papua            |      92 |     94 |
-- | Papua Selatan    |      93 |     95 |
-- | Papua Tengah     |      94 |     96 |
-- | Papua Pegunungan |      95 |     97 |
-- | Papua Barat Daya |      96 |     92 |
-- ============================================================
-- Efek: 271 nomorKTA prefix 92. -> 94. untuk Papua
-- ============================================================

START TRANSACTION;

-- ============================================================
-- PHASE 1: Set kode sementara (hindari conflict UNIQUE)
-- ============================================================
UPDATE daerah SET kodeDaerah = '198' WHERE id = 'cmjh0b06w000w1hesd0gi430q' AND namaDaerah = 'Papua';
UPDATE daerah SET kodeDaerah = '199' WHERE id = 'cmjh0b08z000z1hesb5gxh9hc' AND namaDaerah = 'Papua Selatan';
UPDATE daerah SET kodeDaerah = '200' WHERE id = 'cmjh0b09o00101hes9wyple8z' AND namaDaerah = 'Papua Tengah';
UPDATE daerah SET kodeDaerah = '201' WHERE id = 'cmjh0b0ae00111hes9xsxkb3y' AND namaDaerah = 'Papua Pegunungan';
UPDATE daerah SET kodeDaerah = '202' WHERE id = 'cmjh0b0b600121hes3nuqwiwp' AND namaDaerah = 'Papua Barat Daya';

-- ============================================================
-- PHASE 2: Set kode benar
-- ============================================================
UPDATE daerah SET kodeDaerah = '94' WHERE id = 'cmjh0b06w000w1hesd0gi430q' AND namaDaerah = 'Papua';
UPDATE daerah SET kodeDaerah = '95' WHERE id = 'cmjh0b08z000z1hesb5gxh9hc' AND namaDaerah = 'Papua Selatan';
UPDATE daerah SET kodeDaerah = '96' WHERE id = 'cmjh0b09o00101hes9wyple8z' AND namaDaerah = 'Papua Tengah';
UPDATE daerah SET kodeDaerah = '97' WHERE id = 'cmjh0b0ae00111hes9xsxkb3y' AND namaDaerah = 'Papua Pegunungan';
UPDATE daerah SET kodeDaerah = '92' WHERE id = 'cmjh0b0b600121hes3nuqwiwp' AND namaDaerah = 'Papua Barat Daya';

-- ============================================================
-- 3. Fix nomorKTA Papua: 92.xxx -> 94.xxx (271 baris)
-- ============================================================
UPDATE kta_requests
SET nomorKTA = CONCAT('94', SUBSTRING(nomorKTA, 3))
WHERE daerahId = 'cmjh0b06w000w1hesd0gi430q'
  AND nomorKTA LIKE '92.%';

-- ============================================================
-- 4. Verifikasi
-- ============================================================
SELECT '[DAERAH]' as info;
SELECT id, namaDaerah, kodeDaerah FROM daerah
WHERE id IN (
  'cmjh0b06w000w1hesd0gi430q',
  'cmjh0b08z000z1hesb5gxh9hc',
  'cmjh0b09o00101hes9wyple8z',
  'cmjh0b0ae00111hes9xsxkb3y',
  'cmjh0b0b600121hes3nuqwiwp'
);

SELECT '[NOMOR KTA SAMPLE]' as info;
SELECT nomorKTA, nama FROM kta_requests
WHERE daerahId = 'cmjh0b06w000w1hesd0gi430q'
LIMIT 10;

SELECT '[STATISTIK]' as info;
SELECT d.namaDaerah, d.kodeDaerah, COUNT(kr.id) AS total_kta
FROM daerah d
LEFT JOIN kta_requests kr ON kr.daerahId = d.id
WHERE d.id IN (
  'cmjh0b06w000w1hesd0gi430q',
  'cmjh0b08z000z1hesb5gxh9hc',
  'cmjh0b09o00101hes9wyple8z',
  'cmjh0b0ae00111hes9xsxkb3y',
  'cmjh0b0b600121hes3nuqwiwp'
)
GROUP BY d.id, d.namaDaerah, d.kodeDaerah;

-- ============================================================
-- Uncomment untuk eksekusi
-- ============================================================
-- COMMIT;
