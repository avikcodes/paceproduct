-- CreateEnum
CREATE TYPE "TogglSyncStatus" AS ENUM ('NEVER', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "togglEntryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_workspaceId_togglEntryId_key" ON "TimeEntry"("workspaceId", "togglEntryId");

-- CreateTable
CREATE TABLE "TogglConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "apiTokenEncrypted" TEXT NOT NULL,
    "apiTokenIv" TEXT NOT NULL,
    "togglEmail" TEXT,
    "togglName" TEXT,
    "togglWorkspaceId" INTEGER,
    "togglWorkspaceName" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "TogglSyncStatus" NOT NULL DEFAULT 'NEVER',
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TogglConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TogglImport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT,
    "status" "TogglSyncStatus" NOT NULL DEFAULT 'SUCCESS',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TogglImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TogglConnection_workspaceId_key" ON "TogglConnection"("workspaceId");

-- CreateIndex
CREATE INDEX "TogglConnection_workspaceId_idx" ON "TogglConnection"("workspaceId");

-- CreateIndex
CREATE INDEX "TogglImport_workspaceId_idx" ON "TogglImport"("workspaceId");

-- CreateIndex
CREATE INDEX "TogglImport_workspaceId_createdAt_idx" ON "TogglImport"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "TogglConnection" ADD CONSTRAINT "TogglConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TogglImport" ADD CONSTRAINT "TogglImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TogglImport" ADD CONSTRAINT "TogglImport_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TogglConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
