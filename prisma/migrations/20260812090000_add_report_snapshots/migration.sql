-- AlterTable: make generated reports immutable versioned snapshots.
DROP INDEX "Report_workspaceId_clientId_reportMonth_key";

-- AlterTable
ALTER TABLE "Report"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "hours" DECIMAL(12,2),
    ADD COLUMN "monthlyBudget" DECIMAL(12,2),
    ADD COLUMN "scopeHours" INTEGER,
    ADD COLUMN "billingCycle" "BillingCycle",
    ADD COLUMN "retainerStartDate" TIMESTAMP(3),
    ADD COLUMN "retainerEndDate" TIMESTAMP(3),
    ADD COLUMN "trendJson" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Report_workspaceId_clientId_reportMonth_version_key" ON "Report"("workspaceId", "clientId", "reportMonth", "version");