import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeHeader } from "@/lib/csv-core";
import type { ClientOption, MemberOption } from "@/lib/time";
import {
  HarvestApiError,
  fetchHarvestProjects,
  fetchHarvestTimeEntries,
  fetchHarvestUsers,
  getHarvestCredentials,
  isHarvestAuthError,
  type HarvestProject,
  type HarvestTimeEntry,
  type HarvestUser,
} from "@/lib/harvest";

export type HarvestImportRefs = {
  clients: ClientOption[];
  members: MemberOption[];
};

export type HarvestRowData = {
  entryId: number;
  projectId: number | null;
  projectName: string | null;
  userId: number | null;
  userName: string | null;
  clientId: string | null;
  memberId: string | null;
  task: string;
  hours: number;
  workDate: Date;
  error: string | null;
  errorKind: "client" | "member" | "other" | null;
  isDuplicate: boolean;
};

export function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export async function loadHarvestRefs(
  workspaceId: string,
): Promise<HarvestImportRefs> {
  const [clients, workspaceMembers] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    }),
  ]);

  // TODO: Replace with new auth system's user info lookup
  const members: MemberOption[] = workspaceMembers.map((member) => ({
    id: member.id,
    name: null,
    email: null,
  }));

  return { clients, members };
}

export async function loadExistingHarvestIds(
  workspaceId: string,
): Promise<Set<string>> {
  const entries = await prisma.timeEntry.findMany({
    where: { workspaceId, harvestEntryId: { not: null } },
    select: { harvestEntryId: true },
  });
  return new Set(
    entries.flatMap((entry) => (entry.harvestEntryId ? [entry.harvestEntryId] : [])),
  );
}

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

function resolveMemberId(
  userId: number | null,
  email: string | null,
  userToMember: Record<string, string>,
  members: MemberOption[],
): string | null {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const override = userId !== null ? userToMember[String(userId)] : undefined;
  if (override && memberById.has(override)) return override;
  if (!email) return null;
  const byEmail = members.find(
    (member) => member.email && member.email.toLowerCase() === email.toLowerCase(),
  );
  return byEmail?.id ?? null;
}

export function buildHarvestRows(
  entries: HarvestTimeEntry[],
  projectToClient: Record<string, string>,
  userToMember: Record<string, string>,
  refs: HarvestImportRefs,
  existingIds: Set<string>,
): Map<number, HarvestRowData> {
  const rows = new Map<number, HarvestRowData>();

  for (const entry of entries) {
    if (entry.is_running) {
      rows.set(entry.id, {
        entryId: entry.id,
        projectId: entry.project?.id ?? null,
        projectName: entry.project?.name ?? null,
        userId: entry.user?.id ?? null,
        userName: entry.user?.name ?? null,
        clientId: null,
        memberId: null,
        task: "",
        hours: 0,
        workDate: toUtcDate(entry.spent_date),
        error: "Skipped running time entry.",
        errorKind: "other",
        isDuplicate: false,
      });
      continue;
    }

    const projectId = entry.project?.id ?? null;
    const projectName = entry.project?.name ?? null;
    const clientName = entry.project?.client?.name ?? null;
    const clientId = resolveClientId(projectId, clientName, projectToClient, refs.clients);

    const userId = entry.user?.id ?? null;
    const userName = entry.user?.name ?? null;
    const userEmail = entry.user?.email ?? null;
    const memberId = resolveMemberId(userId, userEmail, userToMember, refs.members);

    const task =
      (entry.notes ?? "").trim() ||
      entry.task?.name ||
      projectName ||
      "Untitled entry";
    const hours = Math.round(entry.hours * 100) / 100;
    const workDate = toUtcDate(entry.spent_date);

    let error: string | null = null;
    let errorKind: HarvestRowData["errorKind"] = null;
    if (!clientId) {
      error = clientName
        ? `No client found for project "${projectName}".`
        : "This entry has no client. Map the project to a client.";
      errorKind = "client";
    } else if (!memberId) {
      error = userName
        ? `No team member found for "${userName}". Map the user to a team member.`
        : "This entry has no user. Map the user to a team member.";
      errorKind = "member";
    } else if (hours <= 0) {
      error = "Skipped entry with zero or negative hours.";
      errorKind = "other";
    }

    rows.set(entry.id, {
      entryId: entry.id,
      projectId,
      projectName,
      userId,
      userName,
      clientId,
      memberId,
      task,
      hours,
      workDate,
      error,
      errorKind,
      isDuplicate: existingIds.has(String(entry.id)),
    });
  }

  return rows;
}

export type HarvestImportDataResult =
  | { ok: false; error: string; authError?: boolean }
  | {
      ok: true;
      projects: HarvestProject[];
      users: HarvestUser[];
      entries: HarvestTimeEntry[];
      refs: HarvestImportRefs;
    };

export async function fetchHarvestImportData(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<HarvestImportDataResult> {
  const credentials = await getHarvestCredentials(workspaceId);
  if (!credentials) {
    return { ok: false, error: "Connect Harvest before importing entries." };
  }

  let projects: HarvestProject[];
  let users: HarvestUser[];
  let entries: HarvestTimeEntry[];
  try {
    [projects, users, entries] = await Promise.all([
      fetchHarvestProjects(credentials.token, credentials.accountId),
      fetchHarvestUsers(credentials.token, credentials.accountId),
      fetchHarvestTimeEntries(
        credentials.token,
        credentials.accountId,
        startDate,
        endDate,
      ),
    ]);
  } catch (error) {
    if (isHarvestAuthError(error)) {
      return {
        ok: false,
        error:
          "Your Harvest credentials are invalid or expired. Update them on the Integrations page.",
        authError: true,
      };
    }
    if (error instanceof HarvestApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Could not reach Harvest. Please try again." };
  }

  const refs = await loadHarvestRefs(workspaceId);
  return { ok: true, projects, users, entries, refs };
}

export async function markHarvestConnectionFailure(
  workspaceId: string,
  message: string,
): Promise<void> {
  try {
    await prisma.harvestConnection.update({
      where: { workspaceId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "FAILED",
        lastSyncError: message,
      },
    });
  } catch {
    // The connection may have been removed.
  }
}
