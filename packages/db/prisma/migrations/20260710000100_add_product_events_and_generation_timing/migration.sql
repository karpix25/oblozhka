ALTER TABLE "Generation"
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "finishedAt" TIMESTAMP(3);

CREATE TABLE "ProductEvent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "userId" TEXT,
  "projectId" TEXT,
  "generationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Generation_queuedAt_idx" ON "Generation"("queuedAt");
CREATE INDEX "Generation_finishedAt_idx" ON "Generation"("finishedAt");
CREATE UNIQUE INDEX "Generation_requestKey_key" ON "Generation"("requestKey");
CREATE UNIQUE INDEX "CreditLedgerEntry_userId_reason_referenceId_key"
  ON "CreditLedgerEntry"("userId", "reason", "referenceId");
CREATE INDEX "ProductEvent_name_createdAt_idx" ON "ProductEvent"("name", "createdAt");
CREATE INDEX "ProductEvent_userId_createdAt_idx" ON "ProductEvent"("userId", "createdAt");
CREATE INDEX "ProductEvent_projectId_createdAt_idx" ON "ProductEvent"("projectId", "createdAt");
CREATE INDEX "ProductEvent_generationId_createdAt_idx" ON "ProductEvent"("generationId", "createdAt");
CREATE INDEX "ProductEvent_createdAt_idx" ON "ProductEvent"("createdAt");

ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_generationId_fkey"
  FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
