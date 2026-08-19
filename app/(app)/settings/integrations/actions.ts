"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWorkspaceIfHasCapability } from "@/lib/permissions";
import { normalizeHeader } from "@/lib/csv-core";
import type { ClientOption } from "@/lib/time";
import {
  TogglApiError,
  fetchTogglMe,
  fetchTogglProjects,
  fetchTogglTimeEntries,
  getTogglToken,
  encryptTogglToken,
} from "@/lib/toggl";

export type TogglActionState = {
  error?: string;
  success?: string;
};

export type TogglProjectOption = {
  id: number;
  name: string;
  clientId: string | null;
  clientName: string | null;
  autoMatched: boolean;
};

export type TogglPreviewRow = {
  entryId: string;
  projectId: number | null;
  projectName: string | null;
  task: string;
  hours: number;
  date: string;
  clientId: string | null;
  clientName: string | null;
  duplicate: boolean;
  error: string | null;
  errorKind: "client" | "other" | null;
};

export type TogglPreview = {
  startDate: string;
  endDate: string;
  projects: TogglProjectOption[];
  rows: TogglPreviewRow[];
  importable: number;
  skipped: number;
  totalEntries: number;
};

export type TogglImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  startedAt: string;
  finishedAt: string;
};

export type TogglActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) return false;
  return startDate <= endDate;
}

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

type BuildRowData = {
  entryId: string;
  projectId: number | null;
  projectName: string | null;
  clientId: string | null;
  task: string;
  hours: number;
  workDate: Date;
  error: string | null;
  errorKind: "client" | "other" | null;
  isDuplicate: boolean;
};

function resolveClientId(
  projectId: number | null,
  clientName: string | null,
  projectToClient: Record<string, string>,
  clients: ClientOption[],
): string | null {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const override = projectId !== null ? projectToClient[String(projectId)] : undefined;
  if (override && clientById.has(override)) return override;
  if (!clientName) return null;
  const byName = clients.find(
    (client) => normalizeHeader(client.name) === normalizeHeader(clientName),
  );
  return byName?.id ?? null;
}

async function loadRefs(workspaceId: string, ownerUserId: string) {
  const clients = await prisma.client.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: ownerUserId } },
    select: { id: true },
  });

  return { clients, memberId: member?.id ?? null };
}

async function loadExistingTogglIds(workspaceId: string): Promise<Set<string>> {
  const entries = await prisma.timeEntry.findMany({
    where: { workspaceId, togglEntryId: { not: null } },
    select: { togglEntryId: true },
  });
  return new Set(entries.flatMap((entry) => (entry.togglEntryId ? [entry.togglEntryId] : [])));
}

function buildRows(
  entries: Awaited<ReturnType<typeof fetchTogglTimeEntries>>,
  projectNameById: Map<number, string>,
  projectClientNameById: Map<number, string | null>,
  projectToClient: Record<string, string>,
  clients: ClientOption[],
  existingIds: Set<string>,
): Map<string, BuildRowData> {
  const rows = new Map<string, BuildRowData>();

  for (const entry of entries) {
    if (entry.duration < 0 || !entry.stop) {
      rows.set(entry.id, {
        entryId: entry.id,
        projectId: entry.project_id,
        projectName: entry.project_id !== null ? projectNameById.get(entry.project_id) ?? null : null,
        clientId: null,
        task: "",
        hours: 0,
        workDate: toUtcDate(entry.start.slice(0, 10)),
        error: "Skipped running time entry.",
        errorKind: "other",
        isDuplicate: false,
      });
      continue;
    }

    const projectName = entry.project_id !== null ? projectNameById.get(entry.project_id) ?? null : null;
    const clientName =
      entry.project_id !== null ? projectClientNameById.get(entry.project_id) ?? null : null;
    const clientId = resolveClientId(entry.project_id, clientName, projectToClient, clients);

    const task = (entry.description ?? "").trim() || projectName || "Untitled entry";
    const hours = Math.round((entry.duration / 3600) * 100) / 100;
    const workDate = toUtcDate(entry.start.slice(0, 10));

    let error: string | null = null;
    let errorKind: BuildRowData["errorKind"] = null;
    if (!clientId) {
      error = clientName
        ? `No client found for project "${projectName}".`
        : "This entry has no client. Map the project to a client.";
      errorKind = "client";
    } else if (hours <= 0) {
      error = "Skipped entry with zero or negative hours.";
      errorKind = "other";
    }

    rows.set(entry.id, {
      entryId: entry.id,
      projectId: entry.project_id,
      projectName,
      clientId,
      task,
      hours,
      workDate,
      error,
      errorKind,
      isDuplicate: existingIds.has(entry.id),
    });
  }

  return rows;
}

async function fetchTogglData(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      token: string;
      projects: Awaited<ReturnType<typeof fetchTogglProjects>>;
      entries: Awaited<ReturnType<typeof fetchTogglTimeEntries>>;
      clients: ClientOption[];
      projectNameById: Map<number, string>;
      projectClientNameById: Map<number, string | null>;
    }
> {
  const token = await getTogglToken(workspaceId);
  if (!token) {
    return { ok: false, error: "Connect Toggl before importing entries." };
  }

  const [projects, entries] = await Promise.all([
    fetchTogglProjects(token),
    fetchTogglTimeEntries(token, startDate, endDate),
  ]);

  const clients = await prisma.client.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const projectNameById = new Map<number, string>();
  const projectClientNameById = new Map<number, string | null>();
  for (const project of projects) {
    projectNameById.set(project.id, project.name);
    projectClientNameById.set(project.id, project.client_name ?? null);
  }

  return { ok: true, token, projects, entries, clients, projectNameById, projectClientNameById };
}

function toProjectOption(
  project: Awaited<ReturnType<typeof fetchTogglProjects>>[number],
  clients: ClientOption[],
): TogglProjectOption {
  const byName = project.client_name
    ? clients.find(
        (client) => normalizeHeader(client.name) === normalizeHeader(project.client_name ?? ""),
      )
    : undefined;
  return {
    id: project.id,
    name: project.name,
    clientId: byName?.id ?? null,
    clientName: project.client_name ?? null,
    autoMatched: Boolean(byName),
  };
}

export async function connectToggl(
  _prevState: TogglActionState,
  formData: FormData,
): Promise<TogglActionState> {
  const workspace = await getWorkspaceIfHasCapability("manageSettings");
  if (!workspace) {
    return { error: "Only workspace owners can connect Toggl." };
  }
  const workspaceId = workspace.workspaceId;

  const rawToken = formData.get("token");
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token) {
    return { error: "Please enter your Toggl API token." };
  }
  if (token.length > 300 || /[\s]/.test(token)) {
    return { error: "That doesn't look like a valid Toggl API token." };
  }

  let me: Awaited<ReturnType<typeof fetchTogglMe>>;
  try {
    me = await fetchTogglMe(token);
  } catch (error) {
    if (error instanceof TogglApiError) {
      return { error: error.message };
    }
    return { error: "Could not connect to Toggl. Please try again." };
  }

  const togglWorkspace = me.workspaces.find(
    (item) => item.id === me.default_workspace_id,
  );

  const { ciphertext, iv } = encryptTogglToken(token);

  await prisma.togglConnection.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      apiTokenEncrypted: ciphertext,
      apiTokenIv: iv,
      togglEmail: me.email,
      togglName: me.fullname || null,
      togglWorkspaceId: togglWorkspace?.id ?? null,
      togglWorkspaceName: togglWorkspace?.name ?? null,
      lastSyncStatus: "NEVER",
    },
    update: {
      apiTokenEncrypted: ciphertext,
      apiTokenIv: iv,
      togglEmail: me.email,
      togglName: me.fullname || null,
      togglWorkspaceId: togglWorkspace?.id ?? null,
      togglWorkspaceName: togglWorkspace?.name ?? null,
      lastSyncAt: null,
      lastSyncStatus: "NEVER",
      lastSyncError: null,
    },
  });

  revalidatePath("/settings/integrations");
  return { success: "Toggl connected. You can now import time entries." };
}

export async function disconnectToggl(): Promise<TogglActionState> {
  const workspace = await getWorkspaceIfHasCapability("manageSettings");
  if (!workspace) {
    return { error: "Only workspace owners can disconnect Toggl." };
  }

  await prisma.togglConnection.delete({
    where: { workspaceId: workspace.workspaceId },
  });

  revalidatePath("/settings/integrations");
  return { success: "Toggl disconnected." };
}

export async function fetchTogglPreview(
  startDate: string,
  endDate: string,
): Promise<TogglActionResult<TogglPreview>> {
  const workspace = await getWorkspaceIfHasCapability("manageSettings");
  if (!workspace) {
    return { ok: false, error: "Only workspace owners can preview imports." };
  }

  if (!isValidDateRange(startDate, endDate)) {
    return { ok: false, error: "Enter a valid date range." };
  }

  const data = await fetchTogglData(workspace.workspaceId, startDate, endDate);
  if (!data.ok) return { ok: false, error: data.error };

  const existingIds = await loadExistingTogglIds(workspace.workspaceId);
  const rowsData = buildRows(
    data.entries,
    data.projectNameById,
    data.projectClientNameById,
    {},
    data.clients,
    existingIds,
  );

  const rows: TogglPreviewRow[] = [...rowsData.values()].map((row) => ({
    entryId: row.entryId,
    projectId: row.projectId,
    projectName: row.projectName,
    task: row.task,
    hours: row.hours,
    date: row.workDate.toISOString(),
    clientId: row.clientId,
    clientName:
      data.clients.find((client) => client.id === row.clientId)?.name ?? null,
    duplicate: row.isDuplicate,
    error: row.error,
    errorKind: row.errorKind,
  }));

  const importable = rows.filter((row) => !row.duplicate && !row.error).length;
  const skipped = rows.length - importable;

  const preview: TogglPreview = {
    startDate,
    endDate,
    projects: data.projects.map((project) => toProjectOption(project, data.clients)),
    rows,
    importable,
    skipped,
    totalEntries: rows.length,
  };

  return { ok: true, data: preview };
}

export async function importTogglEntries(
  input: {
    startDate: string;
    endDate: string;
    entryIds: string[];
    projectToClient: Record<string, string>;
  },
): Promise<TogglActionResult<TogglImportSummary>> {
  const workspace = await getWorkspaceIfHasCapability("manageSettings");
  if (!workspace) {
    return { ok: false, error: "Only workspace owners can import entries." };
  }
  const workspaceId = workspace.workspaceId;

  if (!isValidDateRange(input.startDate, input.endDate)) {
    return { ok: false, error: "Enter a valid date range." };
  }

  const selectedIds = new Set(input.entryIds);
  if (selectedIds.size === 0) {
    return { ok: false, error: "Select at least one entry to import." };
  }

  const data = await fetchTogglData(workspaceId, input.startDate, input.endDate);
  if (!data.ok) return { ok: false, error: data.error };

  const existingIds = await loadExistingTogglIds(workspaceId);
  const rowsData = buildRows(
    data.entries,
    data.projectNameById,
    data.projectClientNameById,
    input.projectToClient,
    data.clients,
    existingIds,
  );

  const { memberId } = await loadRefs(workspaceId, workspace.userId);
  if (!memberId) {
    return { ok: false, error: "No team member is associated with this account." };
  }

  const selected = data.entries.filter((entry) => selectedIds.has(entry.id));
  const toImport = selected.filter((entry) => {
    const row = rowsData.get(entry.id);
    return row && !row.isDuplicate && !row.error && row.clientId;
  });

  const importedCount = toImport.length;
  const skippedCount = selected.length - toImport.length;

  const startedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      for (const entry of toImport) {
        const row = rowsData.get(entry.id);
        if (!row?.clientId) continue;
        await tx.timeEntry.create({
          data: {
            workspaceId,
            clientId: row.clientId,
            memberId,
            task: row.task,
            hours: row.hours,
            workDate: row.workDate,
            source: "TOGGL",
            togglEntryId: entry.id,
          },
        });
      }

      const status =
        skippedCount > 0 ? "PARTIAL" : importedCount > 0 ? "SUCCESS" : "FAILED";
      const error =
        status === "FAILED"
          ? "No entries could be imported."
          : skippedCount > 0
            ? `${skippedCount} entr${skippedCount === 1 ? "y" : "ies"} skipped.`
            : null;

      await tx.togglImport.create({
        data: {
          workspaceId,
          connectionId: (await tx.togglConnection.findUnique({
            where: { workspaceId },
            select: { id: true },
          }))?.id ?? null,
          status,
          startDate: toUtcDate(input.startDate),
          endDate: toUtcDate(input.endDate),
          importedCount,
          skippedCount,
          failedCount: 0,
          error,
          startedAt,
          finishedAt: new Date(),
        },
      });

      await tx.togglConnection.update({
        where: { workspaceId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: status,
          lastSyncError: error,
        },
      });
    });
  } catch {
    return { ok: false, error: "Something went wrong while importing. No entries were imported." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/time");
  revalidatePath("/settings/integrations");

  return {
    ok: true,
    data: {
      imported: importedCount,
      skipped: skippedCount,
      failed: 0,
      total: selected.length,
      status: skippedCount > 0 ? "PARTIAL" : importedCount > 0 ? "SUCCESS" : "FAILED",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    },
  };
}
