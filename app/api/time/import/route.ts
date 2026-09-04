import { revalidatePath } from "next/cache";
import { parse as csvParse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { evaluateAllMarginAlerts } from "@/lib/margin-alerts";
import { evaluateAllBudgetAlerts } from "@/lib/budget-alerts";
import { evaluateAllScopeAlerts } from "@/lib/scope-alerts";
import {
  IMPORT_FIELDS,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  TIME_ENTRY_FIELD_DEFS,
  firstRowError,
  isImportableRow,
  validateImportRows,
  type CsvRow,
  type FieldMapping,
  type ImportedEntry,
  type ImportFailure,
  type ImportRow,
  type ImportSummary,
  type ParsedCsv,
  type TeamMemberNameMapping,
} from "@/lib/time-import";
import { validateMappings } from "@/lib/csv-core";
import {
  timeEntrySelect,
  type ClientOption,
  type MemberOption,
  type TimeEntrySelectPayload,
} from "@/lib/time";
import { getWorkspaceIfHasCapability } from "@/lib/permissions";

const encoder = new TextEncoder();

function jsonLine(data: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(data)}\n`);
}

type RefData = {
  clients: ClientOption[];
  members: MemberOption[];
  clientNameById: Map<string, string>;
  memberById: Map<string, MemberOption>;
};

async function loadRefs(workspaceId: string): Promise<RefData> {
  const [clients, workspaceMembers] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    }),
  ]);

  // TODO: Replace with new auth system's user info lookup
  const memberInfos: MemberOption[] = workspaceMembers.map((member) => ({
    id: member.id,
    name: null,
    email: null,
  }));

  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));
  const memberById = new Map(memberInfos.map((member) => [member.id, member]));
  return { clients, members: memberInfos, clientNameById, memberById };
}

function parseCsv(raw: string): ParsedCsv | null {
  try {
    const records = csvParse<Record<string, string>>(raw, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
    });
    if (!records || records.length === 0) {
      return { columns: [], rows: [] };
    }
    const columns = Object.keys(records[0] ?? {});
    const rows: CsvRow[] = records.map((record, index) => ({
      rowNumber: index + 2,
      cells: record,
    }));
    return { columns, rows };
  } catch {
    return null;
  }
}

function parseMapping(raw: FormDataEntryValue | null): FieldMapping | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const mapping: FieldMapping = {
    client: null,
    member: null,
    task: null,
    hours: null,
    date: null,
  };
  for (const field of IMPORT_FIELDS) {
    const value = record[field];
    if (value === null || value === undefined) {
      mapping[field] = null;
    } else if (typeof value === "string") {
      mapping[field] = value;
    } else {
      return null;
    }
  }
  return mapping;
}

function parseInclude(raw: FormDataEntryValue | null): string[] | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const result: string[] = [];
  for (const value of parsed) {
    if (typeof value !== "string") return null;
    result.push(value);
  }
  return result;
}

function parseMemberMapping(
  raw: FormDataEntryValue | null,
): TeamMemberNameMapping | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const result: TeamMemberNameMapping = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") return null;
    result[key] = value;
  }
  return result;
}

function existingKey(row: ImportRow): string {
  const resolved = row.resolved;
  if (!resolved) return "";
  return [
    resolved.clientId,
    resolved.memberId,
    row.values.task,
    resolved.hours.toFixed(2),
    resolved.workDate.toISOString(),
  ].join("|");
}

async function loadExistingKeys(
  workspaceId: string,
  candidates: ImportRow[],
): Promise<Set<string>> {
  const dates = candidates
    .map((row) => row.resolved?.workDate)
    .filter((date): date is Date => date instanceof Date);

  const where: { workspaceId: string; workDate?: { gte: Date; lte: Date } } = {
    workspaceId,
  };
  if (dates.length > 0) {
    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    where.workDate = { gte: min, lte: max };
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    select: {
      clientId: true,
      memberId: true,
      task: true,
      hours: true,
      workDate: true,
    },
  });
  const keys = new Set<string>();
  for (const entry of entries) {
    keys.add(
      [
        entry.clientId,
        entry.memberId,
        entry.task,
        Number(entry.hours).toFixed(2),
        entry.workDate.toISOString(),
      ].join("|"),
    );
  }
  return keys;
}

function toImportedEntry(
  entry: TimeEntrySelectPayload,
  refs: RefData,
): ImportedEntry {
  const member = refs.memberById.get(entry.memberId);
  return {
    id: entry.id,
    clientId: entry.clientId,
    clientName: refs.clientNameById.get(entry.clientId) ?? entry.client.name,
    memberId: entry.memberId,
    memberName: member?.name ?? "Unnamed member",
    memberEmail: member?.email ?? null,
    task: entry.task,
    hours: entry.hours.toNumber(),
    workDate: entry.workDate.toISOString(),
    source: entry.source,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

const PATHS = [
  "/dashboard",
  "/dashboard/time",
  "/dashboard/activity",
];

async function revalidate(): Promise<void> {
  for (const path of PATHS) {
    revalidatePath(path);
  }
}

export async function POST(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { type: string; [key: string]: unknown }) =>
        controller.enqueue(jsonLine(event));

      try {
        const workspace = await getWorkspaceIfHasCapability("addTimeEntries");
        if (!workspace) {
          send({ type: "error", message: "Unauthorized" });
          return;
        }

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
          send({ type: "error", message: "No CSV file provided." });
          return;
        }

        if (file.size > MAX_CSV_BYTES) {
          send({
            type: "error",
            message: "File is too large. Maximum size is 5 MB.",
          });
          return;
        }

        const mappingRaw = formData.get("mapping");
        const memberMappingRaw = formData.get("memberMapping");
        const includeRaw = formData.get("include");
        if (
          typeof mappingRaw !== "string" ||
          typeof memberMappingRaw !== "string" ||
          typeof includeRaw !== "string"
        ) {
          send({
            type: "error",
            message: "Missing mapping, memberMapping, or include data.",
          });
          return;
        }

        const mapping = parseMapping(mappingRaw);
        if (!mapping) {
          send({ type: "error", message: "Invalid column mapping." });
          return;
        }

        const allFieldsMapped = IMPORT_FIELDS.every(
          (field) => mapping[field] !== null,
        );
        if (!allFieldsMapped) {
          send({
            type: "error",
            message: "All fields must be mapped to a CSV column.",
          });
          return;
        }

        const memberMapping = parseMemberMapping(memberMappingRaw);
        if (!memberMapping) {
          send({ type: "error", message: "Invalid team member mapping." });
          return;
        }

        const includeList = parseInclude(includeRaw);
        if (!includeList) {
          send({ type: "error", message: "Invalid include list." });
          return;
        }

        const csvText = await file.text();
        const parsed = parseCsv(csvText);
        if (!parsed) {
          send({
            type: "error",
            message:
              "Could not parse the CSV file. Check the format and try again.",
          });
          return;
        }

        if (parsed.rows.length === 0) {
          send({ type: "error", message: "The CSV file contains no data rows." });
          return;
        }

        if (parsed.rows.length > MAX_CSV_ROWS) {
          send({
            type: "error",
            message: `File exceeds the maximum of ${MAX_CSV_ROWS} rows.`,
          });
          return;
        }

        const refs = await loadRefs(workspace.workspaceId);
        const rows = validateImportRows(parsed, mapping, refs, memberMapping);

        const includeSet = new Set(includeList);
        const rowsToImport = rows.filter(
          (row) => isImportableRow(row) && includeSet.has(row.fingerprint),
        );

        const total = rowsToImport.length;
        let imported = 0;
        let skipped = 0;
        let failed = 0;

        send({ type: "progress", imported, total, skipped, failed });

        const existingKeys = await loadExistingKeys(
          workspace.workspaceId,
          rowsToImport,
        );

        const failures: ImportFailure[] = [];
        for (const row of rowsToImport) {
          if (!row.resolved) {
            failed++;
            failures.push({
              rowNumber: row.rowNumber,
              message: firstRowError(row) ?? "Row could not be resolved.",
            });
            continue;
          }

          const key = existingKey(row);
          if (existingKeys.has(key)) {
            skipped++;
            failures.push({
              rowNumber: row.rowNumber,
              message:
                "This time entry already exists for the same client, member, task, hours, and date.",
            });
            continue;
          }

          try {
            const entry = await prisma.timeEntry.create({
              data: {
                workspaceId: workspace.workspaceId,
                clientId: row.resolved.clientId,
                memberId: row.resolved.memberId,
                task: row.values.task,
                hours: row.resolved.hours,
                workDate: row.resolved.workDate,
                source: "CSV",
              },
              select: timeEntrySelect,
            });

            const importedEntry = toImportedEntry(entry, refs);
            send({ type: "entry", entry: importedEntry });
            imported++;
          } catch (error) {
            failed++;
            failures.push({
              rowNumber: row.rowNumber,
              message:
                error instanceof Error
                  ? error.message
                  : "Something went wrong.",
            });
          }

          if ((imported + failed) % 5 === 0 || imported + failed === total) {
            send({ type: "progress", imported, total, skipped, failed });
          }
        }

        await revalidate();

        if (imported > 0) {
          const clientIds = [
            ...new Set(
              rowsToImport
                .filter((r) => r.resolved)
                .map((r) => r.resolved!.clientId),
            ),
          ];
          for (const clientId of clientIds) {
            await evaluateAllMarginAlerts(clientId);
            await evaluateAllBudgetAlerts(clientId);
            await evaluateAllScopeAlerts(clientId);
          }
        }

        send({
          type: "done",
          summary: {
            totalRows: rows.length,
            imported,
            invalid: rows.length - rowsToImport.length,
            duplicates: 0,
            dbDuplicates: skipped,
          },
          failures,
          entries: [],
        });
      } catch (error) {
        try {
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Something went wrong while importing. No rows were imported.",
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
