"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  getWorkspaceIfHasCapability,
  roleHasCapability,
  type WorkspaceContext,
} from "@/lib/permissions";
import { evaluateClientMarginAlert } from "@/lib/margin-alerts";
import { evaluateClientBudgetAlert } from "@/lib/budget-alerts";
import { evaluateClientScopeAlert } from "@/lib/scope-alerts";
import {
  timeEntryFormSchema,
  timeEntrySelect,
  toTimeEntryRow,
  type MemberDisplay,
  type TimeEntryFormValues,
  type TimeEntryRow,
} from "@/lib/time";

export type TimeEntryActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const TIME_PATH = "/dashboard/time";
const ACTIVITY_PATH = "/dashboard/activity";
const DASHBOARD_PATH = "/dashboard";

const CLIENTS_PATH = "/dashboard/clients";
const clientPath = (clientId: string) => `/dashboard/clients/${clientId}`;
const marginPath = (clientId: string) =>
  `/dashboard/clients/${clientId}/margins`;

function revalidateClientMargins(clientId: string) {
  revalidatePath(CLIENTS_PATH);
  revalidatePath(clientPath(clientId));
  revalidatePath(marginPath(clientId));
}

function revalidateTimeActivity() {
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(TIME_PATH);
  revalidatePath(ACTIVITY_PATH);
}

async function getMemberDisplay(userId: string): Promise<MemberDisplay> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return {
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      email: user.primaryEmailAddress?.emailAddress ?? null,
    };
  } catch {
    return { name: null, email: null };
  }
}

function parseTimeEntryInput(
  values: TimeEntryFormValues,
): { error: string } | { data: TimeEntryFormValues } {
  const parsed = timeEntryFormSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid time entry." };
  }
  return { data: parsed.data };
}

async function findScopedClient(clientId: string, workspaceId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, workspaceId: true },
  });
  if (!client || client.workspaceId !== workspaceId) return null;
  return client;
}

async function findScopedMember(memberId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { id: true, workspaceId: true, userId: true },
  });
  if (!member || member.workspaceId !== workspaceId) return null;
  return member;
}

async function canModifyEntry(
  workspace: WorkspaceContext,
  entry: { memberId: string },
): Promise<boolean> {
  if (roleHasCapability(workspace.role, "manageTeam")) return true;
  const caller = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: workspace.workspaceId, userId: workspace.userId },
    },
    select: { id: true },
  });
  return caller?.id === entry.memberId;
}

function toCreateData(values: TimeEntryFormValues, workspaceId: string) {
  return {
    workspaceId,
    clientId: values.clientId,
    memberId: values.memberId,
    task: values.task,
    hours: Number(values.hours),
    workDate: new Date(`${values.workDate}T00:00:00.000Z`),
    source: "MANUAL" as const,
  };
}

function toUpdateData(values: TimeEntryFormValues) {
  return {
    clientId: values.clientId,
    memberId: values.memberId,
    task: values.task,
    hours: Number(values.hours),
    workDate: new Date(`${values.workDate}T00:00:00.000Z`),
  };
}

export async function createTimeEntry(
  values: TimeEntryFormValues,
): Promise<TimeEntryActionResult<TimeEntryRow>> {
  const workspace = await getWorkspaceIfHasCapability("addTimeEntries");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to log time." };
  }

  const parsed = parseTimeEntryInput(values);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const [client, member] = await Promise.all([
    findScopedClient(parsed.data.clientId, workspace.workspaceId),
    findScopedMember(parsed.data.memberId, workspace.workspaceId),
  ]);

  if (!client) return { ok: false, error: "Client not found." };
  if (!member) return { ok: false, error: "Team member not found." };

  try {
    const entry = await prisma.timeEntry.create({
      data: toCreateData(parsed.data, workspace.workspaceId),
      select: timeEntrySelect,
    });
    revalidateTimeActivity();
    revalidateClientMargins(parsed.data.clientId);
    await evaluateClientMarginAlert(parsed.data.clientId, workspace.workspaceId);
    await evaluateClientBudgetAlert(parsed.data.clientId, workspace.workspaceId);
    await evaluateClientScopeAlert(parsed.data.clientId, workspace.workspaceId);
    const memberInfo = await getMemberDisplay(member.userId);
    return { ok: true, data: toTimeEntryRow(entry, memberInfo) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function updateTimeEntry(
  entryId: string,
  values: TimeEntryFormValues,
): Promise<TimeEntryActionResult<TimeEntryRow>> {
  const workspace = await getWorkspaceIfHasCapability("addTimeEntries");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to log time." };
  }

  const parsed = parseTimeEntryInput(values);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const existing = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, workspaceId: true, clientId: true, memberId: true },
  });

  if (!existing || existing.workspaceId !== workspace.workspaceId) {
    return { ok: false, error: "Time entry not found." };
  }

  if (!(await canModifyEntry(workspace, existing))) {
    return {
      ok: false,
      error: "You can only edit your own time entries.",
    };
  }

  const [client, member] = await Promise.all([
    findScopedClient(parsed.data.clientId, workspace.workspaceId),
    findScopedMember(parsed.data.memberId, workspace.workspaceId),
  ]);

  if (!client) return { ok: false, error: "Client not found." };
  if (!member) return { ok: false, error: "Team member not found." };

  try {
    const entry = await prisma.timeEntry.update({
      where: { id: entryId },
      data: toUpdateData(parsed.data),
      select: timeEntrySelect,
    });
    revalidateTimeActivity();
    revalidateClientMargins(existing.clientId);
    revalidateClientMargins(parsed.data.clientId);
    await Promise.all([
      evaluateClientMarginAlert(existing.clientId, workspace.workspaceId),
      evaluateClientMarginAlert(parsed.data.clientId, workspace.workspaceId),
      evaluateClientBudgetAlert(existing.clientId, workspace.workspaceId),
      evaluateClientBudgetAlert(parsed.data.clientId, workspace.workspaceId),
      evaluateClientScopeAlert(existing.clientId, workspace.workspaceId),
      evaluateClientScopeAlert(parsed.data.clientId, workspace.workspaceId),
    ]);
    const memberInfo = await getMemberDisplay(member.userId);
    return { ok: true, data: toTimeEntryRow(entry, memberInfo) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function deleteTimeEntry(
  entryId: string,
): Promise<TimeEntryActionResult<{ id: string }>> {
  const workspace = await getWorkspaceIfHasCapability("addTimeEntries");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to log time." };
  }

  const existing = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, workspaceId: true, clientId: true, memberId: true },
  });

  if (!existing || existing.workspaceId !== workspace.workspaceId) {
    return { ok: false, error: "Time entry not found." };
  }

  if (!(await canModifyEntry(workspace, existing))) {
    return {
      ok: false,
      error: "You can only delete your own time entries.",
    };
  }

  try {
    await prisma.timeEntry.delete({ where: { id: entryId } });
    revalidateTimeActivity();
    revalidateClientMargins(existing.clientId);
    await evaluateClientMarginAlert(existing.clientId, workspace.workspaceId);
    await evaluateClientBudgetAlert(existing.clientId, workspace.workspaceId);
    await evaluateClientScopeAlert(existing.clientId, workspace.workspaceId);
    return { ok: true, data: { id: entryId } };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
