import { buildCsv } from "@/lib/csv-core";
import type { ImportSpec } from "@/lib/imports/types";

export type ImportTemplate = {
  filename: string;
  columns: string[];
  sample: string[];
};

export function buildTemplateCsv(template: ImportTemplate): string {
  const rows: string[][] = [template.columns];
  if (template.sample.length > 0) {
    rows.push(template.sample);
  }
  return buildCsv(rows);
}

export function templateDownloadName(template: ImportTemplate): string {
  return template.filename;
}

export function importTemplateFromSpec(spec: ImportSpec): ImportTemplate {
  return {
    filename: spec.templateFilename,
    columns: spec.templateColumns,
    sample: spec.templateSample,
  };
}

export const TIME_ENTRY_TEMPLATE: ImportTemplate = {
  filename: "pace-time-entries-template.csv",
  columns: ["Client", "Team Member", "Task", "Hours", "Work Date"],
  sample: ["Acme Corp", "Jane Doe", "Website design", "8", "2026-01-15"],
};
