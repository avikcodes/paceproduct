import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runCsvImport } from "@/lib/imports/import-runner";
import { CLIENT_IMPORT_SPEC } from "@/lib/imports/clients";
import {
  type ImportRefs,
  type ImportRow,
} from "@/lib/imports/types";
import { normalizeHeader } from "@/lib/csv-core";

const PATHS = [
  "/dashboard",
  "/dashboard/admin/import/clients",
  "/dashboard/admin/clients",
  "/dashboard/admin",
  "/dashboard/clients",
  "/dashboard/activity",
];

async function loadRefs(workspaceId: string): Promise<ImportRefs> {
  const clients = await prisma.client.findMany({
    where: { workspaceId },
    select: { name: true },
  });
  return {
    existingClientNames: clients.map((client) => client.name),
  };
}

async function dedupe(
  workspaceId: string,
  rows: ImportRow[],
  refs: ImportRefs,
): Promise<Map<string, string>> {
  const existing = new Set(
    (refs.existingClientNames ?? []).map(normalizeHeader),
  );
  const seen = new Map<string, number>();
  const failures = new Map<string, string>();
  for (const row of rows) {
    if (!row.resolved) continue;
    const name = String(row.resolved.name ?? "");
    const key = normalizeHeader(name);
    const previous = seen.get(key);
    if (previous) {
      failures.set(row.fingerprint, `Duplicate of row ${previous}.`);
      continue;
    }
    seen.set(key, row.rowNumber);
    if (existing.has(key)) {
      existing.add(key);
      failures.set(
        row.fingerprint,
        `"${name}" already exists in this workspace.`,
      );
    }
  }
  return failures;
}

async function create(workspaceId: string, row: ImportRow): Promise<void> {
  const resolved = row.resolved;
  if (!resolved) return;
  await prisma.client.create({
    data: {
      workspaceId,
      name: String(resolved.name),
      company: (resolved.company as string | null) ?? null,
      website: (resolved.website as string | null) ?? null,
      contactName: (resolved.contactName as string | null) ?? null,
      contactEmail: (resolved.contactEmail as string | null) ?? null,
      phone: (resolved.phone as string | null) ?? null,
      status: (resolved.status as "ACTIVE" | "PAUSED" | "ARCHIVED") ?? "ACTIVE",
      notes: (resolved.notes as string | null) ?? null,
    },
  });
}

async function revalidate(): Promise<void> {
  for (const path of PATHS) {
    revalidatePath(path);
  }
}

export async function POST(request: Request) {
  return runCsvImport(request, {
    capability: "manageClients",
    spec: CLIENT_IMPORT_SPEC,
    loadRefs,
    dedupe,
    create,
    revalidate,
  });
}