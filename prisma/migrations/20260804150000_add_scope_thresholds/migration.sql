-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "scopeThreshold" INTEGER;

-- CreateIndex
CREATE INDEX "Alert_workspaceId_clientId_type_idx" ON "Alert"("workspaceId", "clientId", "type");
