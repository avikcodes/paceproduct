-- CreateEnum
CREATE TYPE "HarvestSyncStatus" AS ENUM ('NEVER', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "harvestEntryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_workspaceId_harvestEntryId_key" ON "TimeEntry"("workspaceId", "harvestEntryId");

-- CreateTable
CREATE TABLE "HarvestConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "harvestUserId" INTEGER,
    "harvestName" TEXT,
    "harvestEmail" TEXT,
    "harvestCompany" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "HarvestSyncStatus" NOT NULL DEFAULT 'NEVER',
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HarvestConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarvestImport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT,
    "status" "HarvestSyncStatus" NOT NULL DEFAULT 'SUCCESS',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HarvestImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HarvestConnection_workspaceId_key" ON "HarvestConnection"("workspaceId");

-- CreateIndex
CREATE INDEX "HarvestConnection_workspaceId_idx" ON "HarvestConnection"("workspaceId");

-- CreateIndex
CREATE INDEX "HarvestImport_workspaceId_idx" ON "HarvestImport"("workspaceId");

-- CreateIndex
CREATE INDEX "HarvestImport_workspaceId_createdAt_idx" ON "HarvestImport"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "HarvestConnection" ADD CONSTRAINT "HarvestConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestImport" ADD CONSTRAINT "HarvestImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestImport" ADD CONSTRAINT "HarvestImport_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "HarvestConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
