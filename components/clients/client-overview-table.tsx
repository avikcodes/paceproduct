"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Bell, ChevronsUpDown, Users } from "lucide-react";
import type { ClientOverviewRow } from "@/lib/client-overview";
import { formatMoney } from "@/lib/retainers";
import { getInitials } from "@/lib/format";
import { formatPercent } from "@/lib/margin-status";
import { MarginStatusBadge } from "@/components/clients/margin-status-badge";
import { BurnStatusBadge } from "@/components/clients/burn-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortKey = "revenue" | "profit" | "margin" | "burnRisk";
type SortDirection = "asc" | "desc";

function burnRiskRank(status: ClientOverviewRow["burnStatus"]): number {
  switch (status) {
    case "ON_TRACK":
      return 1;
    case "AT_RISK":
      return 2;
    case "OVER":
      return 3;
    default:
      return 0;
  }
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === sortKey;
  const nextDirection: SortDirection =
    isActive && direction === "desc" ? "asc" : "desc";
  const Icon = isActive
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown;

  return (
    <TableHead
      aria-sort={
        isActive
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={cn(align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label} ${
          nextDirection === "asc" ? "ascending" : "descending"
        }`}
        className={cn(
          "group inline-flex items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          align === "right" && "flex-row-reverse",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3.5 shrink-0 transition-opacity",
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
          )}
        />
      </button>
    </TableHead>
  );
}

function ActiveAlertsBadge({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium",
        count === 1
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-destructive/10 text-destructive",
      )}
    >
      <Bell />
      {count}
    </span>
  );
}

export function ClientOverviewTable({
  initialRows,
}: {
  initialRows: ClientOverviewRow[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [direction, setDirection] = useState<SortDirection>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  }

  const sorted = useMemo(() => {
    const rows = [...initialRows];
    const dir = direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "revenue":
          diff = a.revenue - b.revenue;
          break;
        case "profit":
          diff = a.profit - b.profit;
          break;
        case "margin":
          diff = a.marginPercent - b.marginPercent;
          break;
        case "burnRisk":
          diff = burnRiskRank(a.burnStatus) - burnRiskRank(b.burnStatus);
          break;
      }
      if (diff !== 0) return diff * dir;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [initialRows, sortKey, direction]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {initialRows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Create a client, set a retainer, and log time to see a financial overview here."
            action={
              <ButtonLink href="/dashboard/clients">
                <Users />
                Manage clients
              </ButtonLink>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Client</TableHead>
                  <SortableHeader
                    label="Revenue"
                    sortKey="revenue"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                    align="right"
                  />
                  <TableHead className="text-right">Cost</TableHead>
                  <SortableHeader
                    label="Profit"
                    sortKey="profit"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Margin %"
                    sortKey="margin"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Burn Status"
                    sortKey="burnRisk"
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right">Active Alerts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-sm shadow-blue-900/20">
                          {getInitials(row.name)}
                        </div>
                        <Link
                          href={`/dashboard/clients/${row.id}`}
                          className="truncate rounded-sm font-medium text-foreground outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {row.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {formatMoney(row.revenue, row.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(row.cost, row.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={cn(
                          row.profit < 0
                            ? "text-destructive"
                            : row.profit > 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {formatMoney(row.profit, row.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-foreground">
                          {formatPercent(row.marginPercent)}
                        </span>
                        <MarginStatusBadge status={row.marginStatus} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.burnStatus ? (
                        <div className="flex flex-col gap-0.5">
                          <BurnStatusBadge status={row.burnStatus} />
                          {(row.burnStatus === "AT_RISK" ||
                            row.burnStatus === "OVER") &&
                            row.burnProjectedOverrun > 0 && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {formatMoney(
                                  row.burnProjectedOverrun,
                                  row.currency,
                                )}{" "}
                                overrun projected
                              </span>
                            )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActiveAlertsBadge count={row.activeAlerts} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
