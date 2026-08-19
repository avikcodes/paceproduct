export const INSIGHT_RANGES = [
  "THIS_MONTH",
  "LAST_30_DAYS",
  "LAST_QUARTER",
  "LAST_YEAR",
] as const;

export type InsightRange = (typeof INSIGHT_RANGES)[number];

export type InsightMonthlyRow = {
  key: string;
  year: number;
  month: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  hasUnknownCost: boolean;
};

export type InsightTotals = {
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  months: InsightMonthlyRow[];
  hasUnknownCost: boolean;
};

export const INSIGHT_RANGE_OPTIONS: ReadonlyArray<{
  value: InsightRange;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "THIS_MONTH",
    label: "This month",
    shortLabel: "This month",
    description: "Current calendar month to date",
  },
  {
    value: "LAST_30_DAYS",
    label: "Last 30 days",
    shortLabel: "30 days",
    description: "Rolling 30-day window",
  },
  {
    value: "LAST_QUARTER",
    label: "Last quarter",
    shortLabel: "Quarter",
    description: "Trailing 3 calendar months",
  },
  {
    value: "LAST_YEAR",
    label: "Last year",
    shortLabel: "Year",
    description: "Trailing 12 calendar months",
  },
];

export function insightRangeLabel(range: InsightRange): string {
  return (
    INSIGHT_RANGE_OPTIONS.find((option) => option.value === range)?.label ??
    range
  );
}

export function formatInsightRangeDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatInsightRange(startDate: Date, endDate: Date): string {
  return `${formatInsightRangeDate(startDate)} – ${formatInsightRangeDate(endDate)}`;
}
