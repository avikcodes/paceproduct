import "server-only";
import {
  DEFAULT_MARGIN_THRESHOLDS,
  type MarginStatus,
  type MarginThresholds,
} from "@/lib/margin-status";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { BillingCycle } from "@/lib/generated/prisma/enums";
import { retainerMonthlyAmount } from "@/lib/retainers";
import {
  accumulateEntryCosts,
  computeMargin,
  retainerRevenueForPeriod,
} from "@/lib/financials";
import {
  DEFAULT_MARGIN_TREND_RANGE,
  MARGIN_TREND_RANGES,
  type MarginTrendRange,
} from "@/lib/margin-trend-ranges";
export { DEFAULT_MARGIN_TREND_RANGE, MARGIN_TREND_RANGES };
export type { MarginTrendRange };

export type { MarginStatus } from "@/lib/margin-status";
export type { MarginThresholds } from "@/lib/margin-status";

export type MarginSummary = {
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  status: MarginStatus;
  currency: string;
  thresholds: MarginThresholds;
};

export type MonthlyMarginRow = {
  key: string;
  year: number;
  month: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  hours: number;
  /**
   * Set when any entry in the month has an unset cost rate (0). Cost is then
   * incomplete and margin is reported as 0 instead of a misleading figure.
   */
  hasUnknownCost?: boolean;
};

export type ClientMarginDetails = {
  summary: MarginSummary;
  totalHours: number;
  effectiveHourlyRate: number;
  months: MonthlyMarginRow[];
  currency: string;
};

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function statusForMargin(
  revenue: number,
  marginPercent: number,
  thresholds: MarginThresholds,
): MarginStatus {
  if (revenue <= 0) return "CRITICAL";
  if (marginPercent >= thresholds.healthy) return "HEALTHY";
  if (marginPercent >= thresholds.warning) return "WARNING";
  if (marginPercent >= thresholds.critical) return "CRITICAL";
  return "CRITICAL";
}

export function calculateMargin(
  revenue: number,
  cost: number,
  currency = "USD",
  thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS,
): MarginSummary {
  const safeRevenue = Math.max(0, revenue || 0);
  const safeCost = Math.max(0, cost || 0);
  const profit = roundToTwo(safeRevenue - safeCost);
  const marginPercent =
    safeRevenue > 0 ? ((safeRevenue - safeCost) / safeRevenue) * 100 : 0;

  return {
    revenue: roundToTwo(safeRevenue),
    cost: roundToTwo(safeCost),
    profit,
    marginPercent: Math.round(marginPercent * 10) / 10,
    status: statusForMargin(safeRevenue, marginPercent, thresholds),
    currency,
    thresholds,
  };
}

type DecimalLike = { toNumber(): number };

export function toMarginThresholds(row: {
  healthyThreshold: DecimalLike;
  warningThreshold: DecimalLike;
  criticalThreshold: DecimalLike;
}): MarginThresholds {
  return {
    healthy: row.healthyThreshold.toNumber(),
    warning: row.warningThreshold.toNumber(),
    critical: row.criticalThreshold.toNumber(),
  };
}

const marginThresholdsSelect = {
  healthyThreshold: true,
  warningThreshold: true,
  criticalThreshold: true,
} as const;

export async function getClientMarginThresholds(
  clientId: string,
  workspaceId: string,
): Promise<MarginThresholds> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: marginThresholdsSelect,
  });

  return client ? toMarginThresholds(client) : DEFAULT_MARGIN_THRESHOLDS;
}

type MarginClientData = {
  healthyThreshold: DecimalLike;
  warningThreshold: DecimalLike;
  criticalThreshold: DecimalLike;
  retainers: Array<{
    monthlyBudget: DecimalLike;
    currency: string;
    billingCycle: BillingCycle;
  }>;
  timeEntries: Array<{
    hours: DecimalLike;
    member: { costRate: DecimalLike };
  }>;
};

function computeClientMargin(client: MarginClientData): MarginSummary {
  const retainer = client.retainers[0];
  const revenue = retainer
    ? retainerMonthlyAmount(
        retainer.monthlyBudget.toNumber(),
        retainer.billingCycle,
      )
    : 0;
  const currency = retainer?.currency ?? "USD";
  const cost = client.timeEntries.reduce(
    (total, entry) =>
      total + entry.hours.toNumber() * entry.member.costRate.toNumber(),
    0,
  );
  const thresholds = toMarginThresholds(client);

  return calculateMargin(revenue, cost, currency, thresholds);
}

export async function getClientMargin(
  clientId: string,
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<MarginSummary> {
  const client = await db.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      ...marginThresholdsSelect,
      retainers: {
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { monthlyBudget: true, currency: true, billingCycle: true },
      },
      timeEntries: {
        select: {
          hours: true,
          member: { select: { costRate: true } },
        },
      },
    },
  });

  if (!client) return calculateMargin(0, 0);

  return computeClientMargin(client);
}

export async function getClientMargins(
  workspaceId: string,
): Promise<Record<string, MarginSummary>> {
  const clients = await prisma.client.findMany({
    where: { workspaceId },
    select: {
      id: true,
      ...marginThresholdsSelect,
      retainers: {
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { monthlyBudget: true, currency: true, billingCycle: true },
      },
      timeEntries: {
        select: {
          hours: true,
          member: { select: { costRate: true } },
        },
      },
    },
  });

  return Object.fromEntries(
    clients.map((client) => [client.id, computeClientMargin(client)]),
  );
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function emptyClientMarginDetails(
  currency: string,
  thresholds: MarginThresholds,
): ClientMarginDetails {
  return {
    summary: calculateMargin(0, 0, currency, thresholds),
    totalHours: 0,
    effectiveHourlyRate: 0,
    months: [],
    currency,
  };
}

export type MonthlyMarginData = {
  healthyThreshold: DecimalLike;
  warningThreshold: DecimalLike;
  criticalThreshold: DecimalLike;
  retainers: Array<{
    monthlyBudget: DecimalLike;
    currency: string;
    billingCycle: BillingCycle;
    startDate: Date;
    endDate: Date | null;
  }>;
  timeEntries: Array<{
    hours: DecimalLike;
    workDate: Date;
    member: { costRate: DecimalLike };
  }>;
};

function toMonthlyRow(
  key: string,
  revenue: number,
  cost: number,
  hours: number,
  currency: string,
  thresholds: MarginThresholds,
): MonthlyMarginRow {
  const margin = calculateMargin(revenue, cost, currency, thresholds);
  return {
    key,
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)),
    revenue: margin.revenue,
    cost: margin.cost,
    profit: margin.profit,
    marginPercent: margin.marginPercent,
    hours: roundToTwo(hours),
  };
}

export function computeMonthlyMarginRows(client: MonthlyMarginData): {
  months: MonthlyMarginRow[];
  totalHours: number;
  currency: string;
} {
  const retainer = client.retainers[0];
  const currency = retainer?.currency ?? "USD";
  const thresholds = toMarginThresholds(client);

  const buckets = new Map<
    string,
    { revenue: number; cost: number; hours: number }
  >();

  for (const entry of client.timeEntries) {
    const key = monthKey(entry.workDate);
    const bucket = buckets.get(key) ?? { revenue: 0, cost: 0, hours: 0 };
    bucket.cost += entry.hours.toNumber() * entry.member.costRate.toNumber();
    bucket.hours += entry.hours.toNumber();
    buckets.set(key, bucket);
  }

  if (retainer) {
    const revenue = retainerMonthlyAmount(
      retainer.monthlyBudget.toNumber(),
      retainer.billingCycle,
    );
    const windowStart = retainer.startDate;
    const windowEnd = retainer.endDate ?? new Date();

    for (const [key, bucket] of buckets) {
      const [year, month] = key.split("-").map(Number);
      const firstDay = new Date(Date.UTC(year, month - 1, 1));
      const lastDay = new Date(Date.UTC(year, month, 0));
      if (lastDay >= windowStart && firstDay <= windowEnd) {
        bucket.revenue = revenue;
      }
    }
  }

  const months = [...buckets.entries()]
    .map(([key, bucket]) =>
      toMonthlyRow(
        key,
        bucket.revenue,
        bucket.cost,
        bucket.hours,
        currency,
        thresholds,
      ),
    )
    .sort((a, b) => b.key.localeCompare(a.key));

  const totalHours = [...buckets.values()].reduce(
    (total, bucket) => total + bucket.hours,
    0,
  );

  return { months, totalHours, currency };
}

export async function getClientMarginDetails(
  clientId: string,
  workspaceId: string,
): Promise<ClientMarginDetails> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      ...marginThresholdsSelect,
      retainers: {
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          monthlyBudget: true,
          currency: true,
          billingCycle: true,
          startDate: true,
          endDate: true,
        },
      },
      timeEntries: {
        orderBy: { workDate: "asc" },
        select: {
          hours: true,
          workDate: true,
          member: { select: { costRate: true } },
        },
      },
    },
  });

  if (!client) return emptyClientMarginDetails("USD", DEFAULT_MARGIN_THRESHOLDS);

  const { months, totalHours, currency } = computeMonthlyMarginRows(client);
  const thresholds = toMarginThresholds(client);

  const totalRevenue = months.reduce((total, month) => total + month.revenue, 0);
  const totalCost = months.reduce((total, month) => total + month.cost, 0);

  const summary = calculateMargin(totalRevenue, totalCost, currency, thresholds);
  const effectiveHourlyRate =
    totalHours > 0 ? roundToTwo(totalRevenue / totalHours) : 0;

  return {
    summary,
    totalHours: roundToTwo(totalHours),
    effectiveHourlyRate,
    months,
    currency,
  };
}

export type MarginTrendsData = {
  clients: Array<{
    id: string;
    name: string;
    currency: string;
    months: MonthlyMarginRow[];
  }>;
  allMonths: MonthlyMarginRow[];
  currency: string;
};

function aggregateMonthlyRows(
  monthLists: MonthlyMarginRow[][],
  currency: string,
): MonthlyMarginRow[] {
  const totals = new Map<
    string,
    {
      year: number;
      month: number;
      revenue: number;
      cost: number;
      hours: number;
      hasUnknownCost: boolean;
    }
  >();

  for (const months of monthLists) {
    for (const month of months) {
      const bucket = totals.get(month.key) ?? {
        year: month.year,
        month: month.month,
        revenue: 0,
        cost: 0,
        hours: 0,
        hasUnknownCost: false,
      };
      bucket.revenue += month.revenue;
      bucket.cost += month.cost;
      bucket.hours += month.hours;
      bucket.hasUnknownCost =
        bucket.hasUnknownCost || (month.hasUnknownCost ?? false);
      totals.set(month.key, bucket);
    }
  }

  return [...totals.entries()]
    .map(([key, bucket]) => {
      const revenue = roundToTwo(bucket.revenue);
      const cost = roundToTwo(bucket.cost);
      const { profit, marginPercent } = computeMargin(
        revenue,
        cost,
        bucket.hasUnknownCost,
      );
      return {
        key,
        year: bucket.year,
        month: bucket.month,
        revenue,
        cost,
        profit,
        marginPercent,
        hours: roundToTwo(bucket.hours),
        hasUnknownCost: bucket.hasUnknownCost,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export type MarginTrendClientInput = {
  id: string;
  name: string;
  currency: string;
  retainer: {
    monthlyBudget: number;
    billingCycle: BillingCycle;
    startDate: Date;
    endDate: Date | null;
  } | null;
  entries: Array<{ hours: number; workDate: Date; costRate: number }>;
};

/**
 * The latest `months` calendar months ending at the current (partial) month.
 * The current month is always the newest point; the rest are full calendar
 * months. Returns them oldest-to-newest.
 */
function monthStepsForWindow(
  now: Date,
  months: MarginTrendRange,
): Array<{ year: number; month: number }> {
  const steps: Array<{ year: number; month: number }> = [];
  for (let offset = months - 1; offset >= 0; offset--) {
    const anchor = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    steps.push({
      year: anchor.getUTCFullYear(),
      month: anchor.getUTCMonth() + 1,
    });
  }
  return steps;
}

/**
 * One aggregated point per calendar month over the selected window, using the
 * same canonical revenue and cost rules as the rest of the product: revenue
 * comes from retainerRevenueForPeriod (an active retainer is recognized every
 * month it is active in, prorated only by the retainer's own start/end) and
 * cost comes from accumulateEntryCosts over that month's time entries, keyed
 * by the entry's work date (never createdAt). Months with no revenue or hours
 * are kept as zero points so the timeline stays accurate, and the current
 * partial month is always included as the newest point.
 */
function clientTrendMonths(
  client: MarginTrendClientInput,
  now: Date,
  months: MarginTrendRange,
): MonthlyMarginRow[] {
  const rows: MonthlyMarginRow[] = [];

  for (const { year, month } of monthStepsForWindow(now, months)) {
    const monthStartMs = Date.UTC(year, month - 1, 1);
    const monthEndMs = Date.UTC(year, month, 1);

    const revenue = client.retainer
      ? retainerRevenueForPeriod(
          [client.retainer],
          monthStartMs,
          monthEndMs,
          now,
        )
      : 0;

    const monthEntries = client.entries.filter((entry) => {
      const time = entry.workDate.getTime();
      return time >= monthStartMs && time < monthEndMs;
    });
    const { cost, hasUnknownCost } = accumulateEntryCosts(
      monthEntries.map((entry) => ({
        hours: entry.hours,
        costRate: entry.costRate,
      })),
    );
    const hours = monthEntries.reduce((total, entry) => total + entry.hours, 0);
    const { profit, marginPercent } = computeMargin(
      revenue,
      cost,
      hasUnknownCost,
    );

    rows.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      year,
      month,
      revenue: roundToTwo(revenue),
      cost,
      profit,
      marginPercent,
      hours: roundToTwo(hours),
      hasUnknownCost,
    });
  }

  return rows;
}

export function computeMarginTrends(
  clients: MarginTrendClientInput[],
  now: Date,
  months: MarginTrendRange = DEFAULT_MARGIN_TREND_RANGE,
): MarginTrendsData {
  const rows = clients.map((client) => ({
    id: client.id,
    name: client.name,
    currency: client.currency,
    months: clientTrendMonths(client, now, months),
  }));

  const currency = rows.find((row) => row.months.length > 0)?.currency ?? "USD";

  return {
    clients: rows,
    allMonths: aggregateMonthlyRows(
      rows.map((row) => row.months),
      currency,
    ),
    currency,
  };
}

export async function getMarginTrends(
  workspaceId: string,
  months: MarginTrendRange = DEFAULT_MARGIN_TREND_RANGE,
): Promise<MarginTrendsData> {
  const now = new Date();
  const windowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );

  const clients = await prisma.client.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      retainers: {
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          monthlyBudget: true,
          currency: true,
          billingCycle: true,
          startDate: true,
          endDate: true,
        },
      },
      timeEntries: {
        where: { workDate: { gte: windowStart } },
        orderBy: { workDate: "asc" },
        select: {
          hours: true,
          workDate: true,
          member: { select: { costRate: true } },
        },
      },
    },
  });

  return computeMarginTrends(
    clients.map((client) => {
      const retainer = client.retainers[0];
      return {
        id: client.id,
        name: client.name,
        currency: retainer?.currency ?? "USD",
        retainer: retainer
          ? {
              monthlyBudget: retainer.monthlyBudget.toNumber(),
              billingCycle: retainer.billingCycle,
              startDate: retainer.startDate,
              endDate: retainer.endDate,
            }
          : null,
        entries: client.timeEntries.map((entry) => ({
          hours: entry.hours.toNumber(),
          workDate: entry.workDate,
          costRate: entry.member.costRate.toNumber(),
        })),
      };
    }),
    now,
    months,
  );
}
