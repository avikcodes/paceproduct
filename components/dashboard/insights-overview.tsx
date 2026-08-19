"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import {
  ArrowUpRight,
  Banknote,
  BarChart3,
  Clock,
  Expand,
  Gauge,
  Handshake,
  Lightbulb,
  LogOut,
  Percent,
  PieChart as PieChartIcon,
  Rocket,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  applyInsightsFilter,
  computeAnalysis,
  formatInsightsRange,
  insightsRangeLabel,
  type InsightDataset,
  type InsightsAnalysis,
  type InsightsFilter,
  type InsightsRange,
  type OpportunityKind,
  type OpportunityRow,
  type Recommendation,
} from "@/lib/insights-analysis";
import { currencySymbol, formatMoney } from "@/lib/retainers";
import { formatHours } from "@/lib/time";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#64748b",
];

const MARGIN_STATUS_COLORS: Record<string, string> = {
  HEALTHY: "#10b981",
  WARNING: "#f59e0b",
  CRITICAL: "#ef4444",
};

const OPPORTUNITY_META: Record<
  OpportunityKind,
  { label: string; icon: LucideIcon; className: string }
> = {
  upsell: {
    label: "Upsell",
    icon: TrendingUp,
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  increaseRetainer: {
    label: "Raise retainer",
    icon: ArrowUpRight,
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  safeToExpand: {
    label: "Safe to expand",
    icon: Expand,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  renegotiate: {
    label: "Renegotiate",
    icon: Handshake,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  offboard: {
    label: "Offboard",
    icon: LogOut,
    className: "bg-destructive/10 text-destructive",
  },
};

function Segmented({
  value,
  onChange,
  ariaLabel,
}: {
  value: InsightsRange;
  onChange: (value: InsightsRange) => void;
  ariaLabel: string;
}) {
  const options: Array<{ value: InsightsRange; shortLabel: string }> = [
    { value: "THIS_MONTH", shortLabel: "This month" },
    { value: "LAST_QUARTER", shortLabel: "Quarter" },
    { value: "LAST_YEAR", shortLabel: "Year" },
  ];
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "whitespace-nowrap",
            value === option.value &&
              "bg-background text-foreground shadow-sm hover:bg-background dark:bg-background dark:hover:bg-background",
          )}
        >
          {option.shortLabel}
        </Button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  icon,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {icon}
          {label}
        </span>
        <span
          className={cn(
            "truncate text-xl leading-snug font-semibold sm:text-2xl",
            tone === "negative"
              ? "text-destructive"
              : tone === "positive"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground",
          )}
        >
          {value}
        </span>
        {caption && (
          <span className="text-xs text-muted-foreground">{caption}</span>
        )}
      </CardContent>
    </Card>
  );
}

function compactMoney(value: number, currency: string): string {
  const abs = Math.abs(value);
  const compact = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(abs);
  return `${value < 0 ? "-" : ""}${currencySymbol(currency)}${compact}`;
}

function MoneyTooltip({
  active,
  payload,
  label,
  currency,
}: Partial<TooltipContentProps<number, string>> & { currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey)}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-medium text-foreground tabular-nums">
              {formatMoney(Number(entry.value ?? 0), currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ data, currency }: { data: InsightsAnalysis["financialTrend"]; currency: string }) {
  const moneyTicks = (value: number) => compactMoney(value, currency);
  const tickStyle = { fontSize: 12, fill: "#64748b" };
  const commonAxisProps = {
    tickLine: false,
    axisLine: false,
    tick: tickStyle,
    tickMargin: 8,
  };
  const series = [
    { dataKey: "revenue", name: "Revenue", color: "#3b82f6" },
    { dataKey: "cost", name: "Cost", color: "#f59e0b" },
    { dataKey: "profit", name: "Profit", color: "#10b981" },
  ];

  return (
    <div className="h-72 w-full text-border">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="label" {...commonAxisProps} minTickGap={24} />
          <YAxis {...commonAxisProps} width={64} tickFormatter={moneyTicks} />
          <Tooltip content={<MoneyTooltip currency={currency} />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((item) => (
            <Bar
              key={item.dataKey}
              dataKey={item.dataKey}
              name={item.name}
              fill={item.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MatrixTooltip({
  active,
  payload,
  currency,
}: Partial<TooltipContentProps<number, string>> & { currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as {
    name: string;
    revenue: number;
    marginPercent: number;
    marginStatus: string;
  };
  return (
    <div className="rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm">
      <p className="text-xs font-medium text-foreground">{point.name}</p>
      <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span>Revenue {formatMoney(point.revenue, currency)}</span>
        <span>Margin {point.marginPercent.toFixed(1)}%</span>
        <span>{point.marginStatus.toLowerCase()}</span>
      </div>
    </div>
  );
}

function MatrixChart({
  analysis,
}: {
  analysis: InsightsAnalysis;
}) {
  const data = analysis.clientProfitability
    .filter((row) => row.revenue > 0)
    .map((row) => ({
      x: row.revenue,
      y: row.marginPercent,
      name: row.name,
      revenue: row.revenue,
      marginPercent: row.marginPercent,
      marginStatus: row.marginStatus,
    }));

  const tickStyle = { fontSize: 12, fill: "#64748b" };
  const commonAxisProps = {
    tickLine: false,
    axisLine: false,
    tick: tickStyle,
    tickMargin: 8,
  };

  return (
    <div>
      <div className="h-72 w-full text-border">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.35} />
            <XAxis
              type="number"
              dataKey="x"
              name="Revenue"
              {...commonAxisProps}
              tickFormatter={(value: number) => compactMoney(value, analysis.currency)}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Margin"
              {...commonAxisProps}
              tickFormatter={(value: number) => `${value}%`}
            />
            <ReferenceLine
              x={analysis.medianRevenue}
              stroke="currentColor"
              strokeOpacity={0.4}
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={analysis.healthyTarget}
              stroke="currentColor"
              strokeOpacity={0.4}
              strokeDasharray="4 4"
            />
            <Tooltip content={<MatrixTooltip currency={analysis.currency} />} cursor={{ strokeDasharray: "4 4" }} />
            <Scatter data={data} shape="circle">
              {data.map((point) => (
                <Cell
                  key={point.name}
                  fill={MARGIN_STATUS_COLORS[point.marginStatus] ?? "#64748b"}
                  fillOpacity={0.85}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-emerald-500" />
          Healthy margin
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-amber-500" />
          Warning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-red-500" />
          Critical
        </span>
        <span className="ml-auto">
          X = median revenue · Y = healthy margin target
        </span>
      </div>
    </div>
  );
}

function TimePieChart({
  rows,
}: {
  rows: InsightsAnalysis["timeByCategory"];
}) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <div className="h-56 w-full max-w-[260px] text-border">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="hours"
              nameKey="category"
              innerRadius={50}
              outerRadius={88}
              paddingAngle={2}
            >
              {rows.map((row, index) => (
                <Cell
                  key={row.category}
                  fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => `${formatHours(Number(value ?? 0))}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full flex-col gap-1.5">
        {rows.map((row, index) => (
          <li key={row.category} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
              />
              {row.category}
            </span>
            <span className="font-medium text-foreground tabular-nums">
              {formatHours(row.hours)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecommendationBadge({
  priority,
}: {
  priority: Recommendation["priority"];
}) {
  const styles: Record<Recommendation["priority"], string> = {
    HIGH: "bg-destructive/10 text-destructive",
    MEDIUM: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    LOW: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase",
        styles[priority],
      )}
    >
      {priority}
    </span>
  );
}

function OpportunityRowCard({ row, currency }: { row: OpportunityRow; currency: string }) {
  const meta = OPPORTUNITY_META[row.kind];
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              meta.className,
            )}
          >
            <meta.icon className="size-3" />
            {meta.label}
          </span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              row.marginPercent < 0
                ? "text-destructive"
                : "text-foreground",
            )}
          >
            {row.marginPercent.toFixed(1)}% margin
          </span>
        </div>
        <Link
          href={`/dashboard/clients/${row.clientId}`}
          className="truncate rounded-sm text-sm font-medium text-foreground outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {row.name}
        </Link>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {row.reason}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatMoney(row.revenue, currency)} revenue ·{" "}
          {formatMoney(row.profit, currency)} profit
        </span>
      </CardContent>
    </Card>
  );
}

export function InsightsOverview({ dataset }: { dataset: InsightDataset }) {
  const now = useMemo(() => new Date(), []);
  const [filter, setFilter] = useState<InsightsFilter>({
    clientId: null,
    memberId: null,
    range: "LAST_QUARTER",
  });

  const filtered = useMemo(
    () => applyInsightsFilter(dataset, filter, now),
    [dataset, filter, now],
  );

  const analysis = useMemo(
    () => computeAnalysis(filtered, now, filter),
    [filtered, now, filter],
  );

  const hasClients = dataset.clients.length > 0;
  const isFiltered = filter.clientId !== null || filter.memberId !== null;

  const opportunityGroups = useMemo(() => {
    const groups = new Map<OpportunityKind, OpportunityRow[]>();
    for (const row of analysis.opportunities) {
      const list = groups.get(row.kind) ?? [];
      list.push(row);
      groups.set(row.kind, list);
    }
    return [...groups.entries()];
  }, [analysis.opportunities]);

  const leakageTotal = useMemo(
    () =>
      analysis.leakage.reduce(
        (total, row) =>
          total + (row.revenue * (row.healthyThreshold - row.marginPercent)) / 100,
        0,
      ),
    [analysis.leakage],
  );

  if (!hasClients) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={BarChart3}
            title="No clients yet"
            description="Create a client, set a retainer, and log time to start seeing profitability insights."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-4 text-muted-foreground" />
                {insightsRangeLabel(filter.range)}
              </CardTitle>
              <CardDescription>
                {formatInsightsRange(analysis.startDate, analysis.endDate)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                ariaLabel="Insight time range"
                value={filter.range}
                onChange={(range) => setFilter((prev) => ({ ...prev, range }))}
              />
              <Select
                value={filter.clientId ?? "all"}
                onValueChange={(value) =>
                  setFilter((prev) => ({
                    ...prev,
                    clientId: value === "all" ? null : value,
                  }))
                }
              >
                <SelectTrigger className="w-44" aria-label="Filter by client">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {dataset.clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filter.memberId ?? "all"}
                onValueChange={(value) =>
                  setFilter((prev) => ({
                    ...prev,
                    memberId: value === "all" ? null : value,
                  }))
                }
              >
                <SelectTrigger className="w-44" aria-label="Filter by member">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {dataset.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isFiltered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFilter({ clientId: null, memberId: null, range: filter.range })
                  }
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Financial overview"
      >
        <StatCard
          label="Revenue"
          value={formatMoney(analysis.financial.revenue, analysis.currency)}
          caption={`${analysis.monthCount} month${analysis.monthCount === 1 ? "" : "s"} · active retainer budgets`}
          icon={<Wallet className="size-3.5" />}
        />
        <StatCard
          label="Cost"
          value={analysis.financial.hasUnknownCost ? "—" : formatMoney(analysis.financial.cost, analysis.currency)}
          caption={
            analysis.financial.hasUnknownCost
              ? "Cost data unavailable"
              : "Logged hours × cost rate"
          }
          icon={<TrendingDown className="size-3.5" />}
        />
        <StatCard
          label="Profit"
          value={analysis.financial.hasUnknownCost ? "—" : formatMoney(analysis.financial.profit, analysis.currency)}
          caption={
            analysis.financial.hasUnknownCost
              ? "Cost data unavailable"
              : `Margin ${analysis.financial.marginPercent.toFixed(1)}%`
          }
          icon={<TrendingUp className="size-3.5" />}
          tone={
            analysis.financial.hasUnknownCost
              ? undefined
              : analysis.financial.profit < 0
                ? "negative"
                : analysis.financial.profit > 0
                  ? "positive"
                  : undefined
          }
        />
        <StatCard
          label="Avg client profit"
          value={
            analysis.financial.hasUnknownCost
              ? "—"
              : formatMoney(analysis.financial.averageClientProfit, analysis.currency)
          }
          caption={
            analysis.financial.hasUnknownCost
              ? "Cost data unavailable"
              : "Profit ÷ revenue-generating clients"
          }
          icon={<Banknote className="size-3.5" />}
          tone={
            analysis.financial.hasUnknownCost
              ? undefined
              : analysis.financial.averageClientProfit < 0
                ? "negative"
                : analysis.financial.averageClientProfit > 0
                  ? "positive"
                  : undefined
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            Financial trend
          </CardTitle>
          <CardDescription>
            Revenue, cost, and profit per month. Gross margin equals net margin
            here because no fixed overhead is modeled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysis.financialTrend.length > 0 ? (
            <TrendChart data={analysis.financialTrend} currency={analysis.currency} />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No trend data"
              description="Log time and set up retainers to see monthly trends."
            />
          )}
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="size-4 text-muted-foreground" />
              Client profitability matrix
            </CardTitle>
            <CardDescription>
              Revenue versus margin for each client. The top-right quadrant is
              your strongest portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.clientProfitability.some((row) => row.revenue > 0) ? (
              <MatrixChart analysis={analysis} />
            ) : (
              <EmptyState
                icon={Rocket}
                title="No profitable data"
                description="Set retainers and log time to plot your clients."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-4 text-muted-foreground" />
              Agency efficiency
            </CardTitle>
            <CardDescription>
              How well you convert billable hours into profit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard
                label="Utilization"
                value={`${analysis.efficiency.utilizationPercent.toFixed(1)}%`}
                caption="Billable vs capacity"
                icon={<Percent className="size-3.5" />}
              />
              <StatCard
                label="Effective rate"
                value={formatMoney(analysis.efficiency.effectiveHourlyRate, analysis.currency)}
                caption="Revenue ÷ hours"
                icon={<Clock className="size-3.5" />}
              />
              <StatCard
                label="Billable hours"
                value={formatHours(analysis.efficiency.billableHours)}
                caption="In this range"
                icon={<Users className="size-3.5" />}
              />
              <StatCard
                label="Avg billing rate"
                value={formatMoney(analysis.efficiency.averageBillingRate, analysis.currency)}
                caption="Per team member"
                icon={<Wallet className="size-3.5" />}
              />
              <StatCard
                label="Avg team cost"
                value={analysis.efficiency.hasUnknownCost ? "—" : formatMoney(analysis.efficiency.averageTeamCost, analysis.currency)}
                caption="Per team member"
                icon={<TrendingDown className="size-3.5" />}
              />
              <StatCard
                label="Recovery rate"
                value={
                  analysis.efficiency.hasUnknownCost
                    ? "—"
                    : `${analysis.efficiency.recoveryRate.toFixed(1)}%`
                }
                caption="Billing vs cost"
                icon={<Percent className="size-3.5" />}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="size-4 text-muted-foreground" />
              Time analysis
            </CardTitle>
            <CardDescription>
              Where billable hours go, by task category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.timeByCategory.length > 0 ? (
              <TimePieChart rows={analysis.timeByCategory} />
            ) : (
              <EmptyState
                icon={PieChartIcon}
                title="No time logged"
                description="Log time entries to see where hours go."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Team performance
            </CardTitle>
            <CardDescription>
              Revenue share is prorated by hours within each client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.team.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No team members"
                description="Add team members to see performance."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Util.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.team.map((row) => (
                    <TableRow key={row.memberId}>
                      <TableCell className="font-medium text-foreground">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatHours(row.billableHours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.revenue, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.hasUnknownCost
                          ? "—"
                          : formatMoney(row.cost, analysis.currency)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          row.profit < 0
                            ? "text-destructive"
                            : row.profit > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {row.hasUnknownCost
                          ? "—"
                          : formatMoney(row.profit, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div
                          role="progressbar"
                          aria-valuenow={Math.round(row.utilization)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${row.name} utilization`}
                          className="ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-muted"
                        >
                          <div
                            className={cn(
                              "h-full rounded-full",
                              row.utilization >= 70
                                ? "bg-emerald-500"
                                : row.utilization >= 40
                                  ? "bg-amber-500"
                                  : "bg-destructive",
                            )}
                            style={{ width: `${row.utilization}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ForecastCard
          title="Next 30 days"
          forecast={analysis.forecast.next30Days}
          currency={analysis.currency}
        />
        <ForecastCard
          title="Next quarter"
          forecast={analysis.forecast.nextQuarter}
          currency={analysis.currency}
        />
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="size-4 text-muted-foreground" />
              Profit leakage
            </CardTitle>
            <CardDescription>
              Clients below their healthy margin target.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {analysis.leakage.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                title="No leakage"
                description="Every revenue-generating client is at or above their margin target."
                className="py-10"
              />
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  Closing the gap to target would recover{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(leakageTotal, analysis.currency)}
                  </span>{" "}
                  per period.
                </p>
                <ul className="flex flex-col gap-1">
                  {analysis.leakage.map((row) => (
                    <li key={row.clientId}>
                      <Link
                        href={`/dashboard/clients/${row.clientId}`}
                        className="group flex items-center justify-between gap-3 rounded-md px-1.5 py-2 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground group-hover:text-primary">
                          {row.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {row.marginPercent.toFixed(1)}% vs {row.healthyThreshold}% target
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-4 text-muted-foreground" />
            Recommendations
          </CardTitle>
          <CardDescription>
            Rule-based suggestions prioritized by estimated financial impact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysis.recommendations.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="No recommendations"
              description="Log more data and recommendations will appear here."
            />
          ) : (
            <ul className="flex flex-col divide-y">
              {analysis.recommendations.map((recommendation) => (
                <li
                  key={recommendation.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                      recommendation.priority === "HIGH"
                        ? "bg-destructive/10 text-destructive"
                        : recommendation.priority === "MEDIUM"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-sky-500/10 text-sky-700 dark:text-sky-400",
                    )}
                  >
                    <Lightbulb className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {recommendation.title}
                      </span>
                      <RecommendationBadge priority={recommendation.priority} />
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {recommendation.detail}
                    </p>
                    {recommendation.clientId && (
                      <Link
                        href={`/dashboard/clients/${recommendation.clientId}`}
                        className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        View client
                      </Link>
                    )}
                  </div>
                  {recommendation.impact > 0 && (
                    <span className="shrink-0 text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                      {formatMoney(recommendation.impact, analysis.currency)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-muted-foreground" />
            Opportunity finder
          </CardTitle>
          <CardDescription>
            Actions that could grow revenue or protect margin, by client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {opportunityGroups.length === 0 ? (
            <EmptyState
              icon={Rocket}
              title="No opportunities yet"
              description="Add revenue-generating clients to surface opportunities."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {opportunityGroups.map(([kind, rows]) => {
                const meta = OPPORTUNITY_META[kind];
                const Icon = meta.icon;
                return (
                <div key={kind} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        meta.className,
                      )}
                    >
                      <Icon className="size-3" />
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {rows.length}
                    </span>
                  </div>
                  {rows.map((row) => (
                    <OpportunityRowCard
                      key={row.clientId}
                      row={row}
                      currency={analysis.currency}
                    />
                  ))}
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ForecastCard({
  title,
  forecast,
  currency,
}: {
  title: string;
  forecast: InsightsAnalysis["forecast"]["next30Days"];
  currency: string;
}) {
  return (
    <Card size="sm" className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          Forecast
        </CardTitle>
        <CardDescription>
          {title} at current run rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <span
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            forecast.profit < 0 ? "text-destructive" : "text-foreground",
          )}
        >
          {formatMoney(forecast.profit, currency)}
        </span>
        <dl className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Revenue</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatMoney(forecast.revenue, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Cost</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatMoney(forecast.cost, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Margin</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {forecast.marginPercent.toFixed(1)}%
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
