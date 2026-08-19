"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock,
  DollarSign,
  Gauge,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { TeamPerformanceSummary } from "@/lib/team-performance";
import { formatMoney } from "@/lib/retainers";
import { cn } from "@/lib/utils";

type SortKey = "billableHours" | "cost" | "revenue" | "profit" | "utilization";

type SortState = { key: SortKey; desc: boolean };

export type TeamPerformanceRow = {
  memberId: string;
  userId: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
  currency: string;
  billableHours: number;
  cost: number;
  hasUnknownCost: boolean;
  revenue: number;
  profit: number;
  utilization: number;
};

function formatHours(value: number): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)} hrs`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === sort.key;
  const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
      className="group inline-flex w-full items-center justify-end gap-1 rounded-sm font-medium text-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
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

function SummaryCard({
  icon: Icon,
  label,
  member,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  member: string | null;
  value: string | null;
  tone?: "pos" | "neg";
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Icon className="size-3.5" />
          {label}
        </span>
        <span
          className={cn(
            "truncate text-xl leading-snug font-semibold sm:text-2xl",
            tone === "neg"
              ? "text-destructive"
              : tone === "pos"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground",
          )}
        >
          {value ?? "—"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {member ?? "No data"}
        </span>
      </CardContent>
    </Card>
  );
}

function summarizeCard(
  entry: { memberId: string; value: number } | null,
  memberById: Map<string, TeamPerformanceRow>,
  renderValue: (
    entry: { memberId: string; value: number },
    member: TeamPerformanceRow,
  ) => string,
): { member: string | null; value: string | null } {
  if (!entry) return { member: null, value: null };
  const member = memberById.get(entry.memberId);
  if (!member) return { member: null, value: null };
  return {
    member: member.name ?? member.email ?? "Unnamed member",
    value: renderValue(entry, member),
  };
}

export function TeamPerformance({
  initialRows,
  summary,
}: {
  initialRows: TeamPerformanceRow[];
  summary: TeamPerformanceSummary;
}) {
  const [sort, setSort] = useState<SortState>({
    key: "billableHours",
    desc: true,
  });

  const sorted = useMemo(() => {
    const direction = sort.desc ? -1 : 1;
    return [...initialRows].sort(
      (a, b) => (a[sort.key] - b[sort.key]) * direction,
    );
  }, [initialRows, sort]);

  const memberById = useMemo(
    () => new Map(initialRows.map((row) => [row.memberId, row])),
    [initialRows],
  );

  const profitCard = useMemo(() => {
    if (summary.highestProfit) {
      const member = memberById.get(summary.highestProfit.memberId);
      if (member) {
        return {
          member: member.name ?? member.email ?? "Unnamed member",
          value: formatMoney(summary.highestProfit.value, member.currency),
          tone: "pos" as const,
        };
      }
    }
    if (summary.highestProfitCostUnknown) {
      return {
        member: "Cost data unavailable",
        value: null as string | null,
        tone: undefined,
      };
    }
    return { member: null as string | null, value: null as string | null, tone: undefined };
  }, [summary, memberById]);

  function handleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: true },
    );
  }

  const cards = {
    highestRevenue: summarizeCard(
      summary.highestRevenue,
      memberById,
      (entry, member) => formatMoney(entry.value, member.currency),
    ),
    mostBillableHours: summarizeCard(
      summary.mostBillableHours,
      memberById,
      (entry) => formatHours(entry.value),
    ),
    leastUtilized: summarizeCard(
      summary.leastUtilized,
      memberById,
      (entry) => formatPercent(entry.value),
    ),
  };

  if (initialRows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4">
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Invite teammates and log time to see billed vs cost performance."
            action={
              <ButtonLink href="/settings/team" variant="outline">
                Manage team
              </ButtonLink>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Team performance summary"
      >
        <SummaryCard
          icon={DollarSign}
          label="Highest revenue"
          member={cards.highestRevenue.member}
          value={cards.highestRevenue.value}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Highest profit"
          member={profitCard.member}
          value={profitCard.value}
          tone={profitCard.tone}
        />
        <SummaryCard
          icon={Clock}
          label="Most billable hours"
          member={cards.mostBillableHours.member}
          value={cards.mostBillableHours.value}
        />
        <SummaryCard
          icon={Gauge}
          label="Least utilized"
          member={cards.leastUtilized.member}
          value={cards.leastUtilized.value}
          tone="neg"
        />
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Revenue is billed at each member&apos;s billing rate, and cost at
            their cost rate. Utilization is each member&apos;s share of total
            billable hours across all tracked time.
          </p>

          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Team member</TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Billable hours"
                      sortKey="billableHours"
                      sort={sort}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Cost"
                      sortKey="cost"
                      sort={sort}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Revenue"
                      sortKey="revenue"
                      sort={sort}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Profit"
                      sortKey="profit"
                      sort={sort}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Utilization %"
                      sortKey="utilization"
                      sort={sort}
                      onSort={handleSort}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.memberId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {row.imageUrl && (
                            <AvatarImage
                              src={row.imageUrl}
                              alt={row.name ?? row.email ?? "Member avatar"}
                            />
                          )}
                          <AvatarFallback>
                            {getInitials(row.name ?? row.email ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {row.name ?? "Unnamed member"}
                          </span>
                          {row.email && (
                            <span className="truncate text-xs text-muted-foreground">
                              {row.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular-nums text-foreground">
                        {formatHours(row.billableHours)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.hasUnknownCost ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Money value={row.cost} currency={row.currency} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={row.revenue} currency={row.currency} />
                    </TableCell>
                    <TableCell className="text-right">
                      {row.hasUnknownCost ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Money
                          value={row.profit}
                          currency={row.currency}
                          tone={
                            row.profit < 0
                              ? "neg"
                              : row.profit > 0
                                ? "pos"
                                : undefined
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular-nums text-foreground">
                        {formatPercent(row.utilization)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
