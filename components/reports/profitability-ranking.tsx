"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Users, Wallet } from "lucide-react";

import { ProfitabilityBadge } from "@/components/reports/profitability-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInitials } from "@/lib/format";
import { formatPercent } from "@/lib/margin-status";
import type { ClientProfitability } from "@/lib/profitability";
import { formatMoney } from "@/lib/retainers";
import { cn } from "@/lib/utils";

type SortKey = "revenue" | "profit" | "marginPercent" | "totalHours";

type SortState = { key: SortKey; desc: boolean };

function formatHours(value: number): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)} hrs`;
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey?: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === sort.key;
  const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;

  return (
    <button
      type="button"
      disabled={!sortKey}
      onClick={() => sortKey && onSort(sortKey)}
      aria-label={`Sort by ${label}`}
      className={cn(
        "group inline-flex items-center gap-1 rounded-sm font-medium text-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default",
        align === "right" && "w-full justify-end",
      )}
    >
      {label}
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          !active &&
            "text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100",
        )}
      />
    </button>
  );
}

function Money({
  value,
  currency,
  tone,
}: {
  value: number;
  currency: string;
  tone?: "pos" | "neg";
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        tone === "pos"
          ? "text-emerald-600 dark:text-emerald-400"
          : tone === "neg"
            ? "text-destructive"
            : "text-foreground",
      )}
    >
      {formatMoney(value, currency)}
    </span>
  );
}

export function ProfitabilityRanking({
  initialRows,
}: {
  initialRows: ClientProfitability[];
}) {
  const [sort, setSort] = useState<SortState>({ key: "revenue", desc: true });

  const sorted = useMemo(() => {
    const direction = sort.desc ? -1 : 1;
    return [...initialRows].sort(
      (a, b) => (a[sort.key] - b[sort.key]) * direction,
    );
  }, [initialRows, sort]);

  function handleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: true },
    );
  }

  const hasAnyData = initialRows.some(
    (row) => row.revenue !== 0 || row.totalHours !== 0,
  );

  if (initialRows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4">
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Create a client to start tracking work and see a profitability ranking."
            action={
              <ButtonLink href="/dashboard/clients" variant="outline">
                View clients
              </ButtonLink>
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (!hasAnyData) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4">
          <EmptyState
            icon={Wallet}
            title="No profitability data yet"
            description="Set up a retainer and log time entries to see revenue, cost, and profit per client."
            action={
              <ButtonLink href="/dashboard/clients" variant="outline">
                View clients
              </ButtonLink>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Revenue reflects each client&apos;s active retainer amount, spread
          across the months of its billing cycle. Cost is logged hours × member
          cost rate. Rank follows the current sort order.
        </p>

        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Rank</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">
                  <SortHeader
                    label="Revenue"
                    sortKey="revenue"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">
                  <SortHeader
                    label="Profit"
                    sortKey="profit"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader
                    label="Margin %"
                    sortKey="marginPercent"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader
                    label="Hours"
                    sortKey="totalHours"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((client, index) => (
                <TableRow key={client.clientId}>
                  <TableCell>
                    <span className="font-medium text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-sm shadow-blue-900/20">
                        {getInitials(client.name)}
                      </div>
                      <div className="flex min-w-0 flex-col items-start gap-1.5">
                        <Link
                          href={`/dashboard/clients/${client.clientId}`}
                          className="truncate font-medium text-foreground rounded-sm outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {client.name}
                        </Link>
                        <ProfitabilityBadge badge={client.badge} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={client.revenue} currency={client.currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    {client.hasUnknownCost ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Money value={client.cost} currency={client.currency} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {client.hasUnknownCost ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Money
                        value={client.profit}
                        currency={client.currency}
                        tone={
                          client.profit < 0
                            ? "neg"
                            : client.profit > 0
                              ? "pos"
                              : undefined
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {client.hasUnknownCost ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="tabular-nums text-foreground">
                        {formatPercent(client.marginPercent)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="tabular-nums text-muted-foreground">
                      {formatHours(client.totalHours)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
