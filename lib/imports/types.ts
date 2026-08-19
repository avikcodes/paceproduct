import {
  cellText,
  rowFingerprint,
  type CsvCell,
  type ParsedCsv,
} from "@/lib/csv-core";
import {
  buildTemplateCsv as buildTemplateCsvFromTemplate,
  templateDownloadName as templateDownloadNameFromTemplate,
} from "@/lib/imports/templates";

export type ImportFieldError = {
  field: string;
  message: string;
};

export type ResolvedValue = string | number | boolean | null;

export type ImportRow = {
  rowNumber: number;
  fingerprint: string;
  cells: CsvCell;
  values: Record<string, string>;
  resolved: Record<string, ResolvedValue> | null;
  errors: ImportFieldError[];
};

export type ImportFieldDef = {
  key: string;
  label: string;
  required: boolean;
  keywords: string[];
};

export type ImportRefs = {
  clients?: Array<{ id: string; name: string }>;
  existingClientNames?: string[];
  existingEmails?: string[];
  existingActiveClients?: string[];
};

export type ImportValidation = {
  resolved: Record<string, ResolvedValue> | null;
  errors: ImportFieldError[];
};

/**
 * Normalizes a client name for comparison: trims surrounding whitespace,
 * collapses internal whitespace runs to a single space, and lowercases.
 * Used so imported client/retainer rows match regardless of casing or
 * hidden whitespace on either the CSV value or the stored record.
 */
export function normalizeClientName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export type ImportSpec = {
  kind: string;
  entityLabel: string;
  entityLabelPlural: string;
  title: string;
  description: string;
  templateFilename: string;
  templateColumns: string[];
  templateSample: string[];
  fields: ImportFieldDef[];
  validate: (values: Record<string, string>, refs: ImportRefs) => ImportValidation;
};

export type ImportSummary = {
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
};

export type ImportFailure = {
  rowNumber: number;
  message: string;
};

export type Mapping = Record<string, string | null>;

export function parseMappingJson(
  raw: string,
  fields: ImportFieldDef[],
): Mapping | null {
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
  const mapping: Mapping = {};
  for (const field of fields) {
    const value = record[field.key];
    if (typeof value === "string" && value.length > 0) {
      mapping[field.key] = value;
    } else {
      mapping[field.key] = null;
    }
  }
  return mapping;
}

export function parseIncludeJson(raw: string): string[] | null {
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

export function buildImportRows(
  parsed: ParsedCsv,
  mapping: Mapping,
  spec: ImportSpec,
  refs: ImportRefs,
): ImportRow[] {
  return parsed.rows.map((row) => {
    const values: Record<string, string> = {};
    for (const field of spec.fields) {
      const column = mapping[field.key];
      values[field.key] = column ? cellText(row.cells, column) : "";
    }
    const { resolved, errors } = spec.validate(values, refs);
    return {
      rowNumber: row.rowNumber,
      fingerprint: rowFingerprint(parsed.columns, row),
      cells: row.cells,
      values,
      resolved,
      errors,
    };
  });
}

export function isImportableRow(row: ImportRow): boolean {
  return row.errors.length === 0 && row.resolved !== null;
}

export function firstRowError(row: ImportRow): string | null {
  return row.errors[0]?.message ?? null;
}

export function buildTemplateCsv(spec: ImportSpec): string {
  return buildTemplateCsvFromTemplate({
    filename: spec.templateFilename,
    columns: spec.templateColumns,
    sample: spec.templateSample,
  });
}

export function templateDownloadName(spec: ImportSpec): string {
  return templateDownloadNameFromTemplate({
    filename: spec.templateFilename,
    columns: spec.templateColumns,
    sample: spec.templateSample,
  });
}