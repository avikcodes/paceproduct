"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  CircleAlert,
  Clock,
  FileText,
  Gauge,
  Handshake,
  LayoutDashboard,
  Plus,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent, DashboardData } from "@/lib/dashboard";
import type { DashboardPeriod } from "@/lib/dashboard-metrics";
import { formatMoney } from "@/lib/retainers";
import { formatHours } from "@/lib/time";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { clientStatusLabel } from "@/lib/clients";
import { scopeStatusLabel } from "@/lib/scope-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ClientHealthRow,
  type HealthDriver,
  type NeedsAttentionItem,
} from "@/lib/dashboard-metrics";

type Capabilities = {
  manageTeam: boolean;
  manageClients: boolean;
  addTime: boolean;
  viewReports: boolean;
};

export function DashboardView({
  data,
  period,
  timeZone,
  capabilities,
}: {
  data: DashboardData;
  period: DashboardPeriod;
  timeZone: string;
  capabilities: Capabilities;
}) {
  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        data={data}
        period={period}
        timeZone={timeZone}
      />

      {!data.hasAnyData ? (
        <OnboardingEmptyState capabilities={capabilities} />
      ) : (
        <>
          {!data.hasInPeriodHours && (
            <NoTimeBanner data={data} timeZone={timeZone} />
          )}

          <KpiGrid data={data} />

          <div className="grid gap-6 lg:grid-cols-3">
            <HealthCard data={data} className="lg:col-span-2" />
            <NeedsAttentionCard
              items={data.needsAttention}
              currency={data.currency}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <ClientHealthTable
              rows={data.clients}
              currency={data.currency}
              className="lg:col-span-2"
            />
            <LeakCard leak={data.biggestLeak} currency={data.currency} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <BudgetRiskCard rows={data.budgetScope} currency={data.currency} />
            <ScopeRiskCard rows={data.budgetScope} currency={data.currency} />
            <QuickActions capabilities={capabilities} />
          </div>

          <ActivityCard events={data.activity} />
        </>
      )}
    </div>
  );
}

function DashboardHeader({
  data,
  period,
  timeZone,
}: {
  data: DashboardData;
  period: DashboardPeriod;
  timeZone: string;
}) {
  const router = useRouter();
  const tzQuery = encodeURIComponent(timeZone);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Revenue, profitability, and client health for{" "}
            <span className="font-medium text-foreground">{data.label}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Dashboard period"
            className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
          >
            {(
              [
                ["today", "Today"],
                ["30d", "30 Days"],
                ["quarter", "Quarter"],
                ["year", "Year"],
              ] as const
            ).map(([value, label]) => {
              const active = value === period;
              return (
                <Link
                  key={value}
                  href={`/dashboard?period=${value}&tz=${tzQuery}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh dashboard"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Updated {formatDateTime(new Date(data.generatedAt))} · timezone{" "}
        {timeZone}
      </p>
    </section>
  );
}

function OnboardingEmptyState({ capabilities }: { capabilities: Capabilities }) {
  return (
    <Card>
      <CardContent className="px-(--card-spacing) py-6">
        <EmptyState
          icon={LayoutDashboard}
          title="Get started with Pace"
          description="Add your first client, retainer, and time entry to start using Pace."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {capabilities.manageClients && (
                <ButtonLink href="/dashboard/clients">
                  <Plus className="size-4" />
                  Add a client
                </ButtonLink>
              )}
              {capabilities.addTime && (
                <ButtonLink href="/dashboard/time" variant="outline">
                  <Clock className="size-4" />
                  Log time
                </ButtonLink>
              )}
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}

function NoTimeBanner({
  data,
  timeZone,
}: {
  data: DashboardData;
  timeZone: string;
}) {
  return (
    <Card>
      <CardContent className="px-(--card-spacing) py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-muted/50">
              <Clock className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">
                No time logged in this period.
              </p>
              {data.hasHistoricalData && (
                <p className="text-sm text-muted-foreground">
                  Your workspace has historical activity.
                </p>
              )}
            </div>
          </div>
          {data.hasHistoricalData && (
            <ButtonLink
              href={`/dashboard?period=30d&tz=${encodeURIComponent(timeZone)}`}
            >
              <CalendarClock className="size-4" />
              View 30 Days
            </ButtonLink>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const delta = pctDelta(current, previous);
  if (delta === null || !Number.isFinite(delta)) return null;
  const up = delta >= 0;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-[11px] font-medium",
        up ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600",
      )}
    >
      {up ? (
        <ArrowUpRight className="size-3" />
      ) : (
        <ArrowDownRight className="size-3" />
      )}
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

function KpiGrid({ data }: { data: DashboardData }) {
  const { finances, previousFinances, hasFinancialData } = data;

  const missingRateNames = data.missingCostRateMembers
    .map((member) => member.name)
    .slice(0, 2)
    .join(", ");
  const missingRateSuffix =
    data.missingCostRateMembers.length > 2
      ? ` +${data.missingCostRateMembers.length - 2} more`
      : "";
  const missingRateDetail =
    data.missingCostRateMembers.length > 0
      ? `set cost rate for ${missingRateNames}${missingRateSuffix}`
      : "";

  const previousComparable =
    previousFinances.revenue > 0 && !previousFinances.hasUnknownCost;

  const kpis: Array<{
    label: string;
    icon: LucideIcon;
    value: string;
    sub: string;
    delta: { current: number; previous: number } | null;
    muted?: boolean;
  }> = [
    {
      label: "Revenue",
      icon: Banknote,
      value: hasFinancialData
        ? formatMoney(finances.revenue, finances.currency)
        : "No financial data",
      sub: hasFinancialData
        ? "retainer revenue this period"
        : "no active retainer revenue this period",
      delta:
        hasFinancialData && previousFinances.revenue > 0
          ? { current: finances.revenue, previous: previousFinances.revenue }
          : null,
      muted: !hasFinancialData,
    },
    {
      label: "Cost",
      icon: Wallet,
      value: finances.hasUnknownCost
        ? "Cost rate missing"
        : formatMoney(finances.cost, finances.currency),
      sub: finances.hasUnknownCost
        ? missingRateDetail || "internal cost rates are missing"
        : "hours × cost rate this period",
      delta:
        finances.hasUnknownCost || !previousComparable
          ? null
          : { current: finances.cost, previous: previousFinances.cost },
      muted: finances.hasUnknownCost,
    },
    {
      label: "Profit",
      icon: ChartNoAxesColumnIncreasing,
      value:
        hasFinancialData && !finances.hasUnknownCost
          ? formatMoney(finances.profit, finances.currency)
          : "Unavailable",
      sub: finances.hasUnknownCost
        ? "cost data unavailable"
        : !hasFinancialData
          ? "needs retainer revenue"
          : "revenue minus cost",
      delta:
        hasFinancialData && !finances.hasUnknownCost && previousComparable
          ? { current: finances.profit, previous: previousFinances.profit }
          : null,
      muted: !hasFinancialData || finances.hasUnknownCost,
    },
    {
      label: "Margin",
      icon: TrendingUp,
      value:
        hasFinancialData && !finances.hasUnknownCost
          ? `${finances.marginPercent.toFixed(1)}%`
          : "Unavailable",
      sub: finances.hasUnknownCost
        ? "cost data unavailable"
        : !hasFinancialData
          ? "needs retainer revenue"
          : "profit ÷ revenue",
      delta:
        hasFinancialData && !finances.hasUnknownCost && previousComparable
          ? {
              current: finances.marginPercent,
              previous: previousFinances.marginPercent,
            }
          : null,
      muted: !hasFinancialData || finances.hasUnknownCost,
    },
    {
      label: "Hours",
      icon: Clock,
      value: formatHours(finances.hours),
      sub:
        finances.hours > 0
          ? "logged this period"
          : "no hours logged this period",
      delta:
        previousFinances.revenue > 0 || previousFinances.hours > 0
          ? { current: finances.hours, previous: previousFinances.hours }
          : null,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.label} size="sm">
            <CardContent className="flex flex-col gap-2 px-(--card-spacing)">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {kpi.label}
                </span>
                {kpi.delta && (
                  <DeltaBadge
                    current={kpi.delta.current}
                    previous={kpi.delta.previous}
                  />
                )}
              </div>
              <p
                className={cn(
                  "text-lg font-semibold tracking-tight text-foreground sm:text-xl",
                  kpi.muted && "text-muted-foreground",
                )}
              >
                {kpi.value}
              </p>
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function healthStatusTone(status: string): string {
  switch (status) {
    case "HEALTHY":
      return "bg-emerald-500/10 text-emerald-600";
    case "WATCH":
      return "bg-amber-500/10 text-amber-600";
    case "AT_RISK":
      return "bg-orange-500/10 text-orange-600";
    default:
      return "bg-red-500/10 text-red-600";
  }
}

function HealthCard({ data, className }: { data: DashboardData; className?: string }) {
  const { health } = data;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-primary" />
          Agency health
        </CardTitle>
        <CardDescription>
          Scored from real margin, profitability, budget, scope, and alert
          signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-(--card-spacing)">
        {health.score === null ? (
          <p className="text-sm text-muted-foreground">
            Not enough data to score agency health yet. Add retainers and log
            time to get started.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="grid size-16 place-items-center rounded-2xl bg-muted/50"
                role="img"
                aria-label={`Agency health score ${health.score}`}
              >
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  {health.score}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <Badge
                  className={cn(
                    "w-fit rounded-full",
                    healthStatusTone(health.status ?? ""),
                  )}
                >
                  {health.status}
                </Badge>
                {health.change !== null && (
                  <p className="text-xs text-muted-foreground">
                    {health.change >= 0 ? "+" : ""}
                    {health.change} vs previous period
                  </p>
                )}
              </div>
            </div>

            <ul className="flex flex-col gap-2">
              {health.drivers.map((driver) => (
                <HealthDriverRow key={driver.label} driver={driver} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HealthDriverRow({ driver }: { driver: HealthDriver }) {
  const positive = driver.tone === "positive";
  const negative = driver.tone === "negative";
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-1.5 rounded-full",
            positive
              ? "bg-emerald-500"
              : negative
                ? "bg-red-500"
                : "bg-muted-foreground/40",
          )}
        />
        <span className="text-sm text-foreground">{driver.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{driver.detail}</span>
        {driver.impact !== 0 && (
          <Badge
            variant="outline"
            className={cn(
              "h-5 rounded-full border-transparent",
              positive
                ? "bg-emerald-500/10 text-emerald-600"
                : negative
                  ? "bg-red-500/10 text-red-600"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {driver.impact > 0 ? "+" : ""}
            {driver.impact}
          </Badge>
        )}
      </div>
    </li>
  );
}

function needsSeverityTone(severity: NeedsAttentionItem["severity"]): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500/10 text-red-600";
    case "WARNING":
      return "bg-amber-500/10 text-amber-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function NeedsAttentionCard({
  items,
  currency,
}: {
  items: NeedsAttentionItem[];
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleAlert className="size-4 text-amber-500" />
          Needs attention
        </CardTitle>
        <CardDescription>Real problems ranked by severity.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-(--card-spacing)">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No issues need attention right now.
          </p>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/clients/${item.clientId}`}
              className="group flex flex-col gap-1 rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {item.clientName}
                </span>
                <Badge className={cn("rounded-full", needsSeverityTone(item.severity))}>
                  {item.severity}
                </Badge>
              </div>
              <p className="text-sm text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
              {item.impact > 0 && (
                <p className="text-xs font-medium text-primary">
                  {formatMoney(item.impact, currency)} at stake
                </p>
              )}
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                View client
                <ArrowRight className="size-3" />
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function healthBadgeTone(row: ClientHealthRow): string {
  switch (row.health) {
    case "HEALTHY":
      return "bg-emerald-500/10 text-emerald-600";
    case "WATCH":
      return "bg-amber-500/10 text-amber-600";
    case "AT_RISK":
      return "bg-orange-500/10 text-orange-600";
    default:
      return "bg-red-500/10 text-red-600";
  }
}

function ClientHealthTable({
  rows,
  currency,
  className,
}: {
  rows: ClientHealthRow[];
  currency: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          Client health
        </CardTitle>
        <CardDescription>
          Financials and health for clients with activity this period, highest
          risk first.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-(--card-spacing)">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No client activity in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const hasFinancials = row.revenue > 0;
                  return (
                    <TableRow key={row.clientId}>
                      <TableCell>
                        <Link
                          href={`/dashboard/clients/${row.clientId}`}
                          className="flex flex-col hover:text-primary"
                        >
                          <span className="font-medium text-foreground">
                            {row.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {clientStatusLabel(row.status)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {hasFinancials ? (
                          <span className="text-sm tabular-nums text-foreground">
                            {formatMoney(row.revenue, currency)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.hasUnknownCost ? (
                          <span className="text-xs text-muted-foreground">
                            Cost rate missing
                          </span>
                        ) : hasFinancials ? (
                          <span className="text-sm tabular-nums text-foreground">
                            {formatMoney(row.cost, currency)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasFinancials && !row.hasUnknownCost ? (
                          <span
                            className={cn(
                              "text-sm tabular-nums",
                              row.profit < 0 ? "text-red-600" : "text-foreground",
                            )}
                          >
                            {formatMoney(row.profit, currency)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {row.hasUnknownCost ? "Unavailable" : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.marginStatus === null ? (
                          <span className="text-xs text-muted-foreground">
                            {row.hasUnknownCost
                              ? "Cost data unavailable"
                              : "No financial data"}
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-sm tabular-nums text-foreground">
                              {row.marginPercent?.toFixed(1)}%
                            </span>
                            <span
                              className={cn(
                                "text-xs",
                                row.marginStatus === "HEALTHY"
                                  ? "text-emerald-600"
                                  : row.marginStatus === "WARNING"
                                    ? "text-amber-600"
                                    : "text-red-600",
                              )}
                            >
                              {row.marginStatus}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.budget === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(
                              "text-sm tabular-nums",
                              row.budget.status === "OVER"
                                ? "text-red-600"
                                : row.budget.status === "AT_RISK"
                                  ? "text-amber-600"
                                  : "text-emerald-600",
                            )}
                          >
                            {row.budget.percent.toFixed(0)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.scope === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(
                              "text-sm tabular-nums",
                              row.scope.status === "OVERRUN" ||
                                row.scope.status === "EXCEEDED"
                                ? "text-red-600"
                                : row.scope.status === "AT_RISK" ||
                                    row.scope.status === "NEARING"
                                  ? "text-amber-600"
                                  : "text-emerald-600",
                            )}
                          >
                            {row.scope.percent.toFixed(0)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={cn("rounded-full", healthBadgeTone(row))}>
                          {row.health}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeakCard({
  leak,
  currency,
}: {
  leak: DashboardData["biggestLeak"];
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-red-500" />
          Biggest profit leak
        </CardTitle>
        <CardDescription>
          The one client costing you the most margin.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-(--card-spacing)">
        {leak === null ? (
          <p className="text-sm text-muted-foreground">
            No measurable profit leak.
          </p>
        ) : (
          <>
            <Link
              href={`/dashboard/clients/${leak.clientId}`}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="text-sm font-medium text-foreground">
                {leak.clientName}
              </span>
              <Badge className="rounded-full bg-red-500/10 text-red-600">
                {leak.marginPercent?.toFixed(1)}% margin
              </Badge>
            </Link>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Revenue</dt>
                <dd className="tabular-nums text-foreground">
                  {formatMoney(leak.revenue, currency)}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Cost</dt>
                <dd className="tabular-nums text-foreground">
                  {formatMoney(leak.cost, currency)}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Profit</dt>
                <dd className="tabular-nums text-foreground">
                  {formatMoney(leak.profit, currency)}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">At stake</dt>
                <dd className="tabular-nums font-medium text-primary">
                  {formatMoney(leak.impact, currency)}
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {leak.reason}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function riskTone(risky: boolean): string {
  return risky ? "text-red-600" : "text-amber-600";
}

function BudgetRiskCard({
  rows,
  currency,
}: {
  rows: DashboardData["budgetScope"];
  currency: string;
}) {
  const risky = rows.filter(
    (row) => row.budget?.status === "AT_RISK" || row.budget?.status === "OVER",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" />
          Budget risk
        </CardTitle>
        <CardDescription>
          Clients approaching or over their monthly budget.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-(--card-spacing)">
        {risky.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budget risks.</p>
        ) : (
          risky.map((row) => {
            const budget = row.budget!;
            const over = budget.status === "OVER";
            return (
              <div
                key={row.clientId}
                className="flex flex-col gap-1 rounded-lg border border-border/60 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/clients/${row.clientId}`}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {row.clientName}
                  </Link>
                  <span className={cn("text-xs font-medium", riskTone(over))}>
                    {over ? "Over budget" : "At risk"}
                  </span>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatMoney(budget.used, currency)} of{" "}
                  {formatMoney(budget.limit, currency)} · {budget.percent.toFixed(0)}%
                  used
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function ScopeRiskCard({
  rows,
  currency,
}: {
  rows: DashboardData["budgetScope"];
  currency: string;
}) {
  const risky = rows.filter(
    (row) =>
      row.scope !== null &&
      ["NEARING", "AT_RISK", "EXCEEDED", "OVERRUN"].includes(row.scope.status),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          Scope risk
        </CardTitle>
        <CardDescription>
          Clients nearing or past their scope hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-(--card-spacing)">
        {risky.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scope risks.</p>
        ) : (
          risky.map((row) => {
            const scope = row.scope!;
            const past =
              scope.status === "EXCEEDED" || scope.status === "OVERRUN";
            return (
              <div
                key={row.clientId}
                className="flex flex-col gap-1 rounded-lg border border-border/60 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/clients/${row.clientId}`}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {row.clientName}
                  </Link>
                  <span className={cn("text-xs font-medium", riskTone(past))}>
                    {scopeStatusLabel(scope.status)}
                  </span>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatHours(scope.used)} of {formatHours(scope.limit)} ·{" "}
                  {scope.percent.toFixed(0)}% used
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

const ACTIVITY_META: Record<
  ActivityEvent["kind"],
  { icon: LucideIcon; iconClass: string }
> = {
  TIME: { icon: Clock, iconClass: "text-primary" },
  CLIENT: { icon: Handshake, iconClass: "text-primary" },
  RETAINER: { icon: Banknote, iconClass: "text-primary" },
  ALERT: { icon: Bell, iconClass: "text-amber-500" },
  REPORT: { icon: FileText, iconClass: "text-primary" },
};

function ActivityCard({ events }: { events: ActivityEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          Recent activity
        </CardTitle>
        <CardDescription>Latest events across the workspace, newest first.</CardDescription>
      </CardHeader>
      <CardContent className="px-(--card-spacing)">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event) => {
              const meta = ACTIVITY_META[event.kind];
              const Icon = meta.icon;
              return (
                <Link
                  key={event.id}
                  href={event.href}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className={cn("size-3.5 shrink-0", meta.iconClass)} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-foreground">
                        {event.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {event.sub}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(event.at)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions({ capabilities }: { capabilities: Capabilities }) {
  const actions: Array<{
    label: string;
    href: string;
    icon: LucideIcon;
    show: boolean;
  }> = [
    {
      label: "Add Client",
      href: "/dashboard/clients",
      icon: Plus,
      show: capabilities.manageClients,
    },
    {
      label: "Log Time",
      href: "/dashboard/time",
      icon: Clock,
      show: capabilities.addTime,
    },
    {
      label: "Add Retainer",
      href: "/dashboard/clients",
      icon: Banknote,
      show: capabilities.manageClients,
    },
    {
      label: "Invite Team Member",
      href: "/settings/team",
      icon: UserPlus,
      show: capabilities.manageTeam,
    },
    {
      label: "Generate Report",
      href: "/reports",
      icon: FileText,
      show: capabilities.viewReports,
    },
  ].filter((action) => action.show);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="size-4 text-primary" />
          Quick actions
        </CardTitle>
        <CardDescription>Common tasks, one click away.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-(--card-spacing)">
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions available for your role.
          </p>
        ) : (
          actions.map((action) => {
            const Icon = action.icon;
            return (
              <ButtonLink
                key={action.label}
                href={action.href}
                variant="outline"
                className="justify-start"
              >
                <Icon className="size-4" />
                {action.label}
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </ButtonLink>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}