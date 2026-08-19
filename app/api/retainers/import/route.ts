import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runCsvImport } from "@/lib/imports/import-runner";
import { RETAINER_IMPORT_SPEC } from "@/lib/imports/retainers";
import { normalizeHeader } from "@/lib/csv-core";
import type { BillingCycle } from "@/lib/generated/prisma/enums";
import type {
  ImportRefs,
  ImportRow,
} from "@/lib/imports/types";

const PATHS = [
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/admin/clients",
  "/dashboard/admin",
];

async function loadRefs(workspaceId: string): Promise<ImportRefs> {
  const [clients, activeClients] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
      where: { workspaceId, retainers: { some: { isActive: true } } },
      select: { id: true },
    }),
  ]);
  return {
    clients,
    existingClientNames: clients.map((client) => client.name),
    existingActiveClients: activeClients.map((client) => client.id),
  };
}

async function dedupe(
  workspaceId: string,
  rows: ImportRow[],
): Promise<Map<string, string>> {
  const seen = new Map<string, number>();
  const failures = new Map<string, string>();
  for (const row of rows) {
    if (!row.resolved) continue;
    const name = row.values.client?.trim() ?? "";
    const key = normalizeHeader(name);
    const previous = seen.get(key);
    if (previous) {
      failures.set(
        row.fingerprint,
        `Duplicate retainer row for client "${name}".`,
      );
      continue;
    }
    seen.set(key, row.rowNumber);
  }
  return failures;
}

async function create(workspaceId: string, row: ImportRow): Promise<void> {
  const resolved = row.resolved;
  if (!resolved) return;
  await prisma.retainer.create({
    data: {
      clientId: String(resolved.clientId),
      monthlyBudget: Number(resolved.monthlyBudget),
      currency: String(resolved.currency),
      billingCycle: resolved.billingCycle as BillingCycle,
      scopeHours: Number(resolved.scopeHours),
      startDate: new Date(`${String(resolved.startDate)}T00:00:00.000Z`),
      endDate: resolved.endDate
        ? new Date(`${String(resolved.endDate)}T00:00:00.000Z`)
        : null,
      isActive: true,
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
    capability: "manageRetainers",
    spec: RETAINER_IMPORT_SPEC,
    loadRefs,
    dedupe,
    create,
    revalidate,
  });
}
