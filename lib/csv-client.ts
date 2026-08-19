"use client";

import Papa from "papaparse";
import { buildCsv, MAX_CSV_BYTES, MAX_CSV_ROWS } from "@/lib/csv-core";
import type { ParsedCsv } from "@/lib/csv-core";

export type ParseCsvResult = { parsed?: ParsedCsv; error?: string };

export async function parseCsvFile(file: File): Promise<ParseCsvResult> {
  const isCsv =
    /\.csv$/i.test(file.name) ||
    file.type.includes("csv") ||
    file.type.startsWith("text/");
  if (!isCsv) {
    return { error: "Please upload a .csv file." };
  }
  if (file.size === 0) {
    return { error: "The file is empty." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return {
      error: "The file is too large. Files must be 5 MB or smaller.",
    };
  }

  return new Promise<ParseCsvResult>((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        const delimiterError = result.errors.find(
          (error) => error.code === "UndetectableDelimiter",
        );
        if (delimiterError) {
          resolve({
            error: "Could not detect the CSV delimiter. Check that the file is a valid CSV.",
          });
          return;
        }
        const columns = result.meta.fields ?? [];
        const rows = result.data.map((cells, index) => ({
          rowNumber: index + 2,
          cells,
        }));
        if (rows.length === 0) {
          resolve({ error: "The file doesn't contain any data rows." });
          return;
        }
        if (rows.length > MAX_CSV_ROWS) {
          resolve({
            error: `The file has too many rows. Import ${MAX_CSV_ROWS} or fewer rows.`,
          });
          return;
        }
        resolve({ parsed: { columns, rows } });
      },
      error: () => {
        resolve({ error: "Could not read the CSV file. Try again." });
      },
    });
  });
}

export function downloadCsv(
  filename: string,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): void {
  const blob = new Blob([buildCsv(rows)], {
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