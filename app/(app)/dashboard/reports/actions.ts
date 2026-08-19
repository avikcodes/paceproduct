"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getWorkspaceIfHasCapability } from "@/lib/permissions";
import {
  generateReportSnapshot,
  monthKeyToDate,
  type ReportRow,
} from "@/lib/reports";
import { getReportPdfData, type PdfReportData } from "@/lib/pdf-report";

export type ReportActionResult =
  | { ok: true; data: ReportRow }
  | { ok: false; error: string };

export type ReportPdfResult =
  | { ok: true; data: PdfReportData }
  | { ok: false; error: string };

export type ReportDeleteResult = { ok: true } | { ok: false; error: string };

const REPORTS_PATH = "/dashboard/reports";
const ACTIVITY_PATH = "/dashboard/activity";
const DASHBOARD_PATH = "/dashboard";

export async function generateReport(
  clientId: string,
  monthKey: string,
): Promise<ReportActionResult> {
  const workspace = await getWorkspaceIfHasCapability("manageReports");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage reports." };
  }

  if (!clientId) {
    return { ok: false, error: "Choose a client." };
  }

  if (!monthKey || !monthKeyToDate(monthKey)) {
    return { ok: false, error: "Choose a valid report month." };
  }

  try {
    const report = await generateReportSnapshot(
      workspace.workspaceId,
      clientId,
      monthKey,
    );

    if (!report) {
      return {
        ok: false,
        error: "No logged time for this client and month.",
      };
    }

    revalidatePath(REPORTS_PATH);
    revalidatePath(ACTIVITY_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, data: report };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function downloadReportPdf(
  reportId: string,
): Promise<ReportPdfResult> {
  const workspace = await getWorkspaceIfHasCapability("viewReports");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to view reports." };
  }

  if (!reportId) {
    return { ok: false, error: "Choose a report." };
  }

  try {
    const data = await getReportPdfData(reportId, workspace.workspaceId);
    if (!data) {
      return { ok: false, error: "Report not found." };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function deleteReport(
  reportId: string,
): Promise<ReportDeleteResult> {
  const workspace = await getWorkspaceIfHasCapability("manageReports");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to manage reports." };
  }

  if (!reportId) {
    return { ok: false, error: "Choose a report." };
  }

  try {
    const result = await prisma.report.deleteMany({
      where: { id: reportId, workspaceId: workspace.workspaceId },
    });

    if (result.count === 0) {
      return { ok: false, error: "Report not found." };
    }

    revalidatePath(REPORTS_PATH);
    revalidatePath(ACTIVITY_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
