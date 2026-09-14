-- Wajib ganti password saat login pertama.
-- default false: user yang sudah ada TIDAK dipaksa ganti.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
