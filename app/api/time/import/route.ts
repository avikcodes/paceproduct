import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { parse as csvParse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { getWorkspaceMember, roleHasCapability } from "@/lib/permissions";
import { getClerkUserInfos } from "@/lib/clerk-users";
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

  const userInfos = await getClerkUserInfos(
    workspaceMembers.map((member) => member.userId),
  );
  const memberInfos: MemberOption[] = workspaceMembers.map((member) => {
    const info = userInfos.get(member.userId);
    return {
      id: member.id,
      name: info?.name ?? null,
      email: info?.email ?? null,
    };
  });

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

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getWorkspaceMember(userId);
    if (!workspace || !roleHasCapability(workspace.role, "addTimeEntries")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { workspaceId } = workspace;

    const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(jsonLine(data));

      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const mappingRaw = formData.get("mapping");
        const memberMappingRaw = formData.get("memberMapping");
        const includeRaw = formData.get("include");

        if (!(file instanceof File)) {
          send({ type: "error", message: "No file uploaded." });
          return;
        }
        if (file.size === 0) {
          send({ type: "error", message: "The uploaded file is empty." });
          return;
        }
        if (file.size > MAX_CSV_BYTES) {
          send({
            type: "error",
            message: "The file is too large. Files must be 5 MB or smaller.",
          });
          return;
        }
        const isCsv =
          /\.csv$/i.test(file.name) ||
          file.type.includes("csv") ||
          file.type.startsWith("text/");
        if (!isCsv) {
          send({ type: "error", message: "Please upload a .csv file." });
          return;
        }

        const mapping = parseMapping(mappingRaw);
        if (!mapping) {
          send({ type: "error", message: "Invalid column mapping." });
          return;
        }

        const include = parseInclude(includeRaw);
        if (!include) {
          send({ type: "error", message: "Invalid row selection." });
          return;
        }

        const memberMapping = parseMemberMapping(memberMappingRaw);
        if (!memberMapping) {
          send({ type: "error", message: "Invalid team member mapping." });
          return;
        }

        const raw = await file.text();
        const parsed = parseCsv(raw);
        if (!parsed) {
          send({
            type: "error",
            message: "Could not read the CSV file. Check that it is a valid CSV.",
          });
          return;
        }
        if (parsed.rows.length === 0) {
          send({
            type: "error",
            message: "The file doesn't contain any data rows.",
          });
          return;
        }
        if (parsed.rows.length > MAX_CSV_ROWS) {
          send({
            type: "error",
            message: `The file has too many rows. Import ${MAX_CSV_ROWS} or fewer rows.`,
          });
          return;
        }

        for (const field of IMPORT_FIELDS) {
          const column = mapping[field];
          if (column && !parsed.columns.includes(column)) {
            send({
              type: "error",
              message: `Column "${column}" was not found in the file.`,
            });
            return;
          }
        }
        const mappingIssues = validateMappings(
          mapping,
          TIME_ENTRY_FIELD_DEFS,
          parsed.columns,
        );
        if (mappingIssues.length > 0) {
          send({ type: "error", message: mappingIssues[0].message });
          return;
        }

        const refs = await loadRefs(workspaceId);
        const rows = validateImportRows(parsed, mapping, refs, memberMapping);

        const includeSet = new Set(include);
        let invalidSkipped = 0;
        let duplicateSkipped = 0;
        let dbDuplicateSkipped = 0;
        const failures: ImportFailure[] = [];
        const candidates: ImportRow[] = [];

        for (const row of rows) {
          if (!includeSet.has(row.fingerprint)) continue;
          if (!isImportableRow(row)) {
            if (row.duplicateOf !== null) {
              duplicateSkipped += 1;
            } else {
              invalidSkipped += 1;
            }
            failures.push({
              rowNumber: row.rowNumber,
              message: firstRowError(row) ?? "Skipped row.",
            });
            continue;
          }
          candidates.push(row);
        }

        const existingKeys = await loadExistingKeys(workspaceId, candidates);
        const toImport: ImportRow[] = [];
        for (const row of candidates) {
          const key = existingKey(row);
          if (existingKeys.has(key)) {
            dbDuplicateSkipped += 1;
            failures.push({
              rowNumber: row.rowNumber,
              message: "This entry already exists.",
            });
          } else {
            toImport.push(row);
          }
        }

        const total = toImport.length;
        send({
          type: "progress",
          imported: 0,
          total,
          skipped: invalidSkipped + duplicateSkipped + dbDuplicateSkipped,
          failed: 0,
        });

        if (total === 0) {
          const summary: ImportSummary = {
            totalRows: parsed.rows.length,
            imported: 0,
            invalid: rows.filter(
              (row) => row.duplicateOf === null && row.errors.length > 0,
            ).length,
            duplicates: rows.filter((row) => row.duplicateOf !== null).length,
            dbDuplicates: dbDuplicateSkipped,
          };
          send({ type: "done", summary, failures, entries: [] });
          return;
        }

        const resolvedRows = toImport.filter(
          (row): row is ImportRow & { resolved: NonNullable<ImportRow["resolved"]> } =>
            row.resolved !== null,
        );

        const payload = resolvedRows.map((row) => ({
          workspaceId,
          clientId: row.resolved.clientId,
          memberId: row.resolved.memberId,
          task: row.values.task,
          hours: row.resolved.hours,
          workDate: row.resolved.workDate,
          source: "CSV" as const,
        }));

        const created = await prisma.timeEntry.createManyAndReturn({
          data: payload,
          select: timeEntrySelect,
        });
        const imported = created.map((entry) => toImportedEntry(entry, refs));

        send({
          type: "progress",
          imported: imported.length,
          total,
          skipped: invalidSkipped + duplicateSkipped + dbDuplicateSkipped,
          failed: 0,
        });

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/time");
        revalidatePath("/dashboard/alerts");
        revalidatePath("/dashboard/insights");
        await evaluateAllMarginAlerts(workspaceId);
        await evaluateAllBudgetAlerts(workspaceId);
        await evaluateAllScopeAlerts(workspaceId);

        const summary: ImportSummary = {
          totalRows: parsed.rows.length,
          imported: imported.length,
          invalid: rows.filter(
            (row) => row.duplicateOf === null && row.errors.length > 0,
          ).length,
          duplicates: rows.filter((row) => row.duplicateOf !== null).length,
          dbDuplicates: dbDuplicateSkipped,
        };
        send({ type: "done", summary, failures, entries: imported });
      } catch (error) {
        console.error(error);
        try {
          send({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
            code: (error as { code?: string })?.code ?? null,
            stack: error instanceof Error ? error.stack : null,
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
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      },
      { status: 500 },
    );
  }
}
