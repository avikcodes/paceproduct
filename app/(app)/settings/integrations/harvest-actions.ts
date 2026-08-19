"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWorkspaceIfHasCapability } from "@/lib/permissions";
import { normalizeHeader } from "@/lib/csv-core";
import type { ClientOption, MemberOption } from "@/lib/time";
import {
  HarvestApiError,
  encryptHarvestToken,
  fetchHarvestMe,
  type HarvestProject,
  type HarvestUser,
} from "@/lib/harvest";
import {
  buildHarvestRows,
  fetchHarvestImportData,
  loadExistingHarvestIds,
  markHarvestConnectionFailure,
} from "@/lib/harvest-import";

export type HarvestActionState = {
  error?: string;
  success?: string;
};

export type HarvestProjectOption = {
  id: number;
  name: string;
  clientId: string | null;
  clientName: string | null;
  autoMatched: boolean;
};

export type HarvestUserOption = {
  id: number;
  name: string;
  email: string;
  memberId: string | null;
  autoMatched: boolean;
};

export type HarvestPreviewRow = {
  entryId: number;
  projectId: number | null;
  projectName: string | null;
  userId: number | null;
  userName: string | null;
  task: string;
  hours: number;
  date: string;
  clientId: string | null;
  clientName: string | null;
  memberId: string | null;
  memberName: string | null;
  duplicate: boolean;
  error: string | null;
  errorKind: "client" | "member" | "other" | null;
};

export type HarvestPreview = {
  startDate: string;
  endDate: string;
  projects: HarvestProjectOption[];
  users: HarvestUserOption[];
  rows: HarvestPreviewRow[];
  importable: number;
  skipped: number;
  totalEntries: number;
};

export type HarvestImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  startedAt: string;
  finishedAt: string;
};

export type HarvestActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) return false;
  return startDate <= endDate;
}

function toProjectOption(
  project: HarvestProject,
  clients: ClientOption[],
): HarvestProjectOption {
  const clientName = project.client?.name ?? null;
  const byName = clientName
    ? clients.find(
        (client) => normalizeHeader(client.name) === normalizeHeader(clientName),
      )
    : undefined;
  return {
    id: project.id,
    name: project.name,
    clientId: byName?.id ?? null,
    clientName,
    autoMatched: Boolean(byName),
  };
}

function toUserOption(
  user: HarvestUser,
  members: MemberOption[],
): HarvestUserOption {
  const name =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  const byEmail = members.find(
    (member) =>
      member.email && member.email.toLowerCase() === user.email.toLowerCase(),
  );
  return {
    id: user.id,
    name,
    email: user.email,
    memberId: byEmail?.id ?? null,
    autoMatched: Boolean(byEmail),
  };
}

export async function connectHarvest(
  _prevState: HarvestActionState,
  formData: FormData,
): Promise<HarvestActionState> {
  const workspace = await getWorkspaceIfHasCapability("manageSettings");
  if (!workspace) {
    return { error: "Only workspace owners can connect Harvest." };
  }
  const workspaceId = workspace.workspaceId;

  const rawToken = formData.get("token");
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token) {
    return { error: "Please enter your Harvest API token." };
  }
  if (token.length > 300 || /[\s]/.test(token)) {
    return { error: "That doesn't look like a valid Harvest API token." };
  }

  const rawAccountId = formData.get("accountId");
  const accountId = typeof rawAccountId === "string" ? rawAccountId.trim() : "";
  if (!accountId) {
    return { error: "Please enter your Harvest Account ID." };
  }
  if (!/^\d+$/.test(accountId) || accountId.length > 20) {
    return { error: "That doesn't look like a valid Harvest Account ID." };
  }

  let me: Awaited<ReturnType<typeof fetchHarvestMe>>;
  try {
    me = await fetchHarvestMe(token, accountId);
  } catch (error) {
    if (error instanceof HarvestApiError) {
      return { error: error.message };
    }
    return { error: "Could not connect to Harvest. Please try again." };
  }

  const { ciphertext, iv } = encryptHarvestToken(token);

  await prisma.harvestConnection.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      tokenEncrypted: ciphertext,
      tokenIv: iv,
      accountId,
      harvestUserId: me.id,
      harvestName:
        [me.first_name, me.last_name].filter(Boolean).join(" ") || null,
      harvestEmail: me.email,
      harvestCompany: me.company?.name ?? null,
      lastSyncStatus: "NEVER",
    },
    update: {
      tokenEncrypted: ciphertext,
      tokenIv: iv,
      accountId,
      harvestUserId: me.id,
      harvestName: [me.first_name, me.last_name].filter(Boolean).join(" ") || null,
      harvestEmail: me.email,
      harvestCompany: me.company?.name ?? null,
      lastSyncAt: null,
      lastSyncStatus: "NEVER",
      lastSyncError: null,
    },
  });

  revalidatePath("/settings/integrations");
  return { success: "Harvest connected. You can now import time entries." };
}

export async function disconnectHarvest(): Promise<HarvestActionState> {
  const workspace = await getWorkspaceIfHasCapability("manageSettings");
  if (!workspace) {
    return { error: "Only workspace owners can disconnect Harvest." };
  }

  await prisma.harvestConnection.delete({
    where: { workspaceId: workspace.workspaceId },
  });

  revalidatePath("/settings/integrations");
  return { success: "Harvest disconnected." };
}

export async function fetchHarvestPreview(
  startDate: string,
  endDate: string,
): Promise<HarvestActionResult<HarvestPreview>> {
  const workspace = await getWorkspaceIfHasCapability("manageSettings");
  if (!workspace) {
    return { ok: false, error: "Only workspace owners can preview imports." };
  }

  if (!isValidDateRange(startDate, endDate)) {
    return { ok: false, error: "Enter a valid date range." };
  }

  const data = await fetchHarvestImportData(
    workspace.workspaceId,
    startDate,
    endDate,
  );
  if (!data.ok) {
    if (data.authError) {
      await markHarvestConnectionFailure(workspace.workspaceId, data.error);
    }
    return { ok: false, error: data.error };
  }

  const existingIds = await loadExistingHarvestIds(workspace.workspaceId);
  const rowsData = buildHarvestRows(
    data.entries,
    {},
    {},
    data.refs,
    existingIds,
  );

  const clientNameById = new Map(
    data.refs.clients.map((client) => [client.id, client.name]),
  );
  const memberNameById = new Map(
    data.refs.members.map((member) => [member.id, member.name]),
  );

  const rows: HarvestPreviewRow[] = [...rowsData.values()].map((row) => ({
    entryId: row.entryId,
    projectId: row.projectId,
    projectName: row.projectName,
    userId: row.userId,
    userName: row.userName,
    task: row.task,
    hours: row.hours,
    date: row.workDate.toISOString(),
    clientId: row.clientId,
    clientName: row.clientId ? clientNameById.get(row.clientId) ?? null : null,
    memberId: row.memberId,
    memberName: row.memberId
      ? (memberNameById.get(row.memberId) ?? null)
      : null,
    duplicate: row.isDuplicate,
    error: row.error,
    errorKind: row.errorKind,
  }));

  const importable = rows.filter((row) => !row.duplicate && !row.error).length;
  const skipped = rows.length - importable;

  const preview: HarvestPreview = {
    startDate,
    endDate,
    projects: data.projects.map((project) =>
      toProjectOption(project, data.refs.clients),
    ),
    users: data.users.map((user) => toUserOption(user, data.refs.members)),
    rows,
    importable,
    skipped,
    totalEntries: rows.length,
  };

  return { ok: true, data: preview };
}
