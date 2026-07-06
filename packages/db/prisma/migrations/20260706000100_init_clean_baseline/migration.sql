-- Production baseline generated from packages/db/prisma/schema.prisma.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('PURCHASE', 'GENERATION_DEBIT', 'GENERATION_REFUND', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaidPlan" AS ENUM ('START', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'REFUNDED', 'FAILED', 'CANCELED', 'CHARGEBACKED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PLATEGA');

-- CreateEnum
CREATE TYPE "GenerationFormat" AS ENUM ('YOUTUBE', 'VERTICAL');

-- CreateEnum
CREATE TYPE "ReferenceMode" AS ENUM ('FACE', 'REFERENCE', 'NONE');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LINK', 'VIDEO', 'TRANSCRIPT');

-- CreateEnum
CREATE TYPE "ProjectPlatform" AS ENUM ('YOUTUBE', 'INSTAGRAM_TIKTOK', 'FACELESS');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SOURCE_PROCESSING', 'SOURCE_READY', 'SOURCE_FAILED', 'HOOKS_PENDING', 'HOOKS_READY', 'GENERATION_PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StyleSource" AS ENUM ('LIBRARY_TEMPLATE', 'USER_STYLE');

-- CreateEnum
CREATE TYPE "UserStyleAssetStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'READY', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "languageCode" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "balance" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "UserFaceAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "telegramFileId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFaceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPackage" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "plan" "PaidPlan",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceRub" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PaidPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "monthlyCreditLimit" INTEGER,
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "avatarLimit" INTEGER,
    "sourcePaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PLATEGA',
    "amountRub" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "creditsGranted" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "providerStatus" TEXT,
    "paymentUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptPreset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" "SourceType" NOT NULL,
    "platform" "ProjectPlatform",
    "topicSummary" TEXT,
    "selectedHookId" TEXT,
    "selectedTemplateId" TEXT,
    "selectedUserStyleAssetId" TEXT,
    "styleSource" "StyleSource" NOT NULL DEFAULT 'LIBRARY_TEMPLATE',
    "guestFaceAssetId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "url" TEXT,
    "text" TEXT,
    "fileId" TEXT,
    "mimeType" TEXT,
    "previewImageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "cleanText" TEXT,
    "language" TEXT,
    "providerMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HookCandidate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "angle" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HookCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" "ProjectPlatform" NOT NULL,
    "previewImageUrl" TEXT,
    "promptRules" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "templateId" TEXT,
    "userStyleAssetId" TEXT,
    "styleSource" "StyleSource" NOT NULL DEFAULT 'LIBRARY_TEMPLATE',
    "hookCandidateId" TEXT,
    "format" "GenerationFormat" NOT NULL,
    "platform" "ProjectPlatform",
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "referenceMode" "ReferenceMode" NOT NULL,
    "referenceImageUrl" TEXT,
    "guestFaceAssetId" TEXT,
    "guestReferenceImageUrl" TEXT,
    "referenceAnalysis" TEXT,
    "topic" TEXT NOT NULL,
    "hookText" TEXT,
    "niche" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "creditCost" INTEGER NOT NULL DEFAULT 1,
    "chargedPlan" "PaidPlan",
    "chargedSubscriptionId" TEXT,
    "queuePriority" INTEGER NOT NULL DEFAULT 50,
    "originalUrl" TEXT,
    "previewUrl" TEXT,
    "providerTaskId" TEXT,
    "providerMeta" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserStyleAsset_userId_createdAt_idx" ON "UserStyleAsset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserStyleAsset_userId_status_createdAt_idx" ON "UserStyleAsset"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserStyleAsset_id_userId_key" ON "UserStyleAsset"("id", "userId");

-- CreateIndex
CREATE INDEX "UserFaceAsset_userId_createdAt_idx" ON "UserFaceAsset"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPackage_slug_key" ON "CreditPackage"("slug");

-- CreateIndex
CREATE INDEX "UserSubscription_userId_status_currentPeriodEnd_idx" ON "UserSubscription"("userId", "status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "UserSubscription_plan_status_idx" ON "UserSubscription"("plan", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_payload_key" ON "Payment"("payload");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerTransactionId_key" ON "Payment"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptPreset_slug_key" ON "PromptPreset"("slug");

-- CreateIndex
CREATE INDEX "Project_userId_createdAt_idx" ON "Project"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_status_createdAt_idx" ON "Project"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Project_platform_createdAt_idx" ON "Project"("platform", "createdAt");

-- CreateIndex
CREATE INDEX "Project_guestFaceAssetId_idx" ON "Project"("guestFaceAssetId");

-- CreateIndex
CREATE INDEX "Project_selectedUserStyleAssetId_idx" ON "Project"("selectedUserStyleAssetId");

-- CreateIndex
CREATE INDEX "SourceAsset_projectId_idx" ON "SourceAsset"("projectId");

-- CreateIndex
CREATE INDEX "SourceAsset_type_createdAt_idx" ON "SourceAsset"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Transcript_projectId_idx" ON "Transcript"("projectId");

-- CreateIndex
CREATE INDEX "HookCandidate_projectId_score_idx" ON "HookCandidate"("projectId", "score");

-- CreateIndex
CREATE INDEX "HookCandidate_projectId_isSelected_idx" ON "HookCandidate"("projectId", "isSelected");

-- CreateIndex
CREATE UNIQUE INDEX "Template_slug_key" ON "Template"("slug");

-- CreateIndex
CREATE INDEX "Template_platform_isActive_sortOrder_idx" ON "Template"("platform", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Generation_projectId_createdAt_idx" ON "Generation"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_status_createdAt_idx" ON "Generation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_userId_createdAt_idx" ON "Generation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_guestFaceAssetId_idx" ON "Generation"("guestFaceAssetId");

-- CreateIndex
CREATE INDEX "Generation_userStyleAssetId_idx" ON "Generation"("userStyleAssetId");

-- CreateIndex
CREATE INDEX "Generation_providerTaskId_idx" ON "Generation"("providerTaskId");

-- CreateIndex
CREATE INDEX "Generation_chargedSubscriptionId_idx" ON "Generation"("chargedSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "UserStyleAsset" ADD CONSTRAINT "UserStyleAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFaceAsset" ADD CONSTRAINT "UserFaceAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_selectedHookId_fkey" FOREIGN KEY ("selectedHookId") REFERENCES "HookCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_selectedTemplateId_fkey" FOREIGN KEY ("selectedTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_selectedUserStyleAssetId_fkey" FOREIGN KEY ("selectedUserStyleAssetId") REFERENCES "UserStyleAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_guestFaceAssetId_fkey" FOREIGN KEY ("guestFaceAssetId") REFERENCES "UserFaceAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAsset" ADD CONSTRAINT "SourceAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HookCandidate" ADD CONSTRAINT "HookCandidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_chargedSubscriptionId_fkey" FOREIGN KEY ("chargedSubscriptionId") REFERENCES "UserSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userStyleAssetId_fkey" FOREIGN KEY ("userStyleAssetId") REFERENCES "UserStyleAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_hookCandidateId_fkey" FOREIGN KEY ("hookCandidateId") REFERENCES "HookCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_guestFaceAssetId_fkey" FOREIGN KEY ("guestFaceAssetId") REFERENCES "UserFaceAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
