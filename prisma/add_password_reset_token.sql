-- Token lupa password (fitur "Lupa password?" di halaman login).
-- Yang disimpan cuma hash-nya; token mentah cuma ada di link email.
--
-- MySQL, bukan PostgreSQL. Bedanya dari versi sebelumnya:
--   * `TEXT` -> VARCHAR(191). MySQL nggak bisa bikin PRIMARY KEY / UNIQUE INDEX
--     di atas TEXT tanpa panjang kunci; Prisma sendiri map String ke VARCHAR(191).
--   * TIMESTAMP(3) -> DATETIME(3), ini yang dipakai Prisma buat DateTime di MySQL.
--   * Identifier pakai backtick, bukan kutip ganda.
--   * Tabelnya di-create TANPA charset/collation eksplisit — ikut default
--     database. Ini KELIHATAN aman tapi ternyata nggak: tabel-tabel lama di
--     database ini dibikin dengan `COLLATE utf8mb4_unicode_ci` eksplisit,
--     sementara default database-nya beda (MySQL 8 = utf8mb4_0900_ai_ci). Jadi
--     `password_reset_tokens`.`userId` nggak sekolasi dengan `users`.`id` dan
--     MySQL nolak FK-nya: error 3780 "Referencing column and referenced column
--     in foreign key constraint are incompatible".
--
--     Yang nyelesain `scripts/migrate.ts`: sebelum bikin FK, kolom anaknya
--     disamain dulu ke definisi kolom induk hasil baca information_schema.
--     Ditulis di SQL nggak bisa, karena collation-nya harus dibaca dari
--     database dulu, bukan ditulis mati di file.
--
-- DDL-nya polos tanpa penjaga: MySQL nggak punya `CREATE INDEX IF NOT EXISTS`
-- (itu cuma ada di MariaDB). Idempotency-nya di `scripts/migrate.ts` — perintah
-- yang gagal dengan kode "sudah ada" (1050 tabel / 1061 index / 1826 nama FK)
-- dihitung skip. Jalanin lewat `npm run db:migrate`.

CREATE TABLE `password_reset_tokens` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3)  NOT NULL,
  `usedAt`    DATETIME(3)  NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
);

-- Satu hash cuma boleh muncul sekali.
CREATE UNIQUE INDEX `password_reset_tokens_tokenHash_key`
  ON `password_reset_tokens` (`tokenHash`);

-- Index buat kolom foreign key. MySQL bikin ini otomatis kalau kurang, tapi
-- namanya nggak bakal sesuai nama yang dipakai Prisma — jadi dibikin eksplisit.
CREATE INDEX `password_reset_tokens_userId_fkey`
  ON `password_reset_tokens` (`userId`);

-- Hapus user -> token-nya ikut kehapus.
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
