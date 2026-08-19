export type CsvCell = Record<string, string>;

export type CsvRow = {
  rowNumber: number;
  cells: CsvCell;
};

export type ParsedCsv = {
  columns: string[];
  rows: CsvRow[];
};

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;

export type CsvFieldDef = {
  key: string;
  label: string;
  required?: boolean;
  keywords: string[];
};

export type Mapping = Record<string, string | null>;

export type MappingIssue = {
  field: string;
  message: string;
};

/**
 * Normalizes a CSV header so headers can be compared regardless of casing,
 * spacing, hyphens, underscores, or other punctuation.
 *
 * Examples: "Team Member", "team member", "TEAM_MEMBER", "team-member" and
 * "teamMember" all normalize to "teammember".
 */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Splits a normalized header into individual words so matches can be
 * performed against whole words instead of arbitrary substrings.
 */
function headerWords(header: string): string[] {
  return header
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

export function cellText(cells: CsvCell, column: string): string {
  const raw = cells[column];
  return raw === undefined || raw === null ? "" : String(raw).trim();
}

export function rowFingerprint(columns: string[], row: CsvRow): string {
  return columns
    .map((column) => {
      const value = row.cells[column];
      return value === undefined || value === null ? "" : String(value).trim();
    })
    .join("\u0000");
}

type MatchField = {
  key: string;
  label?: string;
  keywords: readonly string[];
};

/**
 * Maps CSV columns to fields based only on header names.
 *
 * A column is never chosen by its position: each field is matched to the
 * header that best matches one of its keywords. Exact header matches always
 * win over whole-word matches, which always win over substring matches. Each
 * column and each field can be used at most once.
 *
 * Returns a Mapping with an entry for every field; fields that don't match
 * any column are set to null.
 */
export function autoMapColumns(
  columns: readonly string[],
  fields: readonly MatchField[],
): Mapping {
  const mapping: Mapping = {};
  const candidates: { field: string; column: string; score: number }[] = [];

  for (const field of fields) {
    for (const column of columns) {
      const key = normalizeHeader(column);
      const words = headerWords(column);
      let score = 0;
      for (const rawKeyword of field.keywords) {
        const keyword = normalizeHeader(rawKeyword);
        if (!keyword) continue;
        if (key === keyword) {
          score = Math.max(score, 1000 + key.length);
        } else if (words.includes(keyword)) {
          score = Math.max(score, 500 + keyword.length);
        } else if (key.includes(keyword)) {
          score = Math.max(score, 100 + keyword.length);
        }
      }
      if (score > 0) {
        candidates.push({ field: field.key, column, score });
      }
    }
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score || columns.indexOf(a.column) - columns.indexOf(b.column),
  );

  const usedColumns = new Set<string>();
  const usedFields = new Set<string>();
  for (const candidate of candidates) {
    if (usedFields.has(candidate.field) || usedColumns.has(candidate.column)) {
      continue;
    }
    mapping[candidate.field] = candidate.column;
    usedFields.add(candidate.field);
    usedColumns.add(candidate.column);
  }

  for (const field of fields) {
    if (mapping[field.key] === undefined) {
      mapping[field.key] = null;
    }
  }

  return mapping;
}

/**
 * Validates a column mapping before rows are validated.
 *
 * Reports required fields that aren't mapped, mapped columns that don't exist
 * in the file, and columns that are mapped to more than one field. This keeps
 * the import from validating rows against the wrong columns.
 */
export function validateMappings(
  mapping: Mapping | null,
  fields: readonly CsvFieldDef[],
  columns?: readonly string[],
): MappingIssue[] {
  if (!mapping) {
    return fields
      .filter((field) => field.required)
      .map((field) => ({
        field: field.key,
        message: `${field.label} column is not mapped.`,
      }));
  }

  const issues: MappingIssue[] = [];
  const usedColumns = new Set<string>();

  for (const field of fields) {
    const column = mapping[field.key];
    if (!column) {
      if (field.required) {
        issues.push({
          field: field.key,
          message: `${field.label} column is not mapped.`,
        });
      }
      continue;
    }
    if (columns && !columns.includes(column)) {
      issues.push({
        field: field.key,
        message: `Column "${column}" was not found in the file.`,
      });
      continue;
    }
    if (usedColumns.has(column)) {
      issues.push({
        field: field.key,
        message: `The "${column}" column is already mapped to another field.`,
      });
    }
    usedColumns.add(column);
  }

  return issues;
}

function escapeCell(value: string): string {
  const needsQuote = /[",\r\n]/;
  if (!needsQuote.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  const lines = rows.map((row) => row.map(escapeCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
