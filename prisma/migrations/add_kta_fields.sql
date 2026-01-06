-- Add missing fields to KTARequest model
ALTER TABLE "KTARequest"
ADD COLUMN "ktpUrl" TEXT,
ADD COLUMN "fotoUrl" TEXT,
ADD COLUMN "qrCodeUrl" TEXT,
ADD COLUMN "kartuGeneratedPath" TEXT;