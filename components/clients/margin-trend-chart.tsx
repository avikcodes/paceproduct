"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { ChartArea, ChartLine, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { MonthlyMarginRow } from "@/lib/margins";
import {
  DEFAULT_MARGIN_TREND_RANGE,
  type MarginTrendRange,
} from "@/lib/margin-trend-ranges";
import { currencySymbol, formatMoney } from "@/lib/retainers";
import { cn } from "@/lib/utils";

type ChartType = "line" | "area";

type ChartDatum = {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
};

const MONEY_AXIS = "money";
const PERCENT_AXIS = "percent";

const SERIES: ReadonlyArray<{
  dataKey: keyof Omit<ChartDatum, "month">;
  name: string;
  color: string;
  axis: string;
}> = [
  { dataKey: "revenue", name: "Revenue", color: "#3b82f6", axis: MONEY_AXIS },
  { dataKey: "cost", name: "Cost", color: "#f59e0b", axis: MONEY_AXIS },
  { dataKey: "profit", name: "Profit", color: "#10b981", axis: MONEY_AXIS },
  {
    dataKey: "marginPercent",
    name: "Margin %",
    color: "#8b5cf6",
    axis: PERCENT_AXIS,
  },
];

const RANGE_OPTIONS: ReadonlyArray<{ value: MarginTrendRange; label: string }> = [
  { value: 3, label: "3 mo" },
  { value: 6, label: "6 mo" },
  { value: 12, label: "12 mo" },
];

const CHART_TYPE_OPTIONS: ReadonlyArray<{
  value: ChartType;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "line", label: "Line", icon: <ChartLine /> },
  { value: "area", label: "Area", icon: <ChartArea /> },
];

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function sliceByRange(
  months: MonthlyMarginRow[],
  range: MarginTrendRange,
): MonthlyMarginRow[] {
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (range - 1), 1),
  );

  return months
    .filter(
      (month) => new Date(Date.UTC(month.year, month.month - 1, 1)) >= cutoff,
    )
    .sort((a, b) => a.key.localeCompare(b.key));
}

function formatCompactMoney(value: number, currency: string): string {
  const abs = Math.abs(value);
  const compact = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(abs);
  return `${value < 0 ? "-" : ""}${currencySymbol(currency)}${compact}`;
}

function Segmented<T>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: React.ReactNode }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-lg bg-muted p-1"
    >
      {options.map((option) => (
        <Button
          key={String(option.value)}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            value === option.value &&
              "bg-background text-foreground shadow-sm hover:bg-background dark:bg-background dark:hover:bg-background",
          )}
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function ChartTooltip({
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
        {payload.map((entry) => {
          const value = Number(entry.value ?? 0);
          const isPercent = entry.dataKey === "marginPercent";
          return (
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
                {isPercent
                  ? `${value.toFixed(1)}%`
                  : formatMoney(value, currency)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendCard({
  chartType,
  chartData,
  currency,
}: {
  chartType: ChartType;
  chartData: ChartDatum[];
  currency: string;
}) {
  const moneyTicks = (value: number) => formatCompactMoney(value, currency);
  const percentTicks = (value: number) => `${value}%`;
  const tickStyle = { fontSize: 12, fill: "#64748b" };

  const commonAxisProps = {
    tickLine: false,
    axisLine: false,
    tick: tickStyle,
    tickMargin: 8,
  };

  return (
    <div className="h-80 w-full text-border">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "line" ? (
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.35} vertical={false} />
            <XAxis dataKey="month" {...commonAxisProps} minTickGap={24} />
            <YAxis yAxisId={MONEY_AXIS} {...commonAxisProps} width={64} tickFormatter={moneyTicks} />
            <YAxis yAxisId={PERCENT_AXIS} orientation="right" {...commonAxisProps} width={44} tickFormatter={percentTicks} />
            <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: "hsl(var(--border))" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SERIES.map((series) => (
              <Line
                key={series.dataKey}
                type="monotone"
                dataKey={series.dataKey}
                name={series.name}
                yAxisId={series.axis}
                stroke={series.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.35} vertical={false} />
            <XAxis dataKey="month" {...commonAxisProps} minTickGap={24} />
            <YAxis yAxisId={MONEY_AXIS} {...commonAxisProps} width={64} tickFormatter={moneyTicks} />
            <YAxis yAxisId={PERCENT_AXIS} orientation="right" {...commonAxisProps} width={44} tickFormatter={percentTicks} />
            <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: "hsl(var(--border))" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SERIES.map((series) => (
              <Area
                key={series.dataKey}
                type="monotone"
                dataKey={series.dataKey}
                name={series.name}
                yAxisId={series.axis}
                stroke={series.color}
                strokeWidth={2}
                fill={series.color}
                fillOpacity={0.15}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function MarginTrendChart({
  months,
  currency,
  range: controlledRange,
  onRangeChange,
}: {
  months: MonthlyMarginRow[];
  currency: string;
  range?: MarginTrendRange;
  onRangeChange?: (range: MarginTrendRange) => void;
}) {
  const isRangeControlled =
    controlledRange !== undefined && onRangeChange !== undefined;
  const [internalRange, setInternalRange] = useState<MarginTrendRange>(
    DEFAULT_MARGIN_TREND_RANGE,
  );
  const range = isRangeControlled ? controlledRange : internalRange;
  const [chartType, setChartType] = useState<ChartType>("line");

  const chartData = useMemo(() => {
    const source = isRangeControlled ? months : sliceByRange(months, range);
    return source.map((month) => ({
      month: monthLabel(month.year, month.month),
      revenue: month.revenue,
      cost: month.cost,
      profit: month.profit,
      marginPercent: month.marginPercent,
    }));
  }, [months, range, isRangeControlled]);

  const hasData = chartData.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          Margin trend
        </CardTitle>
        <CardDescription>
          Revenue, cost, profit, and margin % over time.
        </CardDescription>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            ariaLabel="Chart type"
            value={chartType}
            options={CHART_TYPE_OPTIONS}
            onChange={setChartType}
          />
          <Segmented
            ariaLabel="Time range"
            value={range}
            options={RANGE_OPTIONS}
            onChange={(next) =>
              isRangeControlled
                ? onRangeChange(next)
                : setInternalRange(next)
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <TrendCard
            chartType={chartType}
            chartData={chartData}
            currency={currency}
          />
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No trend data"
            description="Log time entries for this client to see margin trends."
          />
        )}
      </CardContent>
    </Card>
  );
}
