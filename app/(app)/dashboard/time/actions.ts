"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
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
  // TODO: Replace with new auth system's user info lookup
  return { name: null, email: null };
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
  // TODO: Get workspace from new auth system
  return { ok: false, error: "Authentication is required to log time." };
}

export async function updateTimeEntry(
  entryId: string,
  values: TimeEntryFormValues,
): Promise<TimeEntryActionResult<TimeEntryRow>> {
  // TODO: Get workspace from new auth system
  return { ok: false, error: "Authentication is required to update time entries." };
}

export async function deleteTimeEntry(
  entryId: string,
): Promise<TimeEntryActionResult<{ id: string }>> {
  // TODO: Get workspace from new auth system
  return { ok: false, error: "Authentication is required to delete time entries." };
}
