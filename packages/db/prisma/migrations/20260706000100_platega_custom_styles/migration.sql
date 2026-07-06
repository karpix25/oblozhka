-- Add payment/provider and custom style enums.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CHARGEBACKED';

CREATE TYPE "PaymentProvider" AS ENUM ('PLATEGA');
CREATE TYPE "StyleSource" AS ENUM ('LIBRARY_TEMPLATE', 'USER_STYLE');
CREATE TYPE "UserStyleAssetStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'READY', 'REJECTED', 'FAILED');

-- Rename Stars-centric pricing/payment columns to RUB/Platega-friendly names.
ALTER TABLE "CreditPackage" RENAME COLUMN "starsPrice" TO "priceRub";
ALTER TABLE "Payment" RENAME COLUMN "starsAmount" TO "amountRub";

-- Move generic provider charge id into the Platega transaction id column when present.
ALTER TABLE "Payment" RENAME COLUMN "providerPaymentChargeId" TO "providerTransactionId";

-- Drop old Telegram charge id unique constraint/column if it exists.
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "telegramPaymentChargeId";

ALTER TABLE "Payment"
  ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'PLATEGA',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB',
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "paymentUrl" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3);

-- The previous providerTransactionId column was nullable and not unique in Prisma.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerTransactionId_key" ON "Payment"("providerTransactionId");

CREATE TABLE "UserStyleAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "sourceImageUrl" TEXT NOT NULL,
  "imageUrl" TEXT,
  "thumbnailUrl" TEXT,
  "promptRules" TEXT,
  "analysisJson" JSONB,
  "dominantColors" JSONB,
  "compositionNotes" TEXT,
  "typographyNotes" TEXT,
  "negativeRules" TEXT,
  "moderationStatus" TEXT,
  "status" "UserStyleAssetStatus" NOT NULL DEFAULT 'UPLOADED',
  "rejectionReason" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserStyleAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserStyleAsset_id_userId_key" ON "UserStyleAsset"("id", "userId");
CREATE INDEX "UserStyleAsset_userId_createdAt_idx" ON "UserStyleAsset"("userId", "createdAt");
CREATE INDEX "UserStyleAsset_userId_status_createdAt_idx" ON "UserStyleAsset"("userId", "status", "createdAt");

ALTER TABLE "UserStyleAsset"
  ADD CONSTRAINT "UserStyleAsset_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD COLUMN "selectedUserStyleAssetId" TEXT,
  ADD COLUMN "styleSource" "StyleSource" NOT NULL DEFAULT 'LIBRARY_TEMPLATE';

CREATE INDEX "Project_selectedUserStyleAssetId_idx" ON "Project"("selectedUserStyleAssetId");

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_selectedUserStyleAssetId_fkey"
  FOREIGN KEY ("selectedUserStyleAssetId") REFERENCES "UserStyleAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Generation"
  ADD COLUMN "userStyleAssetId" TEXT,
  ADD COLUMN "styleSource" "StyleSource" NOT NULL DEFAULT 'LIBRARY_TEMPLATE';

CREATE INDEX "Generation_userStyleAssetId_idx" ON "Generation"("userStyleAssetId");

ALTER TABLE "Generation"
  ADD CONSTRAINT "Generation_userStyleAssetId_fkey"
  FOREIGN KEY ("userStyleAssetId") REFERENCES "UserStyleAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
