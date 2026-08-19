"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Download,
  FileDown,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import {
  formatDateTime,
  getInitials,
  monthKeyOf,
  reportMonthLabel,
  reportMonthLabelFromKey,
} from "@/lib/format";
import type { ReportRow } from "@/lib/reports";
import {
  downloadCsv,
  reportCsvFilename,
  reportRowsToCsv,
} from "@/lib/csv";
import {
  deleteReport,
  downloadReportPdf,
} from "@/app/(app)/dashboard/reports/actions";
import { GenerateReportDialog } from "@/components/reports/generate-report-dialog";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

type ClientOption = { id: string; name: string };

function sortReports(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => {
    if (b.reportMonth.getTime() !== a.reportMonth.getTime()) {
      return b.reportMonth.getTime() - a.reportMonth.getTime();
    }
    return b.generatedAt.getTime() - a.generatedAt.getTime();
  });
}

export function ReportsTable({
  initialReports,
  clients,
  reportableMonths,
  canManageReports,
}: {
  initialReports: ReportRow[];
  clients: ClientOption[];
  reportableMonths: string[];
  canManageReports: boolean;
}) {
  const [reports, setReports] = useState<ReportRow[]>(initialReports);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportRow | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const clientOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const report of reports) {
      if (!byId.has(report.clientId)) {
        byId.set(report.clientId, report.clientName);
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const monthOptions = useMemo(() => {
    const keys = new Set(reports.map((report) => monthKeyOf(report.reportMonth)));
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [reports]);

  const searched = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (
        monthFilter !== "ALL" &&
        monthKeyOf(report.reportMonth) !== monthFilter
      ) {
        return false;
      }
      if (!normalized) return true;
      return [
        report.clientName,
        reportMonthLabel(report.reportMonth),
        report.currency,
      ]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(normalized));
    });
  }, [reports, query, monthFilter]);

  const filtered = useMemo(() => {
    if (clientFilter === "ALL") return searched;
    return searched.filter((report) => report.clientId === clientFilter);
  }, [searched, clientFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const canGenerate = clients.length > 0 && reportableMonths.length > 0;

  function handleCreated(report: ReportRow) {
    setReports((prev) => {
      const existing = prev.some((row) => row.id === report.id);
      return sortReports(
        existing
          ? prev.map((row) => (row.id === report.id ? report : row))
          : [...prev, report],
      );
    });
    setPage(1);
  }

  async function runDownload(report: ReportRow) {
    if (downloadingId) return;
    setDownloadingId(report.id);
    try {
      const result = await downloadReportPdf(report.id);
      if (result.ok) {
        const { downloadClientPdf } = await import("@/lib/pdf-report-generator");
        downloadClientPdf(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Couldn't download the report.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function runDelete() {
    const target = deleteTarget;
    if (!target || pendingDeleteId) return;
    setPendingDeleteId(target.id);

    const previous = target;
    setReports((prev) => prev.filter((item) => item.id !== target.id));

    const result = await deleteReport(target.id);
    setPendingDeleteId(null);

    if (result.ok) {
      setDeleteTarget(null);
      toast.success("Report deleted.");
    } else {
      setReports((prev) => sortReports([...prev, previous]));
      toast.error(result.error);
    }
  }

  function clearFilters() {
    setQuery("");
    setClientFilter("ALL");
    setMonthFilter("ALL");
    setPage(1);
  }

  function fileSlug(value: string): string {
    return (
      value
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "client"
    );
  }

  function exportCurrentClient() {
    if (clientFilter === "ALL" || filtered.length === 0) return;
    const client = clientOptions.find((option) => option.id === clientFilter);
    downloadCsv(
      reportCsvFilename(client ? fileSlug(client.name) : "client"),
      reportRowsToCsv(filtered),
    );
  }

  function exportAllClients() {
    if (searched.length === 0) return;
    downloadCsv(
      reportCsvFilename("all-clients"),
      reportRowsToCsv(searched),
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search reports…"
              aria-label="Search reports"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={clientFilter}
              onValueChange={(value) => {
                setClientFilter(value ?? "ALL");
                setPage(1);
              }}
              items={Object.fromEntries(
                clientOptions.map((client) => [client.id, client.name]),
              )}
            >
              <SelectTrigger
                aria-label="Filter by client"
                className="w-full sm:w-[160px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All clients</SelectItem>
                {clientOptions.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={monthFilter}
              onValueChange={(value) => {
                setMonthFilter(value ?? "ALL");
                setPage(1);
              }}
              items={Object.fromEntries(
                monthOptions.map((key) => [key, reportMonthLabelFromKey(key)]),
              )}
            >
              <SelectTrigger
                aria-label="Filter by month"
                className="w-full sm:w-[150px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All months</SelectItem>
                {monthOptions.map((key) => (
                  <SelectItem key={key} value={key}>
                    {reportMonthLabelFromKey(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="shrink-0"
                    disabled={reports.length === 0}
                    aria-label="Export reports as CSV"
                  />
                }
              >
                <Download />
                Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={exportCurrentClient}
                  disabled={clientFilter === "ALL" || filtered.length === 0}
                >
                  <FileDown />
                  Current client
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={exportAllClients}
                  disabled={searched.length === 0}
                >
                  <FileDown />
                  All clients
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <p className="px-1.5 py-1 text-xs text-muted-foreground">
                  Exports respect the active filters.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>

            {canManageReports && (
              <Button
                onClick={() => setIsGenerateOpen(true)}
                disabled={!canGenerate}
                className="shrink-0"
              >
                <Plus />
                Generate Report
              </Button>
            )}
          </div>
        </div>

        {reports.length === 0 ? (
          clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Create a client before generating reports so snapshots have somewhere to go."
              action={
                <ButtonLink href="/dashboard/clients">
                  <Plus />
                  Add a client
                </ButtonLink>
              }
            />
          ) : reportableMonths.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No time logged yet"
              description="Reports are built from logged hours. Add time entries before generating a report."
              action={
                <ButtonLink href="/dashboard/time">
                  <Plus />
                  Log time
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Generate your first report to snapshot revenue, cost, and profit for a client."
              action={
                canManageReports ? (
                  <Button onClick={() => setIsGenerateOpen(true)}>
                    <Plus />
                    Generate Report
                  </Button>
                ) : undefined
              }
            />
          )
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No reports found"
            description="No reports match your search or filters. Try adjusting the criteria."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Client</TableHead>
                  <TableHead>Report period</TableHead>
                  <TableHead>Generated date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[72px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-sm shadow-blue-900/20">
                          {getInitials(report.clientName)}
                        </div>
                        <Link
                          href={`/dashboard/clients/${report.clientId}`}
                          className="max-w-[200px] truncate rounded-sm font-medium text-foreground outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {report.clientName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {reportMonthLabel(report.reportMonth)}
                        </span>
                        {report.version > 1 && (
                          <Badge variant="outline" className="text-[10px]">
                            v{report.version}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDateTime(report.generatedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <FileText />
                        PDF
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${report.clientName} report`}
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => runDownload(report)}
                            disabled={downloadingId !== null}
                          >
                            {downloadingId === report.id ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Download />
                            )}
                            Download PDF
                          </DropdownMenuItem>
                          {canManageReports && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(report)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex}–{endIndex} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={safePage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <GenerateReportDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        clients={clients}
        months={reportableMonths}
        onCreated={handleCreated}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  The report for{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.clientName}
                  </span>{" "}
                  ({reportMonthLabel(deleteTarget.reportMonth)}) will be
                  permanently removed. The underlying time and margin data is
                  kept — you can generate a new report for the same period.
                </>
              ) : (
                "This report will be permanently removed."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={runDelete}
              disabled={pendingDeleteId !== null}
            >
              {pendingDeleteId === deleteTarget?.id && (
                <Loader2 className="animate-spin" />
              )}
              Delete
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
