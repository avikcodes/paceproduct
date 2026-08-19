import "server-only";
import { parse as csvParse } from "csv-parse/sync";
import type { CsvRow, ParsedCsv } from "@/lib/csv-core";

export function parseCsvString(raw: string): ParsedCsv | null {
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