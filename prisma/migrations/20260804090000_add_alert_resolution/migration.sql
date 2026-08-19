-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "isResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Alert_workspaceId_isResolved_idx" ON "Alert"("workspaceId", "isResolved");
