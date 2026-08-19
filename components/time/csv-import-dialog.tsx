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
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  MAX_CSV_ROWS,
  TIME_ENTRY_FIELD_DEFS,
  detectTeamMemberValues,
  firstRowError,
  isImportableRow,
  suggestMapping,
  suggestTeamMemberMapping,
  toTimeEntryRow,
  validateImportRows,
  type FieldMapping,
  type ImportFailure,
  type ImportField,
  type ImportRow,
  type ImportSummary,
  type ImportedEntry,
  type ParsedCsv,
  type TeamMemberNameMapping,
} from "@/lib/time-import";
import { parseCsvFile } from "@/lib/csv-client";
import {
  validateMappings,
  type MappingIssue,
} from "@/lib/csv-core";
import { TIME_ENTRY_TEMPLATE } from "@/lib/imports/templates";
import type { ClientOption, MemberOption, TimeEntryRow } from "@/lib/time";
import { FileDropzone } from "@/components/import/file-dropzone";
import { TemplateDownloadButton } from "@/components/import/template-download-button";
import { TeamMemberMapping } from "@/components/import/team-member-mapping";
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
import { cn } from "@/lib/utils";

type Phase = "idle" | "columns" | "members" | "preview" | "importing" | "done";

type ImportProgress = {
  imported: number;
  total: number;
  skipped: number;
};

type ImportStreamEvent =
  | { type: "progress"; imported: number; total: number; skipped: number }
  | { type: "done"; summary: ImportSummary; failures: ImportFailure[]; entries: ImportedEntry[] }
  | { type: "error"; message: string };

type CsvImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientOption[];
  members: MemberOption[];
  onImported: (entries: TimeEntryRow[]) => void;
};

function FileSummary({
  fileName,
  rowCount,
  onReset,
}: {
  fileName: string | null;
  rowCount: number;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-foreground">
          {fileName}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {rowCount} rows
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="shrink-0"
      >
        <RefreshCw />
        Change file
      </Button>
    </div>
  );
}

export function CsvImportDialog({
  open,
  onOpenChange,
  clients,
  members,
  onImported,
}: CsvImportDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<FieldMapping | null>(null);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [memberMapping, setMemberMapping] = useState<TeamMemberNameMapping>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [mappingIssues, setMappingIssues] = useState<MappingIssue[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    imported: 0,
    total: 0,
    skipped: 0,
  });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const isImporting = phase === "importing";

  const columns = useMemo(() => parsed?.columns ?? [], [parsed]);

  const counts = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    let duplicates = 0;
    for (const row of rows) {
      if (row.duplicateOf !== null) {
        duplicates += 1;
      } else if (row.errors.length > 0) {
        invalid += 1;
      } else {
        valid += 1;
      }
    }
    return { valid, invalid, duplicates, total: rows.length };
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
    mapping !== null && IMPORT_FIELDS.every((field) => Boolean(mapping[field]));

  const hasMappingIssues = mappingIssues.length > 0;

  const canContinueColumns = allMapped && !hasMappingIssues;

  const allMembersMapped = memberNames.every((name) =>
    members.some((member) => member.id === memberMapping[name]),
  );

  const canImport =
    phase === "preview" &&
    includedValidCount > 0 &&
    includedInvalidCount === 0;

  function resetToIdle() {
    setPhase("idle");
    setFile(null);
    setParsed(null);
    setMapping(null);
    setMemberNames([]);
    setMemberMapping({});
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
      const suggested = suggestMapping(csv.columns);
      const issues = validateMappings(suggested, TIME_ENTRY_FIELD_DEFS, csv.columns);

      setFile(selected);
      setParsed(csv);
      setMapping(suggested);
      setMappingIssues(issues);
      setRows([]);
      setIncluded(new Set());
      setPhase("columns");
    });
  }

  function updateMapping(field: ImportField, column: string) {
    if (!parsed || !mapping) return;
    const next = { ...mapping, [field]: column };
    const issues = validateMappings(next, TIME_ENTRY_FIELD_DEFS, parsed.columns);
    setMapping(next);
    setMappingIssues(issues);
  }

  function goToMembers() {
    if (!parsed || !mapping || !canContinueColumns) return;

    const names = detectTeamMemberValues(parsed, mapping);
    const suggested = suggestTeamMemberMapping(names, members);

    const merged: TeamMemberNameMapping = {};
    for (const name of names) {
      const existing = memberMapping[name];
      if (existing && members.some((member) => member.id === existing)) {
        merged[name] = existing;
      } else {
        merged[name] = suggested[name] ?? "";
      }
    }

    setMemberNames(names);
    setMemberMapping(merged);
    setRows([]);
    setIncluded(new Set());
    setPhase("members");
  }

  function updateMemberMapping(next: TeamMemberNameMapping) {
    setMemberMapping(next);
  }

  function goToPreview() {
    if (!parsed || !mapping || !allMembersMapped) return;

    const validated = validateImportRows(parsed, mapping, { clients, members }, memberMapping);
    setRows(validated);
    setIncluded(
      new Set(
        validated
          .filter((row) => isImportableRow(row))
          .map((row) => row.fingerprint),
      ),
    );
    setPhase("preview");
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

  async function readServerError(response: Response): Promise<string> {
    const text = await response.text().catch(() => "");
    const nextData = text.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    )?.[1];
    if (nextData) {
      try {
        const data = JSON.parse(nextData) as { err?: { message?: string } };
        if (data.err?.message) return data.err.message;
      } catch {
        // Not parseable; fall through.
      }
    }
    try {
      const data = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof data.error === "string" && data.error) return data.error;
      if (typeof data.message === "string" && data.message) return data.message;
    } catch {
      // Not JSON; fall through to the raw body.
    }
    if (text.trim()) return text.trim();
    return `The import request failed (HTTP ${response.status}).`;
  }

  async function runImport() {
    if (!file || !parsed || !mapping || !canImport) return;

    setPhase("importing");
    setImportError(null);
    setProgress({ imported: 0, total: includedValidCount, skipped: 0 });

    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    form.append("memberMapping", JSON.stringify(memberMapping));
    form.append("include", JSON.stringify([...included]));

    try {
      const response = await fetch("/api/time/import", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        console.error(`Import failed with status ${response.status}`);
        throw new Error(await readServerError(response));
      }
      if (!response.body) {
        throw new Error("The import request failed: the server returned no response body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let receivedSummary: ImportSummary | null = null;
      let receivedFailures: ImportFailure[] = [];
      let receivedEntries: ImportedEntry[] = [];

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
            });
          } else if (event.type === "done") {
            receivedSummary = event.summary;
            receivedFailures = event.failures;
            receivedEntries = event.entries;
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
      if (receivedEntries.length > 0) {
        onImported(receivedEntries.map(toTimeEntryRow));
      }
      setPhase("done");
      toast.success(
        receivedSummary.imported === 1
          ? "1 time entry imported."
          : `${receivedSummary.imported} time entries imported.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong while importing.";
      setImportError(message);
      setPhase("preview");
    }
  }

  const progressPercent =
    progress.total > 0 ? Math.round((progress.imported / progress.total) * 100) : 0;

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
              {phase === "done" ? "Import complete" : "Import time entries"}
            </DialogTitle>
            <DialogDescription>
              {phase === "done"
                ? "Review the results of your CSV import."
                : "Upload a CSV file and map its columns to create time entries in bulk."}
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
                  template={TIME_ENTRY_TEMPLATE}
                  className="shrink-0 self-start sm:self-auto"
                />
              </div>

              <FileDropzone
                onFile={(selected) => handleFile(selected)}
                hint={`Upload a .csv file up to 5 MB with up to ${MAX_CSV_ROWS} rows`}
              />

              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {(phase === "columns" || phase === "members") && parsed && mapping && (
            <div className="flex flex-col gap-4">
              <FileSummary
                fileName={file?.name ?? null}
                rowCount={parsed.rows.length}
                onReset={resetToIdle}
              />

              {phase === "columns" && (
                <>
                  <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">
                      Map columns
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {IMPORT_FIELDS.map((field) => (
                        <div key={field} className="flex flex-col gap-1.5">
                          <Label htmlFor={`import-${field}`}>
                            {IMPORT_FIELD_LABELS[field]}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={mapping[field] ?? undefined}
                            onValueChange={(value) => updateMapping(field, value ?? "")}
                            items={columnItems}
                          >
                            <SelectTrigger
                              id={`import-${field}`}
                              className="w-full"
                              aria-label={`Column for ${IMPORT_FIELD_LABELS[field]}`}
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

                  {!allMapped && (
                    <p className="text-sm text-muted-foreground">
                      Select a column for every required field before continuing.
                    </p>
                  )}
                </>
              )}

              {phase === "members" && (
                <div className="flex flex-col gap-3">
                  <TeamMemberMapping
                    names={memberNames}
                    members={members}
                    value={memberMapping}
                    onChange={updateMemberMapping}
                  />
                  {!allMembersMapped && (
                    <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-4 shrink-0" />
                      Assign every CSV team member to a workspace member before
                      continuing.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {phase === "preview" && parsed && mapping && (
            <div className="flex flex-col gap-4">
              <FileSummary
                fileName={file?.name ?? null}
                rowCount={parsed.rows.length}
                onReset={resetToIdle}
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{counts.valid} valid</Badge>
                  {counts.invalid > 0 && (
                    <Badge variant="destructive">{counts.invalid} invalid</Badge>
                  )}
                  {counts.duplicates > 0 && (
                    <Badge variant="outline">{counts.duplicates} duplicates</Badge>
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
                      <TableHead>Client</TableHead>
                      <TableHead>Team member</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Date</TableHead>
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
                          <TableCell>
                            <span
                              className={cn(
                                "line-clamp-2 max-w-[160px]",
                                importable
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {row.values.client || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "line-clamp-2 max-w-[160px]",
                                importable
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {row.values.member || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="line-clamp-2 max-w-[220px] text-foreground">
                              {row.values.task || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums text-foreground">
                            {row.values.hours || "—"}
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground">
                              {row.values.date || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {importable ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                Ready
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs",
                                  row.duplicateOf !== null
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-destructive",
                                )}
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
                  {includedInvalidCount} invalid {includedInvalidCount === 1 ? "row is" : "rows are"}{" "}
                  selected. Uncheck them or enable “Skip invalid rows” to continue.
                </p>
              )}
            </div>
          )}

          {phase === "importing" && (
            <div className="flex flex-col gap-4 py-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    Importing time entries…
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
                  {progressPercent}% complete · {progress.skipped} skipped so far
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
                  <span className="text-xs text-muted-foreground">Invalid rows</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {summary.invalid}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
                  <span className="text-xs text-muted-foreground">Duplicates</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {summary.duplicates + summary.dbDuplicates}
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
                    Skipped rows ({failures.length})
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
                          <span className="text-muted-foreground">{failure.message}</span>
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
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </>
          )}

          {phase === "columns" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={goToMembers} disabled={!canContinueColumns}>
                Continue
              </Button>
            </>
          )}

          {phase === "members" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => setPhase("columns")}>
                Back
              </Button>
              <Button onClick={goToPreview} disabled={!allMembersMapped}>
                Continue
              </Button>
            </>
          )}

          {phase === "preview" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => setPhase("members")}>
                Back
              </Button>
              <Button onClick={runImport} disabled={!canImport}>
                <Upload />
                Import {includedValidCount} {includedValidCount === 1 ? "entry" : "entries"}
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
