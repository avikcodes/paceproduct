import type { MarginStatus } from "@/lib/margin-status";
import type { BillingCycle } from "@/lib/generated/prisma/enums";
import {
  accumulateEntryCosts,
  retainerRevenueForPeriod,
  type RetainerRevenueLike,
} from "@/lib/financials";

export const INSIGHTS_ANALYSIS_RANGES = [
  "THIS_MONTH",
  "LAST_QUARTER",
  "LAST_YEAR",
] as const;

export type InsightsRange = (typeof INSIGHTS_ANALYSIS_RANGES)[number];

export type DatasetRetainer = {
  monthlyBudget: number;
  currency: string;
  billingCycle: BillingCycle;
  scopeHours: number;
  startDate: Date;
  endDate: Date | null;
};

export type DatasetClient = {
  id: string;
  name: string;
  currency?: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  healthyThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  createdAt: Date;
  retainers: DatasetRetainer[];
};

export type DatasetMember = {
  id: string;
  name: string;
  costRate: number;
  billingRate: number;
  currency: string;
};

export type DatasetEntry = {
  id: string;
  clientId: string;
  memberId: string;
  task: string;
  hours: number;
  workDate: Date;
  createdAt: Date;
};

export type DatasetReport = {
  id: string;
  clientId: string;
  reportMonth: Date;
  marginPercent: number;
  generatedAt: Date;
};

export type InsightDataset = {
  currency: string;
  clients: DatasetClient[];
  members: DatasetMember[];
  entries: DatasetEntry[];
  reports: DatasetReport[];
};

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function insightsRangeBounds(
  range: InsightsRange,
  now: Date,
): { start: Date; end: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const end = new Date(Date.UTC(year, month, now.getUTCDate() + 1));

  switch (range) {
    case "THIS_MONTH":
      return { start: new Date(Date.UTC(year, month, 1)), end };
    case "LAST_QUARTER":
      return { start: new Date(Date.UTC(year, month - 2, 1)), end };
    case "LAST_YEAR":
      return { start: new Date(Date.UTC(year, month - 11, 1)), end };
  }
}

export function insightsRangeLabel(range: InsightsRange): string {
  switch (range) {
    case "THIS_MONTH":
      return "This month";
    case "LAST_QUARTER":
      return "Last quarter";
    case "LAST_YEAR":
      return "Last year";
  }
}

export function formatInsightsRange(startDate: Date, endDate: Date): string {
  const format = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${format.format(startDate)} – ${format.format(endDate)}`;
}

function monthKeyOf(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabelOf(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthSteps(
  start: Date,
  end: Date,
): Array<{ year: number; month: number }> {
  const steps: Array<{ year: number; month: number }> = [];
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();

  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    steps.push({ year, month });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return steps;
}

function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function marginStatusFor(
  revenue: number,
  marginPercent: number | null,
  healthy: number,
  warning: number,
  critical: number,
): MarginStatus {
  if (revenue <= 0) return "CRITICAL";
  if (marginPercent === null) return "CRITICAL";
  if (marginPercent >= healthy) return "HEALTHY";
  if (marginPercent >= warning) return "WARNING";
  if (marginPercent >= critical) return "CRITICAL";
  return "CRITICAL";
}

function profitOf(revenue: number, cost: number): number {
  return roundToTwo(revenue - cost);
}

function marginPercentOf(revenue: number, cost: number): number {
  return revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0;
}

function toRetainerRevenueLike(retainer: DatasetRetainer): RetainerRevenueLike {
  return {
    monthlyBudget: retainer.monthlyBudget,
    billingCycle: retainer.billingCycle,
    startDate: retainer.startDate,
    endDate: retainer.endDate,
  };
}

function clientMonthRevenue(
  retainers: DatasetRetainer[],
  windowStartMs: number,
  windowEndMs: number,
  now: Date,
): number {
  return retainerRevenueForPeriod(
    retainers.map(toRetainerRevenueLike),
    windowStartMs,
    windowEndMs,
    now,
  );
}

const TIME_CATEGORIES: ReadonlyArray<{
  category: string;
  keywords: string[];
}> = [
  {
    category: "Meetings",
    keywords: ["meeting", "call", "sync", "standup", "planning"],
  },
  {
    category: "SEO",
    keywords: ["seo", "keyword", "backlink", "crawl", "sitemap", "page speed"],
  },
  {
    category: "Design",
    keywords: ["design", "figma", "wireframe", "mockup", "ui", "ux"],
  },
  {
    category: "Development",
    keywords: [
      "dev",
      "develop",
      "bug",
      "code",
      "api",
      "frontend",
      "backend",
      "implement",
      "build",
      "test",
      "deploy",
    ],
  },
  {
    category: "Support",
    keywords: ["support", "ticket", "help", "troubleshoot", "resolve", "fix"],
  },
  {
    category: "Admin",
    keywords: [
      "admin",
      "invoice",
      "report",
      "billing",
      "bookkeeping",
      "onboard",
      "schedule",
      "proposal",
    ],
  },
];

export function categorizeTask(task: string): string {
  const needle = task.toLowerCase();
  for (const { category, keywords } of TIME_CATEGORIES) {
    if (keywords.some((keyword) => needle.includes(keyword))) return category;
  }
  return "Other";
}

export type InsightsFilter = {
  clientId: string | null;
  memberId: string | null;
  range: InsightsRange;
};

export const DEFAULT_INSIGHTS_FILTER: InsightsFilter = {
  clientId: null,
  memberId: null,
  range: "LAST_QUARTER",
};

export function applyInsightsFilter(
  dataset: InsightDataset,
  filter: InsightsFilter,
  now: Date,
): InsightDataset {
  const { start, end } = insightsRangeBounds(filter.range, now);
  const selectedClients = filter.clientId
    ? dataset.clients.filter((client) => client.id === filter.clientId)
    : dataset.clients;
  const selectedClientIds = new Set(selectedClients.map((client) => client.id));

  const entries = dataset.entries.filter(
    (entry) =>
      selectedClientIds.has(entry.clientId) &&
      (filter.memberId === null || entry.memberId === filter.memberId) &&
      entry.workDate >= start &&
      entry.workDate < end,
  );

  const members = filter.memberId
    ? dataset.members.filter((member) => member.id === filter.memberId)
    : dataset.members;

  return { ...dataset, clients: selectedClients, members, entries };
}

const MEMBER_MONTHLY_CAPACITY_HOURS = 176;

export type ClientProfitabilityRow = {
  clientId: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  marginStatus: MarginStatus;
  healthyThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  totalHours: number;
};

export type MonthlyFinancialRow = {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
};

export type FinancialSnapshot = {
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  averageClientProfit: number;
  averageClientCost: number;
  hasUnknownCost: boolean;
};

export type EfficiencyMetrics = {
  billableHours: number;
  utilizationPercent: number;
  effectiveHourlyRate: number;
  averageBillingRate: number;
  averageTeamCost: number;
  recoveryRate: number;
  hasUnknownCost: boolean;
};

export type TimeCategoryRow = { category: string; hours: number };

export type TeamPerfRow = {
  memberId: string;
  name: string;
  billableHours: number;
  cost: number;
  hasUnknownCost: boolean;
  revenue: number;
  profit: number;
  utilization: number;
};

export type ForecastRow = {
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
};

export type Forecast = {
  next30Days: ForecastRow;
  nextQuarter: ForecastRow;
};

export type Recommendation = {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  title: string;
  detail: string;
  impact: number;
  clientId?: string;
  memberId?: string;
};

export type OpportunityKind =
  | "upsell"
  | "increaseRetainer"
  | "safeToExpand"
  | "renegotiate"
  | "offboard";

export type OpportunityRow = {
  clientId: string;
  name: string;
  kind: OpportunityKind;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  reason: string;
};

export type InsightsAnalysis = {
  currency: string;
  range: InsightsRange;
  startDate: Date;
  endDate: Date;
  monthCount: number;
  financial: FinancialSnapshot;
  financialTrend: MonthlyFinancialRow[];
  clientProfitability: ClientProfitabilityRow[];
  medianRevenue: number;
  healthyTarget: number;
  efficiency: EfficiencyMetrics;
  timeByCategory: TimeCategoryRow[];
  team: TeamPerfRow[];
  forecast: Forecast;
  leakage: ClientProfitabilityRow[];
  recommendations: Recommendation[];
  opportunities: OpportunityRow[];
};

export function computeAnalysis(
  dataset: InsightDataset,
  now: Date,
  filter: InsightsFilter,
): InsightsAnalysis {
  const membersById = new Map(dataset.members.map((member) => [member.id, member]));
  const { start, end } = insightsRangeBounds(filter.range, now);
  const steps = monthSteps(start, end);

  const buckets: Array<{
    key: string;
    start: Date;
    end: Date;
    revenue: number;
    cost: number;
    hours: number;
    hasUnknownCost: boolean;
  }> = steps.map(({ year, month }) => {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 1));
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;

    const entries = dataset.entries.filter(
      (entry) => entry.workDate >= monthStart && entry.workDate < monthEnd,
    );
    const hours = roundToTwo(
      entries.reduce((total, entry) => total + entry.hours, 0),
    );

    let revenue: number;
    if (filter.memberId) {
      const rate = membersById.get(filter.memberId)?.billingRate ?? 0;
      revenue = roundToTwo(hours * rate);
    } else {
      revenue = roundToTwo(
        dataset.clients.reduce(
          (total, client) =>
            total +
            clientMonthRevenue(
              client.retainers,
              Math.max(monthStart.getTime(), start.getTime()),
              Math.min(monthEnd.getTime(), end.getTime()),
              now,
            ),
          0,
        ),
      );
    }

    const { cost, hasUnknownCost } = accumulateEntryCosts(
      entries.map((entry) => ({
        hours: entry.hours,
        costRate: membersById.get(entry.memberId)?.costRate ?? 0,
      })),
    );

    return { key, start: monthStart, end: monthEnd, revenue, cost, hours, hasUnknownCost };
  });

  const currentKey = monthKeyOf(now);
  const currentBucket = buckets.find((bucket) => bucket.key === currentKey);
  const rangeMonths = buckets.reduce((total, bucket) => {
    if (bucket.key === currentKey) {
      return total + now.getUTCDate() / daysInMonth(now);
    }
    return total + 1;
  }, 0);

  const totalRevenue = roundToTwo(
    buckets.reduce((total, bucket) => total + bucket.revenue, 0),
  );
  const totalCost = roundToTwo(
    buckets.reduce((total, bucket) => total + bucket.cost, 0),
  );
  const totalHours = roundToTwo(
    buckets.reduce((total, bucket) => total + bucket.hours, 0),
  );
  const hasUnknownCost = buckets.some((bucket) => bucket.hasUnknownCost);
  const totalProfit = profitOf(totalRevenue, totalCost);
  const totalMarginPercent = hasUnknownCost
    ? 0
    : marginPercentOf(totalRevenue, totalCost);

  const financialTrend: MonthlyFinancialRow[] = buckets.map((bucket) => ({
    key: bucket.key,
    label: monthLabelOf(bucket.key),
    revenue: bucket.revenue,
    cost: bucket.cost,
    profit: profitOf(bucket.revenue, bucket.cost),
    marginPercent: bucket.hasUnknownCost
      ? 0
      : marginPercentOf(bucket.revenue, bucket.cost),
  }));

  const clientTotals = new Map<
    string,
    { revenue: number; cost: number; hours: number; hasUnknownCost: boolean }
  >();
  const entriesByClientMonth = new Map<string, DatasetEntry[]>();
  for (const entry of dataset.entries) {
    const key = `${entry.clientId}:${monthKeyOf(entry.workDate)}`;
    const list = entriesByClientMonth.get(key) ?? [];
    list.push(entry);
    entriesByClientMonth.set(key, list);
  }

  for (const client of dataset.clients) {
    for (const bucket of buckets) {
      const key = `${client.id}:${bucket.key}`;
      const entries = entriesByClientMonth.get(key) ?? [];
      const { cost, hasUnknownCost } = accumulateEntryCosts(
        entries.map((entry) => ({
          hours: entry.hours,
          costRate: membersById.get(entry.memberId)?.costRate ?? 0,
        })),
      );
      const hours = entries.reduce((total, entry) => total + entry.hours, 0);
      const revenue = filter.memberId
        ? hours * (membersById.get(filter.memberId)?.billingRate ?? 0)
        : clientMonthRevenue(
            client.retainers,
            Math.max(bucket.start.getTime(), start.getTime()),
            Math.min(bucket.end.getTime(), end.getTime()),
            now,
          );

      const total = clientTotals.get(client.id) ?? { revenue: 0, cost: 0, hours: 0, hasUnknownCost: false };
      total.revenue += revenue;
      total.cost += cost;
      total.hours += hours;
      total.hasUnknownCost = total.hasUnknownCost || hasUnknownCost;
      clientTotals.set(client.id, total);
    }
  }

  const clientProfitability: ClientProfitabilityRow[] = dataset.clients.map(
    (client) => {
      const totals = clientTotals.get(client.id) ?? { revenue: 0, cost: 0, hours: 0, hasUnknownCost: false };
      const revenue = roundToTwo(totals.revenue);
      const cost = roundToTwo(totals.cost);
      const profit = profitOf(revenue, cost);
      const marginPercent = totals.hasUnknownCost
        ? 0
        : marginPercentOf(revenue, cost);

      return {
        clientId: client.id,
        name: client.name,
        status: client.status,
        revenue,
        cost,
        profit,
        marginPercent,
        marginStatus: marginStatusFor(
          revenue,
          totals.hasUnknownCost ? null : marginPercent,
          client.healthyThreshold,
          client.warningThreshold,
          client.criticalThreshold,
        ),
        healthyThreshold: client.healthyThreshold,
        warningThreshold: client.warningThreshold,
        criticalThreshold: client.criticalThreshold,
        totalHours: roundToTwo(totals.hours),
      };
    },
  );

  const withRevenue = clientProfitability.filter((row) => row.revenue > 0);
  const medianRevenue = withRevenue.length
    ? roundToTwo(
        withRevenue.map((row) => row.revenue).sort((a, b) => a - b)[
          Math.floor(withRevenue.length / 2)
        ],
      )
    : 0;
  const healthyTarget = withRevenue.length
    ? Math.round(
        (withRevenue.reduce((total, row) => total + row.healthyThreshold, 0) /
          withRevenue.length) *
          10,
      ) / 10
    : 20;

  const effectiveHourlyRate =
    totalHours > 0 ? roundToTwo(totalRevenue / totalHours) : 0;
  const averageBillingRate = dataset.members.length
    ? roundToTwo(
        dataset.members.reduce((total, member) => total + member.billingRate, 0) /
          dataset.members.length,
      )
    : 0;
  const averageTeamCost = dataset.members.length
    ? roundToTwo(
        dataset.members.reduce((total, member) => total + member.costRate, 0) /
          dataset.members.length,
      )
    : 0;
  const capacityHours =
    dataset.members.length > 0
      ? dataset.members.length * MEMBER_MONTHLY_CAPACITY_HOURS * rangeMonths
      : 0;

  const efficiency: EfficiencyMetrics = {
    billableHours: totalHours,
    utilizationPercent:
      capacityHours > 0
        ? Math.min(100, Math.round((totalHours / capacityHours) * 1000) / 10)
        : 0,
    effectiveHourlyRate,
    averageBillingRate,
    averageTeamCost,
    recoveryRate:
      hasUnknownCost || (averageTeamCost > 0 && averageBillingRate > 0)
        ? hasUnknownCost
          ? 0
          : Math.round((averageBillingRate / averageTeamCost) * 1000) / 10
        : 0,
    hasUnknownCost,
  };

  const categoryTotals = new Map<string, number>();
  for (const entry of dataset.entries) {
    const category = categorizeTask(entry.task);
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + entry.hours);
  }
  const timeByCategory: TimeCategoryRow[] = [...categoryTotals.entries()]
    .map(([category, hours]) => ({ category, hours: roundToTwo(hours) }))
    .sort((a, b) => b.hours - a.hours);

  const teamTotals = new Map<
    string,
    { hours: number; cost: number; revenue: number; hasUnknownCost: boolean }
  >();
  for (const entry of dataset.entries) {
    const member = membersById.get(entry.memberId);
    if (!member) continue;
    const row =
      teamTotals.get(entry.memberId) ??
      { hours: 0, cost: 0, revenue: 0, hasUnknownCost: false };
    row.hours += entry.hours;
    row.cost += entry.hours * member.costRate;
    if (member.costRate <= 0) row.hasUnknownCost = true;
    if (filter.memberId) {
      row.revenue += entry.hours * member.billingRate;
    }
    teamTotals.set(entry.memberId, row);
  }

  if (!filter.memberId) {
    for (const client of dataset.clients) {
      for (const bucket of buckets) {
        const key = `${client.id}:${bucket.key}`;
        const monthEntries = entriesByClientMonth.get(key) ?? [];
        const totalForClientMonth = monthEntries.reduce(
          (total, entry) => total + entry.hours,
          0,
        );
        if (totalForClientMonth <= 0) continue;
        const monthRevenue = clientMonthRevenue(
          client.retainers,
          Math.max(bucket.start.getTime(), start.getTime()),
          Math.min(bucket.end.getTime(), end.getTime()),
          now,
        );
        for (const entry of monthEntries) {
          const row = teamTotals.get(entry.memberId);
          if (!row) continue;
          row.revenue += monthRevenue * (entry.hours / totalForClientMonth);
          teamTotals.set(entry.memberId, row);
        }
      }
    }
  }

  const teamGroups = new Map<
    string,
    {
      memberId: string;
      name: string;
      hours: number;
      cost: number;
      revenue: number;
      hasUnknownCost: boolean;
    }
  >();
  for (const member of dataset.members) {
    const row =
      teamTotals.get(member.id) ??
      { hours: 0, cost: 0, revenue: 0, hasUnknownCost: false };
    const key = member.name.trim().toLocaleLowerCase();
    const existing = teamGroups.get(key);
    if (existing) {
      existing.hours += row.hours;
      existing.cost += row.cost;
      existing.revenue += row.revenue;
      existing.hasUnknownCost = existing.hasUnknownCost || row.hasUnknownCost;
    } else {
      teamGroups.set(key, {
        memberId: member.id,
        name: member.name,
        hours: row.hours,
        cost: row.cost,
        revenue: row.revenue,
        hasUnknownCost: row.hasUnknownCost,
      });
    }
  }

  const team: TeamPerfRow[] = [...teamGroups.values()].map((row) => {
    const revenue = roundToTwo(row.revenue);
    const cost = roundToTwo(row.cost);
    return {
      memberId: row.memberId,
      name: row.name,
      billableHours: roundToTwo(row.hours),
      cost,
      hasUnknownCost: row.hasUnknownCost,
      revenue,
      profit: profitOf(revenue, cost),
      utilization:
        row.hours <= 0
          ? 0
          : Math.min(
              100,
              Math.round(
                (row.hours / (MEMBER_MONTHLY_CAPACITY_HOURS * rangeMonths)) * 1000,
              ) / 10,
            ),
    };
  });

  const currentMonthRevenue = currentBucket?.revenue ?? 0;
  const currentMonthCost = currentBucket?.cost ?? 0;
  const daysElapsed = now.getUTCDate();
  const dailyRevenue = daysElapsed > 0 ? currentMonthRevenue / daysElapsed : 0;
  const dailyCost = daysElapsed > 0 ? currentMonthCost / daysElapsed : 0;

  function forecastRow(days: number): ForecastRow {
    const revenue = roundToTwo(dailyRevenue * days);
    const cost = roundToTwo(dailyCost * days);
    return {
      revenue,
      cost,
      profit: profitOf(revenue, cost),
      marginPercent: marginPercentOf(revenue, cost),
    };
  }

  const forecast: Forecast = {
    next30Days: forecastRow(30),
    nextQuarter: forecastRow(91),
  };

  const leakage = clientProfitability.filter(
    (row) => row.revenue > 0 && row.marginPercent < row.healthyThreshold,
  );

  const recommendations = buildRecommendations(
    dataset,
    currentBucket,
    clientProfitability,
    team,
    timeByCategory,
    effectiveHourlyRate,
  );

  const opportunities = buildOpportunities(clientProfitability, medianRevenue);

  return {
    currency: dataset.currency,
    range: filter.range,
    startDate: start,
    endDate: now,
    monthCount: buckets.length,
    financial: {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      marginPercent: totalMarginPercent,
      grossMarginPercent: totalMarginPercent,
      netMarginPercent: totalMarginPercent,
      averageClientProfit: withRevenue.length
        ? roundToTwo(totalProfit / withRevenue.length)
        : 0,
      averageClientCost: withRevenue.length
        ? roundToTwo(totalCost / withRevenue.length)
        : 0,
      hasUnknownCost,
    },
    financialTrend,
    clientProfitability,
    medianRevenue,
    healthyTarget,
    efficiency,
    timeByCategory,
    team,
    forecast,
    leakage,
    recommendations,
    opportunities,
  };
}

function buildRecommendations(
  dataset: InsightDataset,
  currentBucket: { start: Date; end: Date } | undefined,
  clientProfitability: ClientProfitabilityRow[],
  team: TeamPerfRow[],
  timeByCategory: TimeCategoryRow[],
  effectiveHourlyRate: number,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const row of clientProfitability) {
    if (row.revenue <= 0) continue;

    if (row.marginPercent <= 0) {
      recommendations.push({
        id: `unprofitable-${row.clientId}`,
        priority: "HIGH",
        category: "Profitability",
        title: `${row.name} is unprofitable`,
        detail: `${row.name} lost ${Math.abs(row.profit).toLocaleString()} on ${row.revenue.toLocaleString()} in revenue this period.`,
        impact: roundToTwo(-row.profit),
        clientId: row.clientId,
      });
    } else if (row.marginPercent < row.healthyThreshold) {
      const potential = roundToTwo(
        (row.revenue * (row.healthyThreshold - row.marginPercent)) / 100,
      );
      recommendations.push({
        id: `margin-${row.clientId}`,
        priority: potential > row.revenue * 0.1 ? "HIGH" : "MEDIUM",
        category: "Profitability",
        title: `Close ${row.name}'s margin gap`,
        detail: `${row.name} runs at ${row.marginPercent}% margin versus a ${row.healthyThreshold}% target.`,
        impact: potential,
        clientId: row.clientId,
      });
    }
  }

  for (const client of dataset.clients) {
    const retainer = client.retainers[0];
    if (!retainer || retainer.scopeHours <= 0) continue;
    if (!currentBucket) continue;

    const monthHours = dataset.entries
      .filter(
        (entry) =>
          entry.clientId === client.id &&
          entry.workDate >= currentBucket.start &&
          entry.workDate < currentBucket.end,
      )
      .reduce((total, entry) => total + entry.hours, 0);

    const overage = roundToTwo(monthHours - retainer.scopeHours);
    if (overage > 0) {
      recommendations.push({
        id: `scope-${client.id}`,
        priority: overage > retainer.scopeHours * 0.2 ? "HIGH" : "MEDIUM",
        category: "Scope",
        title: `Scope creep on ${client.name}`,
        detail: `${overage} hours logged over the ${retainer.scopeHours}-hour scope this month.`,
        impact:
          effectiveHourlyRate > 0 ? roundToTwo(overage * effectiveHourlyRate) : 0,
        clientId: client.id,
      });
    }
  }

  for (const row of team) {
    if (row.billableHours > 0 && row.utilization < 40) {
      recommendations.push({
        id: `capacity-${row.memberId}`,
        priority: "MEDIUM",
        category: "Capacity",
        title: `${row.name} has capacity`,
        detail: `${row.name} logged ${row.billableHours} billable hours (~${row.utilization}% utilized).`,
        impact: 0,
        memberId: row.memberId,
      });
    }
  }

  const support = timeByCategory.find((row) => row.category === "Support");
  if (support && support.hours > 0) {
    const supportByClient = new Map<string, number>();
    for (const entry of dataset.entries) {
      if (categorizeTask(entry.task) !== "Support") continue;
      supportByClient.set(
        entry.clientId,
        (supportByClient.get(entry.clientId) ?? 0) + entry.hours,
      );
    }
    const [topClientId, topClientHours] = [...supportByClient.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const share = topClientHours / support.hours;
    if (share > 0.4) {
      const client = dataset.clients.find((item) => item.id === topClientId);
      recommendations.push({
        id: `support-${topClientId}`,
        priority: "LOW",
        category: "Support load",
        title: `${client?.name ?? "A client"} drives support time`,
        detail: `${Math.round(share * 100)}% of support hours this period go to ${
          client?.name ?? "one client"
        }.`,
        impact: roundToTwo(topClientHours * effectiveHourlyRate * 0.2),
        clientId: topClientId,
      });
    }
  }

  return recommendations
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 6);
}

function buildOpportunities(
  clientProfitability: ClientProfitabilityRow[],
  medianRevenue: number,
): OpportunityRow[] {
  return clientProfitability
    .filter((row) => row.revenue > 0)
    .map((row) => {
      let kind: OpportunityKind;
      let reason: string;

      if (row.marginPercent >= row.healthyThreshold) {
        if (row.revenue < medianRevenue) {
          kind = "upsell";
          reason = "Healthy margin with below-median revenue — room to sell more.";
        } else {
          kind = "safeToExpand";
          reason = "Healthy margin at or above the median — safe to expand this account.";
        }
      } else if (row.marginPercent >= row.warningThreshold) {
        kind = "increaseRetainer";
        reason = "Margin between the warning and healthy thresholds — raise the retainer.";
      } else if (row.marginPercent >= row.criticalThreshold) {
        kind = "renegotiate";
        reason = "Thin margin — renegotiate the rate or the scope.";
      } else {
        kind = "offboard";
        reason = "Unprofitable at the critical level — consider offboarding.";
      }

      return {
        clientId: row.clientId,
        name: row.name,
        kind,
        revenue: row.revenue,
        cost: row.cost,
        profit: row.profit,
        marginPercent: row.marginPercent,
        reason,
      };
    });
}
