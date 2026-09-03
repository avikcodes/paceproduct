import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { evaluateAllMarginAlerts } from "@/lib/margin-alerts";
import { evaluateAllBudgetAlerts } from "@/lib/budget-alerts";
import { evaluateAllScopeAlerts } from "@/lib/scope-alerts";
import {
  buildHarvestRows,
  fetchHarvestImportData,
  loadExistingHarvestIds,
  markHarvestConnectionFailure,
  toUtcDate,
} from "@/lib/harvest-import";

const encoder = new TextEncoder();

function jsonLine(data: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(data)}\n`);
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) return false;
  return startDate <= endDate;
}

type HarvestImportBody = {
  startDate: string;
  endDate: string;
  entryIds: number[];
  projectToClient: Record<string, string>;
  userToMember: Record<string, string>;
};

function parseBody(value: unknown): HarvestImportBody | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.startDate !== "string" || typeof record.endDate !== "string") {
    return null;
  }
  if (!isValidDateRange(record.startDate, record.endDate)) return null;

  if (!Array.isArray(record.entryIds)) return null;
  const entryIds: number[] = [];
  for (const id of record.entryIds) {
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
    entryIds.push(id);
  }
  if (entryIds.length === 0) return null;

  const projectToClient = parseStringRecord(record.projectToClient);
  const userToMember = parseStringRecord(record.userToMember);
  if (!projectToClient || !userToMember) return null;

  return { startDate: record.startDate, endDate: record.endDate, entryIds, projectToClient, userToMember };
}

function parseStringRecord(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item !== "string") return null;
    result[key] = item;
  }
  return result;
}

export async function POST(request: Request) {
  // TODO: Get userId from new auth system
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
