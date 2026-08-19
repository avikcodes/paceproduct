"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getCurrentWorkspace,
  roleHasCapability,
} from "@/lib/permissions";
import { alertSelect, toAlertRow, type AlertRow } from "@/lib/alerts";

export type AlertActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ALERTS_PATH = "/dashboard/alerts";
const ACTIVITY_PATH = "/dashboard/activity";
const DASHBOARD_PATH = "/dashboard";

async function findScopedAlert(alertId: string, workspaceId: string) {
  return prisma.alert.findFirst({
    where: { id: alertId, workspaceId },
    select: { id: true },
  });
}

export async function markAlertRead(
  alertId: string,
): Promise<AlertActionResult<AlertRow>> {
  const workspace = await getCurrentWorkspace();

  const existing = await findScopedAlert(alertId, workspace.workspaceId);
  if (!existing) return { ok: false, error: "Alert not found." };

  try {
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: { isRead: true },
      select: alertSelect,
    });
    revalidatePath(ALERTS_PATH);
    revalidatePath(ACTIVITY_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, data: toAlertRow(alert) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function markAlertUnread(
  alertId: string,
): Promise<AlertActionResult<AlertRow>> {
  const workspace = await getCurrentWorkspace();

  const existing = await findScopedAlert(alertId, workspace.workspaceId);
  if (!existing) return { ok: false, error: "Alert not found." };

  try {
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: { isRead: false },
      select: alertSelect,
    });
    revalidatePath(ALERTS_PATH);
    revalidatePath(ACTIVITY_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, data: toAlertRow(alert) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function deleteAlert(
  alertId: string,
): Promise<AlertActionResult<{ id: string }>> {
  const workspace = await getCurrentWorkspace();

  const existing = await findScopedAlert(alertId, workspace.workspaceId);
  if (!existing) return { ok: false, error: "Alert not found." };

  try {
    await prisma.alert.delete({ where: { id: alertId } });
    revalidatePath(ALERTS_PATH);
    revalidatePath(ACTIVITY_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, data: { id: alertId } };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function resolveAlert(
  alertId: string,
): Promise<AlertActionResult<AlertRow>> {
  const workspace = await getCurrentWorkspace();
  if (!roleHasCapability(workspace.role, "manageClients")) {
    return {
      ok: false,
      error: "You don't have permission to resolve alerts.",
    };
  }

  const existing = await findScopedAlert(alertId, workspace.workspaceId);
  if (!existing) return { ok: false, error: "Alert not found." };

  try {
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: { isResolved: true, resolvedAt: new Date() },
      select: alertSelect,
    });
    revalidatePath(ALERTS_PATH);
    revalidatePath(ACTIVITY_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, data: toAlertRow(alert) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
