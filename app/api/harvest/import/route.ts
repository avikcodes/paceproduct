import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember, roleHasCapability } from "@/lib/permissions";
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
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceMember(userId);
  if (!workspace || !roleHasCapability(workspace.role, "manageSettings")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { workspaceId } = workspace;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(jsonLine(data));

      try {
        const body = parseBody(await request.json());
        if (!body) {
          send({ type: "error", message: "Invalid import request." });
          return;
        }

        const data = await fetchHarvestImportData(
          workspaceId,
          body.startDate,
          body.endDate,
        );
        if (!data.ok) {
          if (data.authError) {
            await markHarvestConnectionFailure(workspaceId, data.error);
          }
          send({ type: "error", message: data.error });
          return;
        }

        const existingIds = await loadExistingHarvestIds(workspaceId);
        const rowsData = buildHarvestRows(
          data.entries,
          body.projectToClient,
          body.userToMember,
          data.refs,
          existingIds,
        );

        const selectedIds = new Set(body.entryIds);
        const selected = data.entries.filter((entry) => selectedIds.has(entry.id));

        const failures: { entryId: number; message: string }[] = [];
        const toImport = selected.filter((entry) => {
          const row = rowsData.get(entry.id);
          if (!row || row.isDuplicate || row.error || !row.clientId || !row.memberId) {
            if (row) {
              failures.push({
                entryId: entry.id,
                message: row.isDuplicate
                  ? "Already imported."
                  : row.error ?? "Skipped.",
              });
            }
            return false;
          }
          return true;
        });

        const importedCount = toImport.length;
        const skippedCount = selected.length - importedCount;
        const startedAt = new Date();

        const status =
          skippedCount > 0 ? "PARTIAL" : importedCount > 0 ? "SUCCESS" : "FAILED";
        const error =
          status === "FAILED"
            ? "No entries could be imported."
            : skippedCount > 0
              ? `${skippedCount} entr${skippedCount === 1 ? "y" : "ies"} skipped.`
              : null;

        send({
          type: "progress",
          imported: 0,
          total: importedCount,
          skipped: skippedCount,
        });

        await prisma.$transaction(async (tx) => {
          let count = 0;
          for (const entry of toImport) {
            const row = rowsData.get(entry.id);
            if (!row?.clientId || !row.memberId) continue;
            await tx.timeEntry.create({
              data: {
                workspaceId,
                clientId: row.clientId,
                memberId: row.memberId,
                task: row.task,
                hours: row.hours,
                workDate: row.workDate,
                source: "HARVEST",
                harvestEntryId: String(entry.id),
              },
            });
            count += 1;
            send({
              type: "progress",
              imported: count,
              total: importedCount,
              skipped: skippedCount,
            });
          }

          const connection = await tx.harvestConnection.findUnique({
            where: { workspaceId },
            select: { id: true },
          });

          await tx.harvestImport.create({
            data: {
              workspaceId,
              connectionId: connection?.id ?? null,
              status,
              startDate: toUtcDate(body.startDate),
              endDate: toUtcDate(body.endDate),
              importedCount,
              skippedCount,
              failedCount: 0,
              error,
              startedAt,
              finishedAt: new Date(),
            },
          });

          await tx.harvestConnection.update({
            where: { workspaceId },
            data: {
              lastSyncAt: new Date(),
              lastSyncStatus: status,
              lastSyncError: error,
            },
          });
        });

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/time");
        revalidatePath("/dashboard/alerts");
        revalidatePath("/settings/integrations");
        await evaluateAllMarginAlerts(workspaceId);
        await evaluateAllBudgetAlerts(workspaceId);
        await evaluateAllScopeAlerts(workspaceId);

        send({
          type: "done",
          summary: {
            imported: importedCount,
            skipped: skippedCount,
            failed: 0,
            total: selected.length,
            status: skippedCount > 0 ? "PARTIAL" : importedCount > 0 ? "SUCCESS" : "FAILED",
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
          },
          failures,
        });
      } catch {
        try {
          send({
            type: "error",
            message:
              "Something went wrong while importing. No entries were imported.",
          });
        } catch {
          // Client disconnected.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
