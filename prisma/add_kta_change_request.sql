-- Permohonan perubahan data KTA (diajukan BPP, dikonfirmasi Keuangan).
-- Satu baris = satu field. Nama fieldnya divalidasi di route terhadap whitelist
-- di lib/kta-change-request.ts, bukan input bebas.
--
-- MySQL. Catatan yang berlaku buat semua file di folder ini:
--   * `TEXT` -> VARCHAR(191) buat kolom yang jadi PRIMARY KEY / UNIQUE INDEX.
--     Prisma map String ke VARCHAR(191), dan VARCHAR(191) aman buat index
--     utf8mb4 (191 * 4 byte = 764, di bawah batas 767 byte InnoDB).
--   * `oldValue`, `newValue`, `reason`, `sikiValue`, `catatan`, `appliedResult`
--     di schema pakai @db.Text -> TEXT.
--   * DATETIME(3), bukan TIMESTAMP(3) — ini yang dipakai Prisma buat DateTime
--     di MySQL.
--   * Tabel di-create TANPA charset/collation eksplisit, jadi ikut default
--     database. Kalau default-nya beda dari tabel `users`, FK-nya bakal ditolak
--     MySQL dengan error 3780 "Referencing column and referenced column in
--     foreign key constraint are incompatible". Yang beresin itu
--     scripts/migrate.ts: kolom anaknya disamain dulu ke definisi kolom induk
--     hasil baca information_schema, sebelum FK-nya dibikin.
--
-- DDL polos tanpa penjaga — MySQL nggak punya `CREATE INDEX IF NOT EXISTS`.
-- Idempotency-nya di scripts/migrate.ts. Jalanin lewat `npm run db:migrate`.
--
-- PENTING buat file ini: pecahPerintah() di scripts/migrate.ts motong isi file
-- per titik-koma, dan nggak paham titik-koma di dalam string. Jadi jangan
-- nulis string berisi `;` di sini — nanti perintahnya kepotong di tengah.
-- Komentar harus `--` di awal baris.

CREATE TABLE `kta_change_requests` (
  `id`            VARCHAR(191) NOT NULL,
  `ktaRequestId`  VARCHAR(191) NOT NULL,
  `requestedBy`   VARCHAR(191) NOT NULL,
  `fieldName`     VARCHAR(191) NOT NULL,
  `oldValue`      TEXT         NULL,
  `newValue`      TEXT         NOT NULL,
  `reason`        TEXT         NOT NULL,
  `buktiUrl`      VARCHAR(191) NOT NULL,
  `idIzinInput`   VARCHAR(191) NULL,
  `sikiValue`     TEXT         NULL,
  `status`        ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewedBy`    VARCHAR(191) NULL,
  `reviewedAt`    DATETIME(3)  NULL,
  `catatan`       TEXT         NULL,
  `appliedAt`     DATETIME(3)  NULL,
  `appliedResult` TEXT         NULL,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`)
);

-- Index buat kolom foreign key. MySQL bikin ini otomatis kalau kurang, tapi
-- namanya nggak bakal sesuai nama yang dipakai Prisma — jadi dibikin eksplisit.
CREATE INDEX `kta_change_requests_ktaRequestId_fkey`
  ON `kta_change_requests` (`ktaRequestId`);

CREATE INDEX `kta_change_requests_requestedBy_fkey`
  ON `kta_change_requests` (`requestedBy`);

CREATE INDEX `kta_change_requests_reviewedBy_fkey`
  ON `kta_change_requests` (`reviewedBy`);

-- Halaman konfirmasi Keuangan nyaring per status — ini yang paling sering dipakai.
CREATE INDEX `kta_change_requests_status_idx`
  ON `kta_change_requests` (`status`);

-- Hapus KTA -> permohonan perubahannya ikut kehapus.
ALTER TABLE `kta_change_requests`
  ADD CONSTRAINT `kta_change_requests_ktaRequestId_fkey`
  FOREIGN KEY (`ktaRequestId`) REFERENCES `kta_requests`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Pemohon (BPP) dan pemeriksa (Keuangan) nggak boleh dihapus selama riwayatnya
-- masih ada — RESTRICT, bukan CASCADE. Sengaja: permohonan yang sudah diputus
-- itu jejak audit, dan penghapusan user nggak boleh ngikut ngapus jejaknya.
ALTER TABLE `kta_change_requests`
  ADD CONSTRAINT `kta_change_requests_requestedBy_fkey`
  FOREIGN KEY (`requestedBy`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `kta_change_requests`
  ADD CONSTRAINT `kta_change_requests_reviewedBy_fkey`
  FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
