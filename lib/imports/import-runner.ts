import "server-only";
import { parseCsvString } from "@/lib/csv-server";
import {
  buildImportRows,
  isImportableRow,
  parseMappingJson,
  parseIncludeJson,
  type ImportRefs,
  type ImportRow,
  type ImportSpec,
  type Mapping,
} from "@/lib/imports/types";
import { getWorkspaceIfHasCapability, type Capability } from "@/lib/permissions";

const encoder = new TextEncoder();

function jsonLine(data: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(data)}\n`);
}

type Sender = (event: {
  type: "progress" | "done" | "error";
  [key: string]: unknown;
}) => void;

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
  revalidate: () => Promise<void>;
  afterImport?: (workspaceId: string) => Promise<void>;
};

export function runCsvImport(
  _request: Request,
  options: ImportRunnerOptions,
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const send: Sender = (event) => controller.enqueue(jsonLine(event));

      try {
        const workspace = await getWorkspaceIfHasCapability(options.capability);
        if (!workspace) {
          send({ type: "error", message: "Unauthorized" });
          return;
        }

        const formData = await _request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
          send({ type: "error", message: "No CSV file provided." });
          return;
        }

        const mappingRaw = formData.get("mapping");
        const includeRaw = formData.get("include");
        if (typeof mappingRaw !== "string" || typeof includeRaw !== "string") {
          send({
            type: "error",
            message: "Missing mapping or include data.",
          });
          return;
        }

        const mapping = parseMappingJson(mappingRaw, options.spec.fields);
        if (!mapping) {
          send({ type: "error", message: "Invalid column mapping." });
          return;
        }

        const includeSet = parseIncludeJson(includeRaw);
        if (!includeSet) {
          send({ type: "error", message: "Invalid include list." });
          return;
        }

        const csvText = await file.text();
        const parsed = parseCsvString(csvText);
        if (!parsed) {
          send({
            type: "error",
            message:
              "Could not parse the CSV file. Check the format and try again.",
          });
          return;
        }

        const refs = await options.loadRefs(workspace.workspaceId);

        const allRows = buildImportRows(parsed, mapping, options.spec, refs);

        const dedupeFailures = await options.dedupe(
          workspace.workspaceId,
          allRows,
          refs,
        );

        const rowsToImport = allRows.filter((row) => {
          if (!isImportableRow(row)) return false;
          if (!includeSet.includes(row.fingerprint)) return false;
          if (dedupeFailures.has(row.fingerprint)) return false;
          return true;
        });

        const total = rowsToImport.length;
        let imported = 0;
        let skipped = 0;
        let failed = 0;

        send({ type: "progress", imported, total, skipped, failed });

        const failures: { rowNumber: number; message: string }[] = [];
        for (const row of rowsToImport) {
          const dedupeError = dedupeFailures.get(row.fingerprint);
          if (dedupeError) {
            skipped++;
            failures.push({ rowNumber: row.rowNumber, message: dedupeError });
            continue;
          }

          try {
            await options.create(
              workspace.workspaceId,
              row,
              { userId: workspace.userId },
            );
            imported++;
          } catch (error) {
            failed++;
            failures.push({
              rowNumber: row.rowNumber,
              message:
                error instanceof Error
                  ? error.message
                  : "Something went wrong.",
            });
          }

          if ((imported + failed) % 5 === 0 || imported + failed === total) {
            send({ type: "progress", imported, total, skipped, failed });
          }
        }

        await options.revalidate();

        if (options.afterImport) {
          await options.afterImport(workspace.workspaceId);
        }

        send({
          type: "done",
          summary: { totalRows: total, imported, skipped, failed },
          failures,
          entries: [],
        });
      } catch (error) {
        try {
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Something went wrong while importing. No rows were imported.",
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
