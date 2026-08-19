"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWorkspaceIfHasCapability } from "@/lib/permissions";
import {
  clientFormSchema,
  clientSelect,
  type ClientFormValues,
  type ClientRow,
} from "@/lib/clients";

export type ClientActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const CLIENTS_PATH = "/dashboard/clients";
const DASHBOARD_PATH = "/dashboard";
const ACTIVITY_PATH = "/dashboard/activity";
const clientDetailPath = (clientId: string) => `/dashboard/clients/${clientId}`;

function toClientInput(values: ClientFormValues) {
  return {
    name: values.name,
    company: values.company || null,
    website: values.website || null,
    contactName: values.contactName || null,
    contactEmail: values.contactEmail || null,
    phone: values.phone || null,
    status: values.status,
    notes: values.notes || null,
  };
}

function parseClientInput(
  values: ClientFormValues,
): { error: string } | { data: ClientFormValues } {
  const parsed = clientFormSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid client details." };
  }
  return { data: parsed.data };
}

export async function createClient(
  values: ClientFormValues,
): Promise<ClientActionResult<ClientRow>> {
  const workspace = await getWorkspaceIfHasCapability("manageClients");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage clients." };
  }

  const parsed = parseClientInput(values);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    const client = await prisma.client.create({
      data: { ...toClientInput(parsed.data), workspaceId: workspace.workspaceId },
      select: clientSelect,
    });
    revalidatePath(CLIENTS_PATH);
    revalidatePath(DASHBOARD_PATH);
    revalidatePath(ACTIVITY_PATH);
    return { ok: true, data: client };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function updateClient(
  clientId: string,
  values: ClientFormValues,
): Promise<ClientActionResult<ClientRow>> {
  const workspace = await getWorkspaceIfHasCapability("manageClients");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage clients." };
  }

  const parsed = parseClientInput(values);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, workspaceId: true },
  });

  if (!existing || existing.workspaceId !== workspace.workspaceId) {
    return { ok: false, error: "Client not found." };
  }

  try {
    const client = await prisma.client.update({
      where: { id: clientId },
      data: toClientInput(parsed.data),
      select: clientSelect,
    });
    revalidatePath(CLIENTS_PATH);
    revalidatePath(clientDetailPath(clientId));
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, data: client };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function archiveClient(
  clientId: string,
): Promise<ClientActionResult<ClientRow>> {
  const workspace = await getWorkspaceIfHasCapability("manageClients");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage clients." };
  }

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, workspaceId: true },
  });

  if (!existing || existing.workspaceId !== workspace.workspaceId) {
    return { ok: false, error: "Client not found." };
  }

  try {
    const client = await prisma.client.update({
      where: { id: clientId },
      data: { status: "ARCHIVED" },
      select: clientSelect,
    });
    revalidatePath(CLIENTS_PATH);
    revalidatePath(clientDetailPath(clientId));
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, data: client };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function deleteClient(
  clientId: string,
): Promise<ClientActionResult<{ id: string }>> {
  const workspace = await getWorkspaceIfHasCapability("manageClients");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage clients." };
  }

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, workspaceId: true },
  });

  if (!existing || existing.workspaceId !== workspace.workspaceId) {
    return { ok: false, error: "Client not found." };
  }

  try {
    await prisma.client.delete({ where: { id: clientId } });
    revalidatePath(CLIENTS_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, data: { id: clientId } };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Returns the current client list for the authenticated workspace. Used to
 * refresh the clients page and the retainer import's client references after
 * a CSV client import, so newly created clients are visible immediately.
 */
export async function listClients(): Promise<ClientRow[]> {
  const workspace = await getWorkspaceIfHasCapability("viewClients");
  if (!workspace) return [];
  return prisma.client.findMany({
    where: { workspaceId: workspace.workspaceId },
    orderBy: [{ createdAt: "desc" }],
    select: clientSelect,
  });
}
