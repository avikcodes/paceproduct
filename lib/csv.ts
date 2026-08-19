import type { ReportRow } from "@/lib/reports";
import { monthKeyOf } from "@/lib/format";

type CsvCell = string | number | null | undefined;

export const REPORT_CSV_HEADERS = [
  "Client",
  "Revenue",
  "Cost",
  "Profit",
  "Margin %",
  "Hours",
  "Retainer Amount",
  "Scope Hours",
  "Date",
] as const;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(cell: CsvCell): string {
  const text = cell === null || cell === undefined ? "" : String(cell);
  const isFormula = FORMULA_PREFIX.test(text);
  const needsQuote = isFormula || /[",\r\n]/.test(text);
  const value = isFormula ? `'${text}` : text;
  if (needsQuote) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(lines: CsvCell[][]): string {
  return lines.map((cells) => cells.map(escapeCell).join(",")).join("\r\n");
}

export function reportRowsToCsv(rows: ReportRow[]): string {
  const lines: CsvCell[][] = [[...REPORT_CSV_HEADERS]];
  for (const row of rows) {
    lines.push([
      row.clientName,
      row.revenue,
      row.cost,
      row.profit,
      row.marginPercent,
      row.hours,
      row.monthlyBudget,
      row.scopeHours,
      `${monthKeyOf(row.reportMonth)}-01`,
    ]);
  }
  return toCsv(lines);
}

export function reportCsvFilename(label: string): string {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return `pace-reports-${label}-${stamp}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
