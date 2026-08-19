import {
  autoMapColumns,
  cellText,
  normalizeHeader,
  rowFingerprint,
  type CsvFieldDef,
} from "@/lib/csv-core";
import type {
  ClientOption,
  MemberOption,
  TimeEntryRow,
} from "@/lib/time";

export const IMPORT_FIELDS = ["client", "member", "task", "hours", "date"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export type FieldMapping = Record<ImportField, string | null>;

/**
 * Maps a unique CSV team member value to an existing workspace member id.
 * Keys are the exact (trimmed) values as they appear in the CSV.
 */
export type TeamMemberNameMapping = Record<string, string>;

export type CsvRow = import("@/lib/csv-core").CsvRow;
export type ParsedCsv = import("@/lib/csv-core").ParsedCsv;

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;

export type ImportRowError = {
  field: ImportField | "row";
  message: string;
};

export type ImportRow = {
  rowNumber: number;
  fingerprint: string;
  values: {
    client: string;
    member: string;
    task: string;
    hours: string;
    date: string;
  };
  resolved: {
    clientId: string;
    memberId: string;
    hours: number;
    workDate: Date;
  } | null;
  errors: ImportRowError[];
  duplicateOf: number | null;
};

export type ImportSummary = {
  totalRows: number;
  imported: number;
  invalid: number;
  duplicates: number;
  dbDuplicates: number;
};

export type ImportFailure = {
  rowNumber: number;
  message: string;
};

export type ImportedEntry = {
  id: string;
  clientId: string;
  clientName: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  task: string;
  hours: number;
  workDate: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  client: "Client",
  member: "Team member",
  task: "Task",
  hours: "Hours",
  date: "Date",
};

const FIELD_HEADER_KEYWORDS: Record<ImportField, string[]> = {
  client: [
    "client",
    "customer",
    "company",
    "account",
    "organisation",
    "organization",
    "org",
  ],
  member: [
    "teammember",
    "member",
    "team",
    "user",
    "employee",
    "person",
    "consultant",
    "assignee",
    "name",
  ],
  task: [
    "task",
    "description",
    "desc",
    "summary",
    "details",
    "detail",
    "project",
    "activity",
    "what",
    "work",
    "note",
  ],
  hours: [
    "hours",
    "hour",
    "hrs",
    "duration",
    "billable",
    "amount",
    "time",
  ],
  date: [
    "workdate",
    "logdate",
    "entrydate",
    "startdate",
    "date",
    "day",
    "when",
  ],
};

export const TIME_ENTRY_FIELD_DEFS: CsvFieldDef[] = IMPORT_FIELDS.map(
  (field) => ({
    key: field,
    label: IMPORT_FIELD_LABELS[field],
    required: true,
    keywords: FIELD_HEADER_KEYWORDS[field],
  }),
);

export function suggestMapping(columns: string[]): FieldMapping {
  const mapping = autoMapColumns(columns, TIME_ENTRY_FIELD_DEFS);
  return {
    client: mapping.client,
    member: mapping.member,
    task: mapping.task,
    hours: mapping.hours,
    date: mapping.date,
  };
}

/**
 * Collects every unique, non-empty value in the mapped team member column, in
 * order of first appearance. These are the values the user maps to workspace
 * members before the import is validated.
 */
export function detectTeamMemberValues(
  parsed: ParsedCsv,
  mapping: FieldMapping,
): string[] {
  const column = mapping.member;
  if (!column) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const row of parsed.rows) {
    const value = cellText(row.cells, column);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

/**
 * Builds the initial team member mapping for an import.
 *
 * Names that exactly match an existing member (by name or email, ignoring
 * casing and punctuation) are mapped automatically. When the workspace has
 * exactly one member, every remaining name is preselected to that member.
 */
export function suggestTeamMemberMapping(
  names: string[],
  members: MemberOption[],
): TeamMemberNameMapping {
  const mapping: TeamMemberNameMapping = {};
  const memberByKey = new Map<string, MemberOption>();
  for (const member of members) {
    if (member.name) memberByKey.set(normalizeHeader(member.name), member);
    if (member.email) memberByKey.set(normalizeHeader(member.email), member);
  }

  const singleMember = members.length === 1 ? members[0] : null;
  for (const name of names) {
    const exact = memberByKey.get(normalizeHeader(name));
    if (exact) {
      mapping[name] = exact.id;
    } else if (singleMember) {
      mapping[name] = singleMember.id;
    }
  }
  return mapping;
}

function buildDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function parseCsvDate(value: string): Date | null {
  const input = value.trim();
  if (!input) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slashDash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(input);
  if (slashDash) return buildDate(Number(slashDash[3]), Number(slashDash[1]), Number(slashDash[2]));

  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(input);
  if (dotted) return buildDate(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));

  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  return null;
}

export function parseCsvHours(value: string): number | null {
  const input = value.trim().replace(/\s+/g, "");
  if (!input) return null;
  const normalized = input.replace(/,/g, ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const hours = Number(normalized);
  return Number.isFinite(hours) ? hours : null;
}

function cellValue(
  row: CsvRow,
  mapping: FieldMapping,
  field: ImportField,
): string {
  const column = mapping[field];
  return column ? cellText(row.cells, column) : "";
}

export function validateImportRows(
  parsed: ParsedCsv,
  mapping: FieldMapping,
  refs: { clients: ClientOption[]; members: MemberOption[] },
  memberMapping: TeamMemberNameMapping,
): ImportRow[] {
  const clientByName = new Map<string, ClientOption>();
  for (const client of refs.clients) {
    clientByName.set(normalizeHeader(client.name), client);
  }

  const memberById = new Map<string, MemberOption>();
  for (const member of refs.members) {
    memberById.set(member.id, member);
  }

  const seen = new Map<string, number>();

  return parsed.rows.map((row) => {
    const values = {
      client: cellValue(row, mapping, "client"),
      member: cellValue(row, mapping, "member"),
      task: cellValue(row, mapping, "task"),
      hours: cellValue(row, mapping, "hours"),
      date: cellValue(row, mapping, "date"),
    };

    const errors: ImportRowError[] = [];
    let resolved: ImportRow["resolved"] = null;

    const clientMatch = clientByName.get(normalizeHeader(values.client));
    const memberMatch = values.member
      ? memberById.get(memberMapping[values.member] ?? "")
      : undefined;
    const hoursValue = parseCsvHours(values.hours);
    const dateValue = parseCsvDate(values.date);

    if (!values.client) {
      errors.push({ field: "client", message: "Client is required." });
    } else if (!clientMatch) {
      errors.push({
        field: "client",
        message: `No client found for "${values.client}".`,
      });
    }

    if (!values.member) {
      errors.push({ field: "member", message: "Team member is required." });
    } else if (!memberMatch) {
      errors.push({
        field: "member",
        message: `Team member "${values.member}" is not mapped to a workspace member.`,
      });
    }

    if (!values.task) {
      errors.push({ field: "task", message: "Task is required." });
    } else if (values.task.length > 300) {
      errors.push({ field: "task", message: "Task must be 300 characters or fewer." });
    }

    if (!values.hours) {
      errors.push({ field: "hours", message: "Hours are required." });
    } else if (hoursValue === null) {
      errors.push({ field: "hours", message: "Enter a valid number of hours." });
    } else if (hoursValue <= 0) {
      errors.push({ field: "hours", message: "Hours must be greater than 0." });
    } else if (hoursValue > 24) {
      errors.push({ field: "hours", message: "Hours must be 24 or fewer." });
    }

    if (!values.date) {
      errors.push({ field: "date", message: "Work date is required." });
    } else if (!dateValue) {
      errors.push({ field: "date", message: "Enter a valid date (e.g. 2025-01-31)." });
    }

    let duplicateOf: number | null = null;
    if (
      errors.length === 0 &&
      clientMatch &&
      memberMatch &&
      hoursValue !== null &&
      dateValue
    ) {
      resolved = {
        clientId: clientMatch.id,
        memberId: memberMatch.id,
        hours: hoursValue,
        workDate: dateValue,
      };
      const key = [
        resolved.clientId,
        resolved.memberId,
        values.task,
        hoursValue,
        dateValue.toISOString(),
      ].join("|");
      const existing = seen.get(key);
      if (existing !== undefined) {
        duplicateOf = existing;
        errors.push({ field: "row", message: `Duplicate of row ${existing}.` });
      } else {
        seen.set(key, row.rowNumber);
      }
    }

    return {
      rowNumber: row.rowNumber,
      fingerprint: rowFingerprint(parsed.columns, row),
      values,
      resolved,
      errors,
      duplicateOf,
    };
  });
}

export function isImportableRow(row: ImportRow): boolean {
  return row.errors.length === 0 && row.duplicateOf === null && row.resolved !== null;
}

export function firstRowError(row: ImportRow): string | null {
  return row.errors[0]?.message ?? null;
}

export function toTimeEntryRow(entry: ImportedEntry): TimeEntryRow {
  return {
    id: entry.id,
    clientId: entry.clientId,
    clientName: entry.clientName,
    memberId: entry.memberId,
    memberName: entry.memberName,
    memberEmail: entry.memberEmail,
    task: entry.task,
    hours: entry.hours,
    workDate: new Date(entry.workDate),
    source: entry.source as TimeEntryRow["source"],
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  };
}

export { normalizeHeader, rowFingerprint } from "@/lib/csv-core";
