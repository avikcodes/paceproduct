"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";

export type AdminBulkActionResult =
  | { ok: true; affectedCount: number }
  | { ok: false; error: string };

const ADMIN_CLIENTS_PATH = "/dashboard/admin/clients";
const ADMIN_PATH = "/dashboard/admin";
const CLIENTS_PATH = "/dashboard/clients";
const ACTIVITY_PATH = "/dashboard/activity";

async function scopedClientIds(
  workspaceId: string,
  clientIds: string[],
): Promise<string[]> {
  const unique = [...new Set(clientIds)];
  if (unique.length === 0) return [];

  const rows = await prisma.client.findMany({
    where: { id: { in: unique }, workspaceId },
    select: { id: true },
  });

  return rows.map((row) => row.id);
}

export async function archiveClients(
  clientIds: string[],
): Promise<AdminBulkActionResult> {
  const workspace = await requireCapability("manageClients");

  const scoped = await scopedClientIds(workspace.workspaceId, clientIds);
  if (scoped.length === 0) {
    return { ok: false, error: "No clients found in this workspace." };
  }

  try {
    await prisma.client.updateMany({
      where: { id: { in: scoped }, workspaceId: workspace.workspaceId },
      data: { status: "ARCHIVED" },
    });
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath(ADMIN_CLIENTS_PATH);
  revalidatePath(ADMIN_PATH);
  revalidatePath(CLIENTS_PATH);
  revalidatePath(ACTIVITY_PATH);
  return { ok: true, affectedCount: scoped.length };
}

export async function deleteClients(
  clientIds: string[],
): Promise<AdminBulkActionResult> {
  const workspace = await requireCapability("manageClients");

  const scoped = await scopedClientIds(workspace.workspaceId, clientIds);
  if (scoped.length === 0) {
    return { ok: false, error: "No clients found in this workspace." };
  }

  try {
    await prisma.client.deleteMany({
      where: { id: { in: scoped }, workspaceId: workspace.workspaceId },
    });
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath(ADMIN_CLIENTS_PATH);
  revalidatePath(ADMIN_PATH);
  revalidatePath(CLIENTS_PATH);
  revalidatePath(ACTIVITY_PATH);
  return { ok: true, affectedCount: scoped.length };
}
