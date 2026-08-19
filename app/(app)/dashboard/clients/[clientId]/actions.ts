"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWorkspaceIfHasCapability } from "@/lib/permissions";
import { evaluateClientMarginAlert } from "@/lib/margin-alerts";
import { evaluateClientBudgetAlert } from "@/lib/budget-alerts";
import { evaluateClientScopeAlert } from "@/lib/scope-alerts";
import {
  marginThresholdsFormSchema,
  type MarginThresholdsFormValues,
} from "@/lib/margin-thresholds";
import { toMarginThresholds, type MarginThresholds } from "@/lib/margins";
import {
  retainerFormSchema,
  retainerSelect,
  toRetainerRow,
  type RetainerFormValues,
  type RetainerRow,
} from "@/lib/retainers";
import {
  getClientPdfReportData,
  type PdfReportData,
} from "@/lib/pdf-report";

export type RetainerActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type PdfReportActionResult =
  | { ok: true; data: PdfReportData }
  | { ok: false; error: string };

export async function getClientPdfReport(
  clientId: string,
): Promise<PdfReportActionResult> {
  const workspace = await getWorkspaceIfHasCapability("viewClients");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to view this report." };
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.workspaceId },
    select: { id: true },
  });
  if (!client) {
    return { ok: false, error: "Client not found." };
  }

  try {
    const data = await getClientPdfReportData(client.id, workspace.workspaceId);
    if (!data) {
      return { ok: false, error: "This client has no reportable data yet." };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Couldn't generate the report data." };
  }
}

const clientPath = (clientId: string) => `/dashboard/clients/${clientId}`;
const marginPath = (clientId: string) =>
  `/dashboard/clients/${clientId}/margins`;

function revalidateClientMargins(clientId: string) {
  revalidatePath(clientPath(clientId));
  revalidatePath(marginPath(clientId));
  revalidatePath("/dashboard/clients");
}

function revalidateDashboard() {
  revalidatePath("/dashboard");
}

function toRetainerInput(values: RetainerFormValues) {
  return {
    monthlyBudget: Number(values.monthlyBudget),
    currency: values.currency,
    billingCycle: values.billingCycle,
    scopeHours: values.scopeHours,
    startDate: new Date(`${values.startDate}T00:00:00.000Z`),
    endDate: values.endDate ? new Date(`${values.endDate}T00:00:00.000Z`) : null,
  };
}

function parseRetainerInput(
  values: RetainerFormValues,
): { error: string } | { data: RetainerFormValues } {
  const parsed = retainerFormSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid retainer details." };
  }
  return { data: parsed.data };
}

async function findScopedRetainer(retainerId: string, workspaceId: string) {
  const retainer = await prisma.retainer.findUnique({
    where: { id: retainerId },
    select: {
      id: true,
      clientId: true,
      isActive: true,
      client: { select: { workspaceId: true } },
    },
  });

  if (!retainer || retainer.client.workspaceId !== workspaceId) {
    return null;
  }

  return retainer;
}

export async function createRetainer(
  clientId: string,
  values: RetainerFormValues,
): Promise<RetainerActionResult<RetainerRow>> {
  const workspace = await getWorkspaceIfHasCapability("manageRetainers");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage retainers." };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, workspaceId: true },
  });

  if (!client || client.workspaceId !== workspace.workspaceId) {
    return { ok: false, error: "Client not found." };
  }

  const parsed = parseRetainerInput(values);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const existingActive = await prisma.retainer.findFirst({
    where: { clientId, isActive: true },
    select: { id: true },
  });

  if (existingActive) {
    return {
      ok: false,
      error: "This client already has an active retainer.",
    };
  }

  try {
    const retainer = await prisma.retainer.create({
      data: { ...toRetainerInput(parsed.data), clientId, isActive: true },
      select: retainerSelect,
    });
    revalidateClientMargins(clientId);
    revalidateDashboard();
    await evaluateClientMarginAlert(clientId, workspace.workspaceId);
    await evaluateClientBudgetAlert(clientId, workspace.workspaceId);
    await evaluateClientScopeAlert(clientId, workspace.workspaceId);
    return { ok: true, data: toRetainerRow(retainer) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function updateRetainer(
  retainerId: string,
  values: RetainerFormValues,
): Promise<RetainerActionResult<RetainerRow>> {
  const workspace = await getWorkspaceIfHasCapability("manageRetainers");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage retainers." };
  }

  const scoped = await findScopedRetainer(retainerId, workspace.workspaceId);
  if (!scoped) {
    return { ok: false, error: "Retainer not found." };
  }

  const parsed = parseRetainerInput(values);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    const retainer = await prisma.retainer.update({
      where: { id: retainerId },
      data: toRetainerInput(parsed.data),
      select: retainerSelect,
    });
    revalidateClientMargins(scoped.clientId);
    revalidateDashboard();
    await evaluateClientMarginAlert(scoped.clientId, workspace.workspaceId);
    await evaluateClientBudgetAlert(scoped.clientId, workspace.workspaceId);
    await evaluateClientScopeAlert(scoped.clientId, workspace.workspaceId);
    return { ok: true, data: toRetainerRow(retainer) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function deleteRetainer(
  retainerId: string,
): Promise<RetainerActionResult<{ id: string }>> {
  const workspace = await getWorkspaceIfHasCapability("manageRetainers");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage retainers." };
  }

  const scoped = await findScopedRetainer(retainerId, workspace.workspaceId);
  if (!scoped) {
    return { ok: false, error: "Retainer not found." };
  }

  try {
    await prisma.retainer.delete({ where: { id: retainerId } });
    revalidateClientMargins(scoped.clientId);
    revalidateDashboard();
    await evaluateClientMarginAlert(scoped.clientId, workspace.workspaceId);
    await evaluateClientBudgetAlert(scoped.clientId, workspace.workspaceId);
    await evaluateClientScopeAlert(scoped.clientId, workspace.workspaceId);
    return { ok: true, data: { id: retainerId } };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function updateMarginThresholds(
  clientId: string,
  values: MarginThresholdsFormValues,
): Promise<RetainerActionResult<MarginThresholds>> {
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

  const parsed = marginThresholdsFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid margin thresholds.",
    };
  }

  try {
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        healthyThreshold: Number(parsed.data.healthy),
        warningThreshold: Number(parsed.data.warning),
        criticalThreshold: Number(parsed.data.critical),
      },
      select: {
        healthyThreshold: true,
        warningThreshold: true,
        criticalThreshold: true,
      },
    });
    revalidateClientMargins(clientId);
    await evaluateClientMarginAlert(clientId, workspace.workspaceId);
    return { ok: true, data: toMarginThresholds(client) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
