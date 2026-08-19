"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  Check,
  Loader2,
  Mail,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";
import {
  deleteAlert,
  markAlertRead,
  markAlertUnread,
} from "@/app/(app)/dashboard/alerts/actions";
import {
  alertTypeLabel,
  alertSeverityLabel,
  type AlertRow,
  type AlertType,
  type AlertSeverity,
} from "@/lib/alerts";
import { getInitials, formatDateTime } from "@/lib/format";
import { AlertTypeBadge } from "@/components/alerts/alert-type-badge";
import { AlertSeverityBadge } from "@/components/alerts/alert-severity-badge";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

const PAGE_SIZE = 10;

type TypeFilter = "ALL" | AlertType;
type SeverityFilter = "ALL" | AlertSeverity;
type ReadFilter = "ALL" | "READ" | "UNREAD";
type StateFilter = "ALL" | "ACTIVE" | "RESOLVED";

const TYPE_FILTER_ITEMS: Record<string, string> = {
  ALL: "All types",
  MARGIN: alertTypeLabel("MARGIN"),
  BUDGET: alertTypeLabel("BUDGET"),
  SCOPE: alertTypeLabel("SCOPE"),
};

const SEVERITY_FILTER_ITEMS: Record<string, string> = {
  ALL: "All severities",
  INFO: alertSeverityLabel("INFO"),
  WARNING: alertSeverityLabel("WARNING"),
  CRITICAL: alertSeverityLabel("CRITICAL"),
};

const READ_FILTER_ITEMS: Record<string, string> = {
  ALL: "All statuses",
  READ: "Read",
  UNREAD: "Unread",
};

const STATE_FILTER_ITEMS: Record<string, string> = {
  ALL: "All states",
  ACTIVE: "Active",
  RESOLVED: "Resolved",
};

function ReadStatusBadge({ isRead }: { isRead: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium",
        isRead
          ? "border-border bg-muted/50 text-muted-foreground"
          : "bg-primary/10 text-primary",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {isRead ? "Read" : "Unread"}
    </span>
  );
}

function LifecycleBadge({ isResolved }: { isResolved: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium",
        isResolved
          ? "border-border bg-muted/50 text-muted-foreground"
          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {isResolved ? "Resolved" : "Active"}
    </span>
  );
}

export function AlertsTable({ initialAlerts }: { initialAlerts: AlertRow[] }) {
  const [alerts, setAlerts] = useState<AlertRow[]>(initialAlerts);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [readFilter, setReadFilter] = useState<ReadFilter>("ALL");
  const [stateFilter, setStateFilter] = useState<StateFilter>("ACTIVE");
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState<AlertRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return alerts.filter((alert) => {
      if (typeFilter !== "ALL" && alert.type !== typeFilter) return false;
      if (severityFilter !== "ALL" && alert.severity !== severityFilter) {
        return false;
      }
      if (readFilter === "READ" && !alert.isRead) return false;
      if (readFilter === "UNREAD" && alert.isRead) return false;
      if (stateFilter === "ACTIVE" && alert.isResolved) return false;
      if (stateFilter === "RESOLVED" && !alert.isResolved) return false;
      if (!normalized) return true;
      return [alert.title, alert.description, alert.clientName]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(normalized));
    });
  }, [alerts, query, typeFilter, severityFilter, readFilter, stateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function clearFilters() {
    setQuery("");
    setTypeFilter("ALL");
    setSeverityFilter("ALL");
    setReadFilter("ALL");
    setStateFilter("ALL");
    setPage(1);
  }

  async function runToggleRead(alert: AlertRow) {
    if (pendingId) return;
    setPendingId(alert.id);

    const previous = alert;
    const next: AlertRow = { ...alert, isRead: !alert.isRead };
    setAlerts((prev) =>
      prev.map((item) => (item.id === alert.id ? next : item)),
    );

    const result = next.isRead
      ? await markAlertRead(alert.id)
      : await markAlertUnread(alert.id);
    setPendingId(null);

    if (result.ok) {
      setAlerts((prev) =>
        prev.map((item) => (item.id === alert.id ? result.data : item)),
      );
      toast.success(next.isRead ? "Alert marked as read." : "Alert marked as unread.");
    } else {
      setAlerts((prev) =>
        prev.map((item) => (item.id === alert.id ? previous : item)),
      );
      toast.error(result.error);
    }
  }

  async function runDelete() {
    const target = deleteTarget;
    if (!target || pendingId) return;
    setPendingId(target.id);

    const previous = target;
    setAlerts((prev) => prev.filter((item) => item.id !== target.id));

    const result = await deleteAlert(target.id);
    setPendingId(null);

    if (result.ok) {
      setDeleteTarget(null);
      toast.success("Alert deleted.");
    } else {
      setAlerts((prev) =>
        [...prev, previous].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        ),
      );
      toast.error(result.error);
    }
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
              placeholder="Search alerts…"
              aria-label="Search alerts"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value as TypeFilter);
                setPage(1);
              }}
              items={TYPE_FILTER_ITEMS}
            >
              <SelectTrigger
                aria-label="Filter by type"
                className="w-full sm:w-[140px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="MARGIN">Margin</SelectItem>
                <SelectItem value="BUDGET">Budget</SelectItem>
                <SelectItem value="SCOPE">Scope</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={severityFilter}
              onValueChange={(value) => {
                setSeverityFilter(value as SeverityFilter);
                setPage(1);
              }}
              items={SEVERITY_FILTER_ITEMS}
            >
              <SelectTrigger
                aria-label="Filter by severity"
                className="w-full sm:w-[150px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All severities</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={readFilter}
              onValueChange={(value) => {
                setReadFilter(value as ReadFilter);
                setPage(1);
              }}
              items={READ_FILTER_ITEMS}
            >
              <SelectTrigger
                aria-label="Filter by status"
                className="w-full sm:w-[150px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="READ">Read</SelectItem>
                <SelectItem value="UNREAD">Unread</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={stateFilter}
              onValueChange={(value) => {
                setStateFilter(value as StateFilter);
                setPage(1);
              }}
              items={STATE_FILTER_ITEMS}
            >
              <SelectTrigger
                aria-label="Filter by state"
                className="w-full sm:w-[150px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All states</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {alerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No alerts yet"
            description="Alerts about margins, budgets, and scope will appear here when there's something to review."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No alerts found"
            description="No alerts match your search or filter. Try adjusting the criteria."
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
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-sm shadow-blue-900/20">
                          {getInitials(alert.clientName)}
                        </div>
                        <Link
                          href={`/dashboard/clients/${alert.clientId}`}
                          className="truncate rounded-sm font-medium text-foreground outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {alert.clientName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AlertTypeBadge type={alert.type} />
                    </TableCell>
                    <TableCell>
                      <AlertSeverityBadge severity={alert.severity} />
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "truncate font-medium",
                            alert.isResolved
                              ? "text-muted-foreground line-through decoration-muted-foreground/40"
                              : alert.isRead
                                ? "text-muted-foreground"
                                : "text-foreground",
                          )}
                        >
                          {alert.title}
                        </span>
                        <span
                          className={cn(
                            "line-clamp-2 text-xs",
                            alert.isResolved
                              ? "text-muted-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {alert.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDateTime(alert.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <LifecycleBadge isResolved={alert.isResolved} />
                        {!alert.isResolved && (
                          <ReadStatusBadge isRead={alert.isRead} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${alert.title}`}
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!alert.isResolved && (
                            <>
                              {alert.isRead ? (
                                <DropdownMenuItem
                                  onClick={() => runToggleRead(alert)}
                                  disabled={pendingId !== null}
                                >
                                  <Mail />
                                  Mark as unread
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => runToggleRead(alert)}
                                  disabled={pendingId !== null}
                                >
                                  <Check />
                                  Mark as read
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(alert)}
                            disabled={pendingId !== null}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
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
            <AlertDialogTitle>Delete alert?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  &ldquo;<span className="font-medium text-foreground">
                    {deleteTarget.title}
                  </span>&rdquo; will be permanently deleted. This can&apos;t
                  be undone.
                </>
              ) : (
                "This alert will be permanently deleted. This can't be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={runDelete}
              disabled={pendingId !== null}
            >
              {pendingId === deleteTarget?.id && (
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
