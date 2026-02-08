-- CreateEnum
CREATE TYPE "BulkActionStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "BulkActionLogStatus" AS ENUM ('success', 'failure', 'skipped');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "age" INTEGER,
    "status" TEXT DEFAULT 'active',
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkAction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" "BulkActionStatus" NOT NULL DEFAULT 'queued',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkActionLog" (
    "id" TEXT NOT NULL,
    "bulkActionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "BulkActionLogStatus" NOT NULL,
    "errorMessage" TEXT,
    "skipReason" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_accountId_email_key" ON "Contact"("accountId", "email");

-- CreateIndex
CREATE INDEX "BulkAction_accountId_idx" ON "BulkAction"("accountId");

-- CreateIndex
CREATE INDEX "BulkAction_accountId_status_idx" ON "BulkAction"("accountId", "status");

-- CreateIndex
CREATE INDEX "BulkActionLog_bulkActionId_idx" ON "BulkActionLog"("bulkActionId");

-- CreateIndex
CREATE INDEX "BulkActionLog_bulkActionId_status_idx" ON "BulkActionLog"("bulkActionId", "status");

-- AddForeignKey
ALTER TABLE "BulkActionLog" ADD CONSTRAINT "BulkActionLog_bulkActionId_fkey" FOREIGN KEY ("bulkActionId") REFERENCES "BulkAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
