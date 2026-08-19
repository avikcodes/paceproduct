"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { parseCsvFile } from "@/lib/csv-client";
import {
  autoMapColumns,
  validateMappings,
  type MappingIssue,
  type ParsedCsv,
} from "@/lib/csv-core";
import {
  buildImportRows,
  firstRowError,
  isImportableRow,
  type ImportFailure,
  type ImportRefs,
  type ImportRow,
  type ImportSpec,
  type ImportSummary,
  type Mapping,
} from "@/lib/imports/types";
import { importTemplateFromSpec } from "@/lib/imports/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDropzone } from "@/components/import/file-dropzone";
import { TemplateDownloadButton } from "@/components/import/template-download-button";
import { cn } from "@/lib/utils";

type Phase = "idle" | "preview" | "importing" | "done";

type ImportProgress = {
  imported: number;
  total: number;
  skipped: number;
  failed: number;
};

type ImportStreamEvent =
  | {
      type: "progress";
      imported: number;
      total: number;
      skipped: number;
      failed: number;
    }
  | { type: "done"; summary: ImportSummary; failures: ImportFailure[]; entries: unknown[] }
  | { type: "error"; message: string };

type SpecImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: ImportSpec;
  endpoint: string;
  refs: ImportRefs;
  onComplete?: () => void;
};

export function SpecImportDialog({
  open,
  onOpenChange,
  spec,
  endpoint,
  refs,
  onComplete,
}: SpecImportDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [mappingIssues, setMappingIssues] = useState<MappingIssue[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    imported: 0,
    total: 0,
    skipped: 0,
    failed: 0,
  });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const isImporting = phase === "importing";

  const columns = useMemo(() => parsed?.columns ?? [], [parsed]);

  const counts = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    for (const row of rows) {
      if (isImportableRow(row)) {
        valid += 1;
      } else {
        invalid += 1;
      }
    }
    return { valid, invalid, total: rows.length };
  }, [rows]);

  const includedValidCount = useMemo(
    () =>
      rows.filter((row) => included.has(row.fingerprint) && isImportableRow(row))
        .length,
    [rows, included],
  );

  const includedInvalidCount = useMemo(
    () =>
      rows.filter((row) => included.has(row.fingerprint) && !isImportableRow(row))
        .length,
    [rows, included],
  );

  const allMapped =
    mapping !== null &&
    spec.fields.every((field) => Boolean(mapping[field.key]));

  const hasMappingIssues = mappingIssues.length > 0;

  const canImport =
    phase === "preview" &&
    allMapped &&
    !hasMappingIssues &&
    includedValidCount > 0 &&
    includedInvalidCount === 0;

  function resetToIdle() {
    setPhase("idle");
    setFile(null);
    setParsed(null);
    setMapping(null);
    setRows([]);
    setIncluded(new Set());
    setSkipInvalid(true);
    setMappingIssues([]);
    setParseError(null);
    setImportError(null);
  }

  function handleFile(selected: File | undefined) {
    setParseError(null);
    if (!selected) return;

    void parseCsvFile(selected).then((result) => {
      if (result.error) {
        setParseError(result.error);
        return;
      }
      if (!result.parsed) {
        setParseError("Could not read the CSV file. Try again.");
        return;
      }

      const csv = result.parsed;
      const suggested = autoMapColumns(csv.columns, spec.fields);
      const issues = validateMappings(suggested, spec.fields, csv.columns);

      setFile(selected);
      setParsed(csv);
      setMapping(suggested);
      setMappingIssues(issues);
      setSkipInvalid(true);

      if (issues.length > 0) {
        setRows([]);
        setIncluded(new Set());
        setPhase("preview");
        return;
      }

      const validated = buildImportRows(csv, suggested, spec, refs);
      setRows(validated);
      setIncluded(
        new Set(
          validated
            .filter((row) => isImportableRow(row))
            .map((row) => row.fingerprint),
        ),
      );
      setPhase("preview");
    });
  }

  function updateMapping(field: string, column: string | null) {
    if (!parsed || !mapping) return;
    const next = { ...mapping, [field]: column ?? null };
    const issues = validateMappings(next, spec.fields, parsed.columns);
    setMapping(next);
    setMappingIssues(issues);
    if (issues.length > 0) {
      setRows([]);
      setIncluded(new Set());
      return;
    }
    const validated = buildImportRows(parsed, next, spec, refs);
    setRows(validated);
    const nextIncluded = new Set<string>();
    for (const row of validated) {
      if (isImportableRow(row) || !skipInvalid) {
        nextIncluded.add(row.fingerprint);
      }
    }
    setIncluded(nextIncluded);
  }

  function toggleSkipInvalid(next: boolean) {
    setSkipInvalid(next);
    setIncluded((previous) => {
      const updated = new Set(previous);
      for (const row of rows) {
        if (!isImportableRow(row)) {
          if (next) {
            updated.delete(row.fingerprint);
          } else {
            updated.add(row.fingerprint);
          }
        }
      }
      return updated;
    });
  }

  function toggleRow(fingerprint: string) {
    setIncluded((previous) => {
      const next = new Set(previous);
      if (next.has(fingerprint)) {
        next.delete(fingerprint);
      } else {
        next.add(fingerprint);
      }
      return next;
    });
  }

  async function runImport() {
    if (!file || !parsed || !mapping || !canImport) return;

    setPhase("importing");
    setImportError(null);
    setProgress({ imported: 0, total: includedValidCount, skipped: 0, failed: 0 });

    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    form.append("include", JSON.stringify([...included]));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        throw new Error("The import request failed. Please try again.");
      }
      if (!response.body) {
        throw new Error("The import request failed. Please try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let receivedSummary: ImportSummary | null = null;
      let receivedFailures: ImportFailure[] = [];

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ImportStreamEvent;
          if (event.type === "progress") {
            setProgress({
              imported: event.imported,
              total: event.total,
              skipped: event.skipped,
              failed: event.failed,
            });
          } else if (event.type === "done") {
            receivedSummary = event.summary;
            receivedFailures = event.failures;
            finished = true;
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      if (!finished || !receivedSummary) {
        throw new Error("The import ended before it was complete. Please try again.");
      }

      setSummary(receivedSummary);
      setFailures(receivedFailures);
      setPhase("done");
      toast.success(
        receivedSummary.imported === 1
          ? `1 ${spec.entityLabel} imported.`
          : `${receivedSummary.imported} ${spec.entityLabelPlural} imported.`,
      );
      onComplete?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while importing.";
      setImportError(message);
      setPhase("preview");
    }
  }

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.imported / progress.total) * 100)
      : 0;

  const template = importTemplateFromSpec(spec);
  const columnItems = Object.fromEntries(columns.map((column) => [column, column]));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isImporting) onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="p-4">
          <DialogHeader>
            <DialogTitle>
              {phase === "done" ? "Import complete" : spec.title}
            </DialogTitle>
            <DialogDescription>
              {phase === "done"
                ? "Review the results of your CSV import."
                : spec.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {phase === "idle" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    Start with a template
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Download the CSV template, fill it in, then upload it.
                  </span>
                </div>
                <TemplateDownloadButton
                  template={template}
                  className="shrink-0 self-start sm:self-auto"
                />
              </div>

              <FileDropzone onFile={(selected) => handleFile(selected)} />

              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {phase === "preview" && parsed && mapping && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium text-foreground">
                    {file?.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {counts.total} rows
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToIdle}
                  className="shrink-0"
                >
                  <RefreshCw />
                  Change file
                </Button>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">Map columns</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {spec.fields.map((field) => (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <Label htmlFor={`import-${field.key}`}>
                        {field.label}
                        {field.required && (
                          <span className="text-destructive"> *</span>
                        )}
                      </Label>
                      <Select
                        value={mapping[field.key] ?? undefined}
                        onValueChange={(value) =>
                          updateMapping(field.key, value ?? null)
                        }
                        items={columnItems}
                      >
                        <SelectTrigger
                          id={`import-${field.key}`}
                          className="w-full"
                          aria-label={`Column for ${field.label}`}
                        >
                          <SelectValue placeholder="Select a column" />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map((column) => (
                            <SelectItem key={column} value={column}>
                              {column}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {hasMappingIssues && (
                <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                  {mappingIssues.map((issue) => (
                    <span key={issue.field} className="flex items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0" />
                      {issue.message}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{counts.valid} valid</Badge>
                  {counts.invalid > 0 && (
                    <Badge variant="destructive">{counts.invalid} invalid</Badge>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={skipInvalid}
                    onChange={(event) => toggleSkipInvalid(event.target.checked)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Skip invalid rows
                </label>
              </div>

              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-10">Include</TableHead>
                      <TableHead>Row</TableHead>
                      {spec.fields.map((field) => (
                        <TableHead key={field.key}>{field.label}</TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const importable = isImportableRow(row);
                      const selected = included.has(row.fingerprint);
                      const reason = firstRowError(row);
                      return (
                        <TableRow
                          key={row.rowNumber}
                          className={cn(!importable && "bg-destructive/[0.03]")}
                        >
                          <TableCell className="pr-0">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRow(row.fingerprint)}
                              disabled={!importable && skipInvalid}
                              className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Include row ${row.rowNumber}`}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.rowNumber}
                          </TableCell>
                          {spec.fields.map((field) => (
                            <TableCell key={field.key}>
                              <span
                                className={cn(
                                  "line-clamp-2 max-w-[180px]",
                                  importable
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                                )}
                              >
                                {row.values[field.key] || "—"}
                              </span>
                            </TableCell>
                          ))}
                          <TableCell>
                            {importable ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                Ready
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-destructive"
                                title={reason ?? undefined}
                              >
                                <AlertTriangle className="size-3.5 shrink-0" />
                                <span className="line-clamp-2 max-w-[180px]">
                                  {reason}
                                </span>
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {includedInvalidCount > 0 && (
                <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  {includedInvalidCount}{" "}
                  {includedInvalidCount === 1 ? "row is" : "rows are"} selected.
                  Uncheck them or enable “Skip invalid rows” to continue.
                </p>
              )}
              {!allMapped && (
                <p className="text-sm text-muted-foreground">
                  Select a column for every required field before importing.
                </p>
              )}
            </div>
          )}

          {phase === "importing" && (
            <div className="flex flex-col gap-4 py-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    Importing {spec.entityLabelPlural}…
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {progress.imported} of {progress.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {progressPercent}% complete · {progress.skipped} skipped ·{" "}
                  {progress.failed} failed so far
                </p>
              </div>
            </div>
          )}

          {phase === "done" && summary && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
                  <span className="text-xs text-muted-foreground">Imported</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {summary.imported}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
                  <span className="text-xs text-muted-foreground">Skipped</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {summary.skipped}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
                  <span className="text-xs text-muted-foreground">Failed</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {summary.failed}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
                  <span className="text-xs text-muted-foreground">Total rows</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {summary.totalRows}
                  </span>
                </div>
              </div>

              {failures.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">
                    Skipped or failed rows ({failures.length})
                  </p>
                  <ScrollArea className="max-h-48">
                    <ul className="flex flex-col gap-1 rounded-lg border border-border p-2">
                      {failures.map((failure, index) => (
                        <li
                          key={`${failure.rowNumber}-${index}`}
                          className="flex items-start gap-2 px-1 py-0.5 text-sm"
                        >
                          <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                            Row {failure.rowNumber}
                          </span>
                          <span className="text-muted-foreground">
                            {failure.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              ) : (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                  All {summary.totalRows} rows imported successfully.
                </p>
              )}
            </div>
          )}

          {importError && phase === "preview" && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="relative m-0">
          {phase === "idle" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {phase === "preview" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={runImport} disabled={!canImport}>
                <Upload />
                Import {includedValidCount}{" "}
                {includedValidCount === 1 ? spec.entityLabel : spec.entityLabelPlural}
              </Button>
            </>
          )}

          {phase === "importing" && (
            <>
              <Button variant="outline" disabled>
                Cancel
              </Button>
              <Button disabled>
                <Loader2 className="animate-spin" />
                Importing…
              </Button>
            </>
          )}

          {phase === "done" && (
            <Button
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
