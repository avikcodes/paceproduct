"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  PlugZap,
} from "lucide-react";
import {
  fetchHarvestPreview,
  type HarvestImportSummary,
  type HarvestPreview,
  type HarvestPreviewRow,
} from "@/app/(app)/settings/integrations/harvest-actions";
import type { ClientOption, MemberOption } from "@/lib/time";
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
import { Input } from "@/components/ui/input";
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

type Phase = "dates" | "preview" | "importing" | "done";

type DerivedRow = HarvestPreviewRow & {
  clientName: string | null;
  memberName: string | null;
  importable: boolean;
};

type SkippedRow = {
  entryId: number;
  message: string;
};

type ImportProgress = {
  imported: number;
  total: number;
  skipped: number;
};

type ImportStreamEvent =
  | { type: "progress"; imported: number; total: number; skipped: number }
  | {
      type: "done";
      summary: HarvestImportSummary;
      failures: SkippedRow[];
    }
  | { type: "error"; message: string };

type HarvestImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientOption[];
  members: MemberOption[];
};

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function HarvestImportDialog({
  open,
  onOpenChange,
  clients,
  members,
}: HarvestImportDialogProps) {
  const [phase, setPhase] = useState<Phase>("dates");
  const [startDate, setStartDate] = useState(() => daysAgoIso(30));
  const [endDate, setEndDate] = useState(() => todayIso());
  const [preview, setPreview] = useState<HarvestPreview | null>(null);
  const [projectToClient, setProjectToClient] = useState<Record<string, string>>({});
  const [userToMember, setUserToMember] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    imported: 0,
    total: 0,
    skipped: 0,
  });
  const [summary, setSummary] = useState<HarvestImportSummary | null>(null);
  const [skipped, setSkipped] = useState<SkippedRow[]>([]);

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients],
  );
  const memberNameById = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          member.name ?? member.email ?? "Unnamed member",
        ]),
      ),
    [members],
  );

  const datesValid =
    Boolean(startDate) && Boolean(endDate) && startDate <= endDate;

  const derivedRows = useMemo<DerivedRow[]>(() => {
    if (!preview) return [];
    return preview.rows.map((row) => {
      const clientOverride =
        row.projectId !== null ? projectToClient[String(row.projectId)] : undefined;
      const clientId = clientOverride ?? row.clientId;
      const clientName = clientId ? clientNameById.get(clientId) ?? null : null;

      const memberOverride =
        row.userId !== null ? userToMember[String(row.userId)] : undefined;
      const memberId = memberOverride ?? row.memberId;
      const memberName = memberId ? memberNameById.get(memberId) ?? null : null;

      if (row.duplicate) {
        return {
          ...row,
          clientId,
          clientName,
          memberId,
          memberName,
          error: row.error ?? "Already imported",
          importable: false,
        };
      }
      if (row.errorKind === "other") {
        return {
          ...row,
          clientId,
          clientName,
          memberId,
          memberName,
          error: row.error,
          importable: false,
        };
      }
      if (!clientId) {
        return {
          ...row,
          clientId: null,
          clientName: null,
          memberId,
          memberName,
          error: row.error ?? "Map the project to a client.",
          importable: false,
        };
      }
      if (!memberId) {
        return {
          ...row,
          clientId,
          clientName,
          memberId: null,
          memberName: null,
          error: row.error ?? "Map the user to a team member.",
          importable: false,
        };
      }
      return {
        ...row,
        clientId,
        clientName,
        memberId,
        memberName,
        error: null,
        importable: true,
      };
    });
  }, [preview, projectToClient, userToMember, clientNameById, memberNameById]);

  const selectedImportableCount = useMemo(
    () => derivedRows.filter((row) => selected.has(row.entryId) && row.importable).length,
    [derivedRows, selected],
  );

  const projectsWithRows = useMemo(() => {
    if (!preview) return [];
    const projectIds = new Set<number>();
    for (const row of preview.rows) {
      if (row.projectId !== null) projectIds.add(row.projectId);
    }
    return preview.projects.filter((project) => projectIds.has(project.id));
  }, [preview]);

  const usersWithRows = useMemo(() => {
    if (!preview) return [];
    const userIds = new Set<number>();
    for (const row of preview.rows) {
      if (row.userId !== null) userIds.add(row.userId);
    }
    return preview.users.filter((user) => userIds.has(user.id));
  }, [preview]);

  function reset() {
    setPhase("dates");
    setPreview(null);
    setProjectToClient({});
    setUserToMember({});
    setSelected(new Set());
    setPreviewError(null);
    setImportError(null);
    setSummary(null);
    setSkipped([]);
    setProgress({ imported: 0, total: 0, skipped: 0 });
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handlePreview() {
    if (!datesValid) return;
    setPreviewError(null);
    setLoading(true);
    const result = await fetchHarvestPreview(startDate, endDate);
    setLoading(false);
    if (!result.ok) {
      setPreviewError(result.error);
      return;
    }
    const next = result.data;
    setPreview(next);

    const projectMapping: Record<string, string> = {};
    for (const project of next.projects) {
      if (project.clientId) projectMapping[String(project.id)] = project.clientId;
    }
    setProjectToClient(projectMapping);

    const userMapping: Record<string, string> = {};
    for (const user of next.users) {
      if (user.memberId) userMapping[String(user.id)] = user.memberId;
    }
    setUserToMember(userMapping);

    const initial = new Set<number>();
    for (const row of next.rows) {
      if (!row.duplicate && !row.error) initial.add(row.entryId);
    }
    setSelected(initial);
    setPhase("preview");
  }

  function updateProjectClient(projectId: number, clientId: string) {
    setProjectToClient((previous) => {
      const next = { ...previous };
      if (clientId) {
        next[String(projectId)] = clientId;
      } else {
        delete next[String(projectId)];
      }
      return next;
    });
  }

  function updateUserMember(userId: number, memberId: string) {
    setUserToMember((previous) => {
      const next = { ...previous };
      if (memberId) {
        next[String(userId)] = memberId;
      } else {
        delete next[String(userId)];
      }
      return next;
    });
  }

  function toggleRow(entryId: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  async function handleImport() {
    if (!preview || selectedImportableCount === 0) return;

    setImportError(null);
    setPhase("importing");
    setProgress({
      imported: 0,
      total: selectedImportableCount,
      skipped: 0,
    });

    try {
      const response = await fetch("/api/harvest/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          entryIds: [...selected],
          projectToClient,
          userToMember,
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error("The import request failed. Please try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let receivedSummary: HarvestImportSummary | null = null;
      let receivedFailures: SkippedRow[] = [];

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
      setSkipped(receivedFailures);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="p-4">
          <DialogHeader>
            <DialogTitle>
              {phase === "done" ? "Import complete" : "Import Harvest entries"}
            </DialogTitle>
            <DialogDescription>
              {phase === "done"
                ? "Review the results of your Harvest import."
                : "Choose a date range, map projects to clients and users to team members, then import tracked time."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {phase === "dates" && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="harvest-start">From</Label>
                  <Input
                    id="harvest-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="harvest-end">To</Label>
                  <Input
                    id="harvest-end"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                <CalendarDays className="mt-0.5 size-4 shrink-0" />
                <span>
                  Entries import as <span className="font-medium text-foreground">hours</span>,{" "}
                  <span className="font-medium text-foreground">tasks</span> (from the
                  notes), and <span className="font-medium text-foreground">dates</span>{" "}
                  (from the entry&apos;s spent date). Each Harvest project is matched to a
                  client and each Harvest user to a team member by email.
                </span>
              </div>

              {previewError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}
            </div>
          )}

          {phase === "preview" && preview && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {startDate} → {endDate}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{preview.totalEntries} total</Badge>
                  <Badge>{preview.importable} ready</Badge>
                  {preview.skipped > 0 && (
                    <Badge variant="outline">{preview.skipped} skipped</Badge>
                  )}
                </div>
              </div>

              {projectsWithRows.length > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    Map projects to clients
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {projectsWithRows.map((project) => (
                      <div key={project.id} className="flex flex-col gap-1.5">
                        <Label htmlFor={`harvest-project-${project.id}`} className="truncate">
                          {project.name}
                          {project.clientName && !project.autoMatched && (
                            <span className="text-muted-foreground"> (auto)</span>
                          )}
                        </Label>
                        <Select
                          value={projectToClient[String(project.id)] ?? ""}
                          onValueChange={(value) =>
                            updateProjectClient(project.id, value ?? "")
                          }
                        >
                          <SelectTrigger
                            id={`harvest-project-${project.id}`}
                            size="sm"
                            className="w-full"
                            aria-label={`Client for project ${project.name}`}
                          >
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {usersWithRows.length > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    Map users to team members
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {usersWithRows.map((user) => (
                      <div key={user.id} className="flex flex-col gap-1.5">
                        <Label htmlFor={`harvest-user-${user.id}`} className="truncate">
                          {user.name}
                          {user.autoMatched && (
                            <span className="text-muted-foreground"> (auto)</span>
                          )}
                        </Label>
                        <Select
                          value={userToMember[String(user.id)] ?? ""}
                          onValueChange={(value) =>
                            updateUserMember(user.id, value ?? "")
                          }
                        >
                          <SelectTrigger
                            id={`harvest-user-${user.id}`}
                            size="sm"
                            className="w-full"
                            aria-label={`Team member for ${user.name}`}
                          >
                            <SelectValue placeholder="Select a member" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name ?? member.email ?? "Unnamed member"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-10">Include</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {derivedRows.map((row) => {
                      const checked = selected.has(row.entryId);
                      return (
                        <TableRow
                          key={row.entryId}
                          className={cn(!row.importable && "bg-destructive/[0.03]")}
                        >
                          <TableCell className="pr-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRow(row.entryId)}
                              disabled={!row.importable}
                              className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Include entry ${row.task}`}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.date.slice(0, 10)}
                          </TableCell>
                          <TableCell>
                            <span className="line-clamp-2 max-w-[200px] text-foreground">
                              {row.task}
                            </span>
                            {row.projectName && (
                              <span className="block text-xs text-muted-foreground">
                                {row.projectName}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "line-clamp-2 max-w-[140px]",
                                row.importable
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {row.clientName || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "line-clamp-2 max-w-[140px]",
                                row.importable
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {row.memberName || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums text-foreground">
                            {row.hours}
                          </TableCell>
                          <TableCell>
                            {row.importable ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                Ready
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs",
                                  row.duplicate
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-destructive",
                                )}
                                title={row.error ?? undefined}
                              >
                                <AlertTriangle className="size-3.5 shrink-0" />
                                <span className="line-clamp-2 max-w-[160px]">
                                  {row.error}
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

              {importError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{importError}</span>
                </div>
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
              <div className="grid gap-3 sm:grid-cols-3">
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
                  <span className="text-xs text-muted-foreground">Total selected</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {summary.total}
                  </span>
                </div>
              </div>

              {skipped.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">
                    Skipped entries ({skipped.length})
                  </p>
                  <ScrollArea className="max-h-48">
                    <ul className="flex flex-col gap-1 rounded-lg border border-border p-2">
                      {skipped.map((row) => (
                        <li
                          key={row.entryId}
                          className="flex items-start gap-2 px-1 py-0.5 text-sm"
                        >
                          <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                            #{row.entryId}
                          </span>
                          <span className="text-muted-foreground">{row.message}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              ) : (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                  {summary.imported === 1
                    ? "1 entry imported successfully."
                    : `${summary.imported} entries imported successfully.`}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="relative m-0">
          {phase === "dates" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={!datesValid || loading}>
                {loading ? <Loader2 className="animate-spin" /> : <CalendarDays />}
                Preview entries
              </Button>
            </>
          )}

          {phase === "preview" && (
            <>
              <Button variant="outline" onClick={() => setPhase("dates")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={selectedImportableCount === 0}>
                <PlugZap />
                Import {selectedImportableCount}{" "}
                {selectedImportableCount === 1 ? "entry" : "entries"}
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
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
