import "server-only";
import { auth } from "@clerk/nextjs/server";
import { getWorkspaceMember, roleHasCapability } from "@/lib/permissions";
import type { Capability } from "@/lib/capabilities";
import { parseCsvString } from "@/lib/csv-server";
import {
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  validateMappings,
  type ParsedCsv,
} from "@/lib/csv-core";
import {
  buildImportRows,
  firstRowError,
  isImportableRow,
  parseIncludeJson,
  parseMappingJson,
  type ImportFailure,
  type ImportRefs,
  type ImportRow,
  type ImportSpec,
  type ImportSummary,
  type Mapping,
} from "@/lib/imports/types";

const encoder = new TextEncoder();

function jsonLine(data: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(data)}\n`);
}

type Sender = (event: {
  type: "progress" | "done" | "error";
  [key: string]: unknown;
}) => void;

type ReadImportForm = {
  file: File | null;
  mapping: Mapping | null;
  include: string[] | null;
  parsed: ParsedCsv | null;
  error: string | null;
};

async function readImportForm(
  request: Request,
  spec: ImportSpec,
): Promise<ReadImportForm> {
  const formData = await request.formData();
  const file = formData.get("file");
  const mappingRaw = formData.get("mapping");
  const includeRaw = formData.get("include");

  if (!(file instanceof File)) {
    return { file: null, mapping: null, include: null, parsed: null, error: "No file uploaded." };
  }
  if (file.size === 0) {
    return { file, mapping: null, include: null, parsed: null, error: "The uploaded file is empty." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return {
      file,
      mapping: null,
      include: null,
      parsed: null,
      error: "The file is too large. Files must be 5 MB or smaller.",
    };
  }
  const isCsv =
    /\.csv$/i.test(file.name) ||
    file.type.includes("csv") ||
    file.type.startsWith("text/");
  if (!isCsv) {
    return { file, mapping: null, include: null, parsed: null, error: "Please upload a .csv file." };
  }

  const mapping =
    typeof mappingRaw === "string"
      ? parseMappingJson(mappingRaw, spec.fields)
      : null;
  if (!mapping) {
    return { file, mapping: null, include: null, parsed: null, error: "Invalid column mapping." };
  }

  const include =
    typeof includeRaw === "string" ? parseIncludeJson(includeRaw) : null;
  if (!include) {
    return { file, mapping, include: null, parsed: null, error: "Invalid row selection." };
  }

  const raw = await file.text();
  const parsed = parseCsvString(raw);
  if (!parsed) {
    return { file, mapping, include, parsed: null, error: "Could not read the CSV file. Check that it is a valid CSV." };
  }
  if (parsed.rows.length === 0) {
    return { file, mapping, include, parsed, error: "The file doesn't contain any data rows." };
  }
  if (parsed.rows.length > MAX_CSV_ROWS) {
    return {
      file,
      mapping,
      include,
      parsed,
      error: `The file has too many rows. Import ${MAX_CSV_ROWS} or fewer rows.`,
    };
  }
  const mappingIssues = validateMappings(mapping, spec.fields, parsed.columns);
  if (mappingIssues.length > 0) {
    return {
      file,
      mapping,
      include,
      parsed,
      error: mappingIssues[0].message,
    };
  }

  return { file, mapping, include, parsed, error: null };
}

type ImportRunnerOptions = {
  capability: Capability;
  spec: ImportSpec;
  loadRefs: (workspaceId: string) => Promise<ImportRefs>;
  dedupe: (
    workspaceId: string,
    rows: ImportRow[],
    refs: ImportRefs,
  ) => Promise<Map<string, string>>;
  create: (
    workspaceId: string,
    row: ImportRow,
    user: { userId: string },
  ) => Promise<void>;
  revalidate: (workspaceId: string) => Promise<void>;
};

export function runCsvImport(
  request: Request,
  options: ImportRunnerOptions,
): Response {
  const { capability, spec, loadRefs, dedupe, create, revalidate } = options;

  const stream = new ReadableStream({
    async start(controller) {
      const send: Sender = (event) => controller.enqueue(jsonLine(event));

      try {
        const { userId } = await auth();
        if (!userId) {
          send({ type: "error", message: "Unauthorized" });
          return;
        }

        const workspace = await getWorkspaceMember(userId);
        if (!workspace || !roleHasCapability(workspace.role, capability)) {
          send({ type: "error", message: "Forbidden" });
          return;
        }
        const { workspaceId } = workspace;

        const form = await readImportForm(request, spec);
        if (form.error) {
          send({ type: "error", message: form.error });
          return;
        }
        if (!form.mapping || !form.include || !form.parsed) {
          send({ type: "error", message: "Could not read the CSV file. Try again." });
          return;
        }

        const refs = await loadRefs(workspaceId);
        const rows = buildImportRows(form.parsed, form.mapping, spec, refs);
        const includeSet = new Set(form.include);

        let skipped = 0;
        let failed = 0;
        const failures: ImportFailure[] = [];
        const candidates: ImportRow[] = [];

        for (const row of rows) {
          if (!includeSet.has(row.fingerprint)) continue;
          if (!isImportableRow(row)) {
            skipped += 1;
            failures.push({
              rowNumber: row.rowNumber,
              message: firstRowError(row) ?? "Skipped row.",
            });
            continue;
          }
          candidates.push(row);
        }

        const duplicateMessages = await dedupe(workspaceId, candidates, refs);
        const toImport: ImportRow[] = [];
        for (const row of candidates) {
          const message = duplicateMessages.get(row.fingerprint);
          if (message) {
            failed += 1;
            failures.push({ rowNumber: row.rowNumber, message });
          } else {
            toImport.push(row);
          }
        }

        const total = toImport.length;
        send({
          type: "progress",
          imported: 0,
          total,
          skipped,
          failed,
        });

        if (total === 0) {
          const summary: ImportSummary = {
            totalRows: form.parsed.rows.length,
            imported: 0,
            skipped,
            failed,
          };
          send({ type: "done", summary, failures, entries: [] });
          return;
        }

        let importedCount = 0;
        const failedDuringCreate: ImportFailure[] = [];
        await Promise.all(
          toImport.map(async (row) => {
            try {
              await create(workspaceId, row, { userId: workspace.userId });
              importedCount += 1;
            } catch {
              failedDuringCreate.push({
                rowNumber: row.rowNumber,
                message: "Failed to save this row.",
              });
            }
            send({
              type: "progress",
              imported: importedCount,
              total,
              skipped,
              failed: failed + failedDuringCreate.length,
            });
          }),
        );

        await revalidate(workspaceId);

        const allFailures = [...failures, ...failedDuringCreate];
        const summary: ImportSummary = {
          totalRows: form.parsed.rows.length,
          imported: importedCount,
          skipped,
          failed: allFailures.length - skipped,
        };
        send({ type: "done", summary, failures: allFailures, entries: [] });
      } catch {
        try {
          send({
            type: "error",
            message: "Something went wrong while importing. No rows were imported.",
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