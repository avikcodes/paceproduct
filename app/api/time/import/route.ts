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

export async function POST(request: Request) {
  try {
    // TODO: Get userId from new auth system
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
