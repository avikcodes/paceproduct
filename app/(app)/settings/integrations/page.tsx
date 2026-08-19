import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
import {
  TogglSettingsCard,
  type TogglConnectionData,
} from "@/components/settings/integrations/toggl-settings-card";
import {
  TogglImportHistory,
  type TogglImportHistoryRow,
} from "@/components/settings/integrations/import-history-table";
import {
  HarvestSettingsCard,
  type HarvestConnectionData,
} from "@/components/settings/integrations/harvest-settings-card";
import {
  HarvestImportHistory,
  type HarvestImportHistoryRow,
} from "@/components/settings/integrations/harvest-import-history-table";
import { loadHarvestRefs } from "@/lib/harvest-import";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect external services and import time entries.",
};

export default async function IntegrationsPage() {
  const workspace = await requireCapability("manageSettings");
  const { workspaceId, role } = workspace;
  const canManage = roleHasCapability(role, "manageSettings");

  const [togglConnection, togglImports, harvestConnection, harvestImports, refs] =
    await Promise.all([
      prisma.togglConnection.findUnique({
        where: { workspaceId },
      }),
      prisma.togglImport.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.harvestConnection.findUnique({
        where: { workspaceId },
      }),
      prisma.harvestImport.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      loadHarvestRefs(workspaceId),
    ]);

  const clients = refs.clients;
  const members = refs.members;

  const togglConnectionData: TogglConnectionData | null = togglConnection
    ? {
        email: togglConnection.togglEmail,
        name: togglConnection.togglName,
        togglWorkspaceName: togglConnection.togglWorkspaceName,
        lastSyncAt: togglConnection.lastSyncAt?.toISOString() ?? null,
        lastSyncStatus: togglConnection.lastSyncStatus,
        lastSyncError: togglConnection.lastSyncError,
      }
    : null;

  const harvestConnectionData: HarvestConnectionData | null = harvestConnection
    ? {
        name: harvestConnection.harvestName,
        email: harvestConnection.harvestEmail,
        company: harvestConnection.harvestCompany,
        lastSyncAt: harvestConnection.lastSyncAt?.toISOString() ?? null,
        lastSyncStatus: harvestConnection.lastSyncStatus,
        lastSyncError: harvestConnection.lastSyncError,
      }
    : null;

  const togglImportRows: TogglImportHistoryRow[] = togglImports.map((row) => ({
    id: row.id,
    status: row.status,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    importedCount: row.importedCount,
    skippedCount: row.skippedCount,
    failedCount: row.failedCount,
    error: row.error,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  }));

  const harvestImportRows: HarvestImportHistoryRow[] = harvestImports.map(
    (row) => ({
      id: row.id,
      status: row.status,
      startDate: row.startDate?.toISOString() ?? null,
      endDate: row.endDate?.toISOString() ?? null,
      importedCount: row.importedCount,
      skippedCount: row.skippedCount,
      failedCount: row.failedCount,
      error: row.error,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <TogglSettingsCard
        connection={togglConnectionData}
        canManage={canManage}
        clients={clients}
      />
      <TogglImportHistory imports={togglImportRows} />

      <hr className="border-border" />

      <HarvestSettingsCard
        connection={harvestConnectionData}
        canManage={canManage}
        clients={clients}
        members={members}
      />
      <HarvestImportHistory imports={harvestImportRows} />
    </div>
  );
}
