"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
} from "lucide-react";
import type { AttentionAlert } from "@/lib/activity";
import {
  formatDateTime,
  formatFullDateTime,
  getInitials,
} from "@/lib/format";
import { AlertTypeBadge } from "@/components/alerts/alert-type-badge";
import { AlertSeverityBadge } from "@/components/alerts/alert-severity-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const PAGE_SIZE = 8;

type Tab = "ALL" | "CRITICAL" | "WARNING" | "RESOLVED";
type Sort = "NEWEST" | "SEVERITY" | "CLIENT";

const TAB_ITEMS: Record<Tab, string> = {
  ALL: "All",
  CRITICAL: "Critical",
  WARNING: "Warning",
  RESOLVED: "Resolved",
};

const SORT_ITEMS: Record<Sort, string> = {
  NEWEST: "Newest",
  SEVERITY: "Severity",
  CLIENT: "Client",
};

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
};

function StatusBadge({
  isResolved,
  isRead,
}: {
  isResolved: boolean;
  isRead: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium",
        isResolved
          ? "border-border bg-muted/50 text-muted-foreground"
          : isRead
            ? "border-border bg-muted/50 text-muted-foreground"
            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {isResolved ? "Resolved" : isRead ? "Read" : "Active"}
    </span>
  );
}

export function AlertsPanel({
  alerts,
  canResolve,
  onResolve,
}: {
  alerts: AttentionAlert[];
  canResolve: boolean;
  onResolve: (alertId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [sort, setSort] = useState<Sort>("NEWEST");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      ALL: alerts.length,
      CRITICAL: alerts.filter(
        (alert) => alert.severity === "CRITICAL" && !alert.isResolved,
      ).length,
      WARNING: alerts.filter(
        (alert) => alert.severity === "WARNING" && !alert.isResolved,
      ).length,
      RESOLVED: alerts.filter((alert) => alert.isResolved).length,
    }),
    [alerts],
  );

  const filtered = useMemo(() => {
    const base = alerts.filter((alert) => {
      if (tab === "CRITICAL") {
        return !alert.isResolved && alert.severity === "CRITICAL";
      }
      if (tab === "WARNING") {
        return !alert.isResolved && alert.severity === "WARNING";
      }
      if (tab === "RESOLVED") return alert.isResolved;
      return true;
    });
    const sorted = [...base];
    if (sort === "SEVERITY") {
      sorted.sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } else if (sort === "CLIENT") {
      sorted.sort(
        (a, b) =>
          a.clientName.localeCompare(b.clientName) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } else {
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return sorted;
  }, [alerts, tab, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, filtered.length);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4 text-muted-foreground" />
          Alerts
        </CardTitle>
        <CardDescription>
          Every alert your agency has raised, including resolved ones.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Filter alerts"
            className="flex w-fit items-center gap-1 rounded-lg bg-muted/50 p-1"
          >
            {(Object.keys(TAB_ITEMS) as Tab[]).map((value) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={tab === value}
                onClick={() => {
                  setTab(value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  tab === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {TAB_ITEMS[value]}
                {counts[value] > 0 && (
                  <span
                    className={cn(
                      "ml-1.5 text-[10px] tabular-nums",
                      tab === value
                        ? "text-muted-foreground"
                        : "text-muted-foreground/70",
                    )}
                  >
                    {counts[value]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as Sort);
              setPage(1);
            }}
            items={SORT_ITEMS}
          >
            <SelectTrigger
              aria-label="Sort alerts"
              className="w-full sm:w-[140px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="NEWEST">Newest</SelectItem>
              <SelectItem value="SEVERITY">Severity</SelectItem>
              <SelectItem value="CLIENT">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {alerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No alerts yet"
            description="Alerts about margins, budgets, and scope will appear here when there's something to review."
            className="py-12"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No alerts in this view"
            description="Nothing matches the current filter."
            className="py-12"
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Client</TableHead>
                  <TableHead>Problem</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Current value</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Financial impact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[72px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((alert) => {
                  const expanded = expandedId === alert.id;
                  return (
                    <Fragment key={alert.id}>
                      <TableRow
                        className={cn(
                          !alert.isResolved &&
                            alert.severity === "CRITICAL" &&
                            "bg-destructive/[0.04]",
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                              {getInitials(alert.clientName)}
                            </div>
                            <Link
                              href={`/dashboard/clients/${alert.clientId}`}
                              className="max-w-[160px] truncate rounded-sm font-medium text-foreground outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                              {alert.clientName}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="flex flex-col">
                            <span className="truncate text-sm font-medium">
                              {alert.title}
                            </span>
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {alert.description}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <AlertSeverityBadge severity={alert.severity} />
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground whitespace-nowrap"
                          title={formatFullDateTime(alert.createdAt)}
                        >
                          {formatDateTime(alert.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {alert.currentLabel ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {alert.thresholdLabel ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          {alert.impactLabel ? (
                            <span className="font-medium text-destructive">
                              {alert.impactLabel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            isResolved={alert.isResolved}
                            isRead={alert.isRead}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedId(expanded ? null : alert.id)
                              }
                              aria-label={
                                expanded
                                  ? "Collapse alert"
                                  : "Open alert details"
                              }
                              className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                              {expanded ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </button>
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
                                <DropdownMenuItem
                                  render={
                                    <Link
                                      href={`/dashboard/clients/${alert.clientId}`}
                                    />
                                  }
                                >
                                  <ExternalLink />
                                  View client
                                </DropdownMenuItem>
                                {!alert.isResolved && canResolve && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => onResolve(alert.id)}
                                    >
                                      <Bell />
                                      Resolve
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={9}>
                            <div className="flex flex-col gap-1.5 py-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <AlertTypeBadge type={alert.type} />
                                <AlertSeverityBadge severity={alert.severity} />
                                <span className="text-xs text-muted-foreground">
                                  Detected {formatDateTime(alert.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {alert.description}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
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
    </Card>
  );
}
