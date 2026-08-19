import type { MarginStatus } from "@/lib/margin-status";
import type { ScopeStatus } from "@/lib/scope-status";
import type {
  AlertSeverity,
  BillingCycle,
  ClientStatus,
} from "@/lib/generated/prisma/enums";
import { accumulateEntryCosts, computeMargin, retainerRevenueForPeriod } from "@/lib/financials";

export const DASHBOARD_PERIODS = ["today", "30d", "quarter", "year"] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Today",
  "30d": "30 Days",
  quarter: "Quarter",
  year: "Year",
};

export type PeriodBounds = {
  start: Date;
  end: Date;
};

export type ResolvedPeriod = {
  current: PeriodBounds;
  previous: PeriodBounds;
  label: string;
  previousLabel: string;
};

export type Finances = {
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  hours: number;
  currency: string;
  /**
   * True when any in-period entry belongs to a member whose cost rate is
   * unset (0). Cost is then unknown rather than $0, so margin/profit figures
   * derived from a full cost total are not reliable.
   */
  hasUnknownCost: boolean;
};

export type BudgetStatus = "ON_TRACK" | "AT_RISK" | "OVER";

export type BudgetUsage = {
  limit: number;
  used: number;
  remaining: number;
  percent: number;
  projectedOverrun: number;
  status: BudgetStatus;
};

export type ScopeUsage = {
  limit: number;
  used: number;
  remaining: number;
  percent: number;
  status: ScopeStatus;
};

export type MarginThresholdsLike = {
  healthy: number;
  warning: number;
  critical: number;
};

export type RetainerLike = {
  clientId: string;
  monthlyBudget: number;
  currency: string;
  billingCycle: BillingCycle;
  scopeHours: number;
  startDate: Date;
  endDate: Date | null;
};

export type EntryLike = {
  clientId: string;
  memberId: string;
  hours: number;
  workDate: Date;
  costRate: number;
  id?: string;
  createdAt?: Date;
  task?: string;
};

export type ClientHealth = "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL";

export type ClientHealthRow = {
  clientId: string;
  name: string;
  status: ClientStatus;
  healthyThreshold: number;
  revenue: number;
  cost: number;
  profit: number;
  hours: number;
  marginPercent: number | null;
  marginStatus: MarginStatus | null;
  /**
   * True when the client has entries whose cost rates are unset (0). Revenue
   * may be present, but cost/margin cannot be computed, so the client must
   * not be shown as financially healthy or as having a real margin.
   */
  hasUnknownCost: boolean;
  scope: ScopeUsage | null;
  budget: BudgetUsage | null;
  health: ClientHealth;
};

export type NeedsAttentionKind = "MARGIN" | "BUDGET" | "SCOPE" | "ALERT";

export type NeedsAttentionItem = {
  id: string;
  clientId: string;
  clientName: string;
  kind: NeedsAttentionKind;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  detail: string;
  action: string;
  impact: number;
};

export type HealthDriver = {
  label: string;
  detail: string;
  impact: number;
  tone: "positive" | "negative" | "neutral";
};

export type AgencyHealthStatus = "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL";

/**
 * Agency health is scored only from signals that have real data. When no
 * signal is available (no financial activity, no retainers, no alerts), the
 * score is `null` and the UI must say so instead of showing an invented
 * number.
 */
export type HealthScore = {
  score: number | null;
  previousScore: number | null;
  change: number | null;
  status: AgencyHealthStatus | null;
  drivers: HealthDriver[];
};

export type BudgetScopeRow = {
  clientId: string;
  clientName: string;
  budget: BudgetUsage | null;
  scope: ScopeUsage | null;
};

export type TeamMemberRow = {
  memberId: string;
  userId: string;
  name: string;
  hours: number;
  cost: number;
  hasUnknownCost: boolean;
  revenue: number;
  utilization: number;
};

export type ProfitLeak = {
  clientId: string;
  clientName: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number | null;
  reason: string;
  impact: number;
};

export type MarginStatusKind = MarginStatus | null;

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const DAY_MS = 86_400_000;

type ZonedParts = { y: number; m: number; d: number; h: number; min: number };

function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(instantMs));
  const read = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value;
    const number = value === undefined ? 0 : Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  let hour = read("hour");
  if (hour === 24) hour = 0;
  return { y: read("year"), m: read("month"), d: read("day"), h: hour, min: read("minute") };
}

export function localDateParts(now: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
} {
  const parts = zonedParts(now.getTime(), timeZone);
  return { year: parts.y, month: parts.m, day: parts.d };
}

/**
 * UTC-midnight instant for a 1-based calendar date. Time entries store their
 * work date at UTC midnight, so boundaries must use the same anchor to line up
 * with the Time page and the existing monthly margin rules.
 */
function utcMidnight(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function utcMonthStart(instantMs: number): number {
  const date = new Date(instantMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function nextUtcMonthStart(monthStartMs: number): number {
  const date = new Date(monthStartMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export function currentMonthBounds(
  now: Date,
  // Retained for a stable signature; boundaries are UTC-month anchors because
  // time entries store their work date at UTC midnight.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _timeZone: string,
): { start: Date; end: Date } {
  const start = utcMonthStart(now.getTime());
  const end = nextUtcMonthStart(start);
  return { start: new Date(start), end: new Date(end) };
}

/**
 * Resolves the selected period to [start, end) instants. The boundaries are
 * the UTC-midnight anchors of the user's local calendar dates, so "Today"
 * means the user's today and any entry logged for that date is included.
 */
export function resolvePeriod(
  period: DashboardPeriod,
  now: Date,
  timeZone: string,
): ResolvedPeriod {
  const { year, month, day } = localDateParts(now, timeZone);

  switch (period) {
    case "today": {
      const start = utcMidnight(year, month, day);
      const end = utcMidnight(year, month, day + 1);
      return {
        current: { start: new Date(start), end: new Date(end) },
        previous: { start: new Date(start - DAY_MS), end: new Date(start) },
        label: "Today",
        previousLabel: "Yesterday",
      };
    }
    case "30d": {
      const end = utcMidnight(year, month, day + 1);
      const start = end - 30 * DAY_MS;
      return {
        current: { start: new Date(start), end: new Date(end) },
        previous: {
          start: new Date(start - 30 * DAY_MS),
          end: new Date(start),
        },
        label: "Last 30 days",
        previousLabel: "Previous 30 days",
      };
    }
    case "quarter": {
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
      const quarter = Math.floor((month - 1) / 3) + 1;
      const start = utcMidnight(year, quarterStartMonth, 1);
      const end = utcMidnight(year, quarterStartMonth + 3, 1);
      const previousStart = utcMidnight(year, quarterStartMonth - 3, 1);
      const previousEnd = start;
      const previousQuarter = quarter === 1 ? 4 : quarter - 1;
      return {
        current: { start: new Date(start), end: new Date(end) },
        previous: {
          start: new Date(previousStart),
          end: new Date(previousEnd),
        },
        label: `Q${quarter} ${year}`,
        previousLabel: `Q${previousQuarter} ${previousQuarterYear(year, quarterStartMonth)}`,
      };
    }
    case "year": {
      const start = utcMidnight(year, 1, 1);
      const end = utcMidnight(year + 1, 1, 1);
      const previousStart = utcMidnight(year - 1, 1, 1);
      return {
        current: { start: new Date(start), end: new Date(end) },
        previous: {
          start: new Date(previousStart),
          end: new Date(start),
        },
        label: `${year}`,
        previousLabel: `${year - 1}`,
      };
    }
  }
}

function previousQuarterYear(year: number, quarterStartMonth: number): number {
  return quarterStartMonth - 3 < 1 ? year - 1 : year;
}

function isEntryInPeriod(
  entry: EntryLike,
  startMs: number,
  endMs: number,
): boolean {
  const time = entry.workDate.getTime();
  return time >= startMs && time < endMs;
}

export function computeFinances(input: {
  retainers: RetainerLike[];
  entries: EntryLike[];
  bounds: PeriodBounds;
  timeZone: string;
  now: Date;
}): Finances {
  const { retainers, entries, bounds, now } = input;
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();
  const currency = retainers[0]?.currency ?? "USD";

  let hours = 0;
  const inPeriodEntries = entries.filter((entry) =>
    isEntryInPeriod(entry, startMs, endMs),
  );
  for (const entry of inPeriodEntries) {
    hours += entry.hours;
  }
  hours = roundToTwo(hours);

  const { cost, hasUnknownCost } = accumulateEntryCosts(inPeriodEntries);

  const revenue = retainerRevenueForPeriod(retainers, startMs, endMs, now);

  const { profit, marginPercent } = computeMargin(
    revenue,
    cost,
    hasUnknownCost,
  );

  return {
    revenue,
    cost,
    profit,
    marginPercent,
    hours,
    currency,
    hasUnknownCost,
  };
}

export function computeBudgetUsage(input: {
  limit: number;
  entries: EntryLike[];
  now: Date;
  timeZone: string;
}): BudgetUsage {
  const { limit, entries, now, timeZone } = input;
  const { start, end } = currentMonthBounds(now, timeZone);
  const startMs = start.getTime();
  const endMs = end.getTime();

  let used = 0;
  for (const entry of entries) {
    if (isEntryInPeriod(entry, startMs, endMs)) {
      used += entry.hours * entry.costRate;
    }
  }
  used = roundToTwo(used);

  const day = now.getUTCDate();
  const daysInMonth = Math.round((endMs - startMs) / DAY_MS);
  const daysElapsed = Math.min(day, daysInMonth);
  const spendRate = daysElapsed > 0 ? used / daysElapsed : 0;
  const estimatedMonthSpend = roundToTwo(spendRate * daysInMonth);
  const remaining = roundToTwo(limit - used);
  const projectedOverrun = roundToTwo(
    Math.max(0, estimatedMonthSpend - limit),
  );

  const status: BudgetStatus =
    used >= limit ? "OVER" : projectedOverrun > 0 ? "AT_RISK" : "ON_TRACK";
  const percent = limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0;

  return {
    limit: roundToTwo(limit),
    used,
    remaining,
    percent,
    projectedOverrun,
    status,
  };
}

export function scopeStatusForPercent(percentUsed: number): ScopeStatus {
  if (percentUsed >= 110) return "OVERRUN";
  if (percentUsed >= 100) return "EXCEEDED";
  if (percentUsed >= 90) return "AT_RISK";
  if (percentUsed >= 80) return "NEARING";
  return "ON_TRACK";
}

export function computeScopeUsage(input: {
  limit: number;
  entries: EntryLike[];
  now: Date;
  timeZone: string;
}): ScopeUsage {
  const { limit, entries, now, timeZone } = input;
  const { start, end } = currentMonthBounds(now, timeZone);
  const startMs = start.getTime();
  const endMs = end.getTime();

  let used = 0;
  for (const entry of entries) {
    if (isEntryInPeriod(entry, startMs, endMs)) {
      used += entry.hours;
    }
  }
  used = roundToTwo(used);
  const percent = limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0;

  return {
    limit,
    used,
    remaining: roundToTwo(limit - used),
    percent,
    status: scopeStatusForPercent(percent),
  };
}

export function marginStatusFor(
  finances: Finances,
  thresholds: MarginThresholdsLike,
): MarginStatus | null {
  if (finances.revenue <= 0) return null;
  if (finances.hasUnknownCost) return null;
  if (finances.marginPercent >= thresholds.healthy) return "HEALTHY";
  if (finances.marginPercent >= thresholds.warning) return "WARNING";
  return "CRITICAL";
}

function healthFromParts(
  marginStatus: MarginStatus | null,
  budgetStatus: BudgetStatus | null,
  scopeStatus: ScopeStatus | null,
): ClientHealth {
  let severity = 0;
  if (marginStatus === "WARNING") severity = Math.max(severity, 1);
  if (marginStatus === "CRITICAL") severity = Math.max(severity, 3);
  if (budgetStatus === "AT_RISK") severity = Math.max(severity, 2);
  if (budgetStatus === "OVER") severity = Math.max(severity, 3);
  if (scopeStatus === "NEARING") severity = Math.max(severity, 1);
  if (scopeStatus === "AT_RISK") severity = Math.max(severity, 2);
  if (scopeStatus === "EXCEEDED" || scopeStatus === "OVERRUN")
    severity = Math.max(severity, 3);

  switch (severity) {
    case 3:
      return "CRITICAL";
    case 2:
      return "AT_RISK";
    case 1:
      return "WATCH";
    default:
      return "HEALTHY";
  }
}

export function buildClientHealthRow(input: {
  clientId: string;
  name: string;
  status: ClientStatus;
  healthyThreshold: number;
  thresholds: MarginThresholdsLike;
  finances: Finances;
  budget: BudgetUsage | null;
  scope: ScopeUsage | null;
}): ClientHealthRow {
  const { clientId, name, status, healthyThreshold, thresholds, finances, budget, scope } = input;
  const marginStatus = marginStatusFor(finances, thresholds);
  const marginPercent =
    marginStatus === null ? null : finances.marginPercent;
  return {
    clientId,
    name,
    status,
    healthyThreshold,
    revenue: finances.revenue,
    cost: finances.cost,
    profit: finances.profit,
    hours: finances.hours,
    marginPercent,
    marginStatus,
    hasUnknownCost: finances.hasUnknownCost,
    budget,
    scope,
    health: healthFromParts(marginStatus, budget?.status ?? null, scope?.status ?? null),
  };
}

export type HealthScoreInput = {
  finances: Finances;
  previousFinances: Finances;
  clientRows: ClientHealthRow[];
  previousClientRows: ClientHealthRow[];
  alerts: { unresolved: number; critical: number; warning: number };
};

export function computeHealthScore(input: HealthScoreInput): HealthScore {
  const { finances, previousFinances, clientRows, previousClientRows, alerts } = input;

  const current = scoreOnce({
    finances,
    clientRows,
    alerts,
  });
  const previous = scoreOnce({
    finances: previousFinances,
    clientRows: previousClientRows,
    alerts,
  });

  if (current.score === null) {
    return {
      score: null,
      previousScore: null,
      change: null,
      status: null,
      drivers: current.drivers,
    };
  }

  const change =
    previous.score === null ? null : Math.round(current.score - previous.score);

  const status: AgencyHealthStatus =
    current.score >= 80
      ? "HEALTHY"
      : current.score >= 60
        ? "WATCH"
        : current.score >= 40
          ? "AT_RISK"
          : "CRITICAL";

  return {
    score: current.score,
    previousScore: previous.score,
    change,
    status,
    drivers: current.drivers,
  };
}

function scoreOnce(input: {
  finances: Finances;
  clientRows: ClientHealthRow[];
  alerts: { unresolved: number; critical: number; warning: number };
}): { score: number | null; drivers: HealthDriver[] } {
  const { finances, clientRows, alerts } = input;
  const drivers: HealthDriver[] = [];

  const marginKnown = finances.revenue > 0 && !finances.hasUnknownCost;
  const hasBudgetData = clientRows.some((row) => row.budget !== null);
  const hasScopeData = clientRows.some((row) => row.scope !== null);
  const hasAlertData = alerts.critical + alerts.warning > 0;

  // Only score when at least one signal has real data. A workspace with no
  // financial activity, no retainers, and no alerts has no basis for a score.
  if (!marginKnown && !hasBudgetData && !hasScopeData && !hasAlertData) {
    return { score: null, drivers };
  }

  let score = 60;

  if (marginKnown) {
    const marginImpact = Math.round(
      Math.max(-20, Math.min(20, finances.marginPercent / 2)),
    );
    score += marginImpact;
    drivers.push({
      label: "Margin",
      detail: `${finances.marginPercent.toFixed(1)}% margin this period`,
      impact: marginImpact,
      tone: marginImpact >= 0 ? "positive" : "negative",
    });

    const profitImpact =
      finances.profit > 0 ? 10 : finances.profit < 0 ? -10 : 0;
    score += profitImpact;
    drivers.push({
      label: "Profitability",
      detail:
        finances.profit > 0
          ? "Profitable this period"
          : finances.profit < 0
            ? "Loss-making this period"
            : "Breakeven this period",
      impact: profitImpact,
      tone: profitImpact >= 0 ? "positive" : "negative",
    });
  }

  if (hasBudgetData) {
    const overBudget = clientRows.filter(
      (row) => row.budget?.status === "OVER",
    ).length;
    const atRiskBudget = clientRows.filter(
      (row) => row.budget?.status === "AT_RISK",
    ).length;
    const budgetImpact = Math.max(-20, -(overBudget * 8 + atRiskBudget * 4));
    score += budgetImpact;
    drivers.push({
      label: "Budget risk",
      detail:
        overBudget + atRiskBudget > 0
          ? `${overBudget} over budget, ${atRiskBudget} at risk this month`
          : "No clients over budget",
      impact: budgetImpact,
      tone: budgetImpact < 0 ? "negative" : "neutral",
    });
  }

  if (hasScopeData) {
    const scopeExceeded = clientRows.filter(
      (row) => row.scope?.status === "EXCEEDED" || row.scope?.status === "OVERRUN",
    ).length;
    const scopeNearing = clientRows.filter(
      (row) => row.scope?.status === "AT_RISK" || row.scope?.status === "NEARING",
    ).length;
    const scopeImpact = Math.max(-15, -(scopeExceeded * 5 + scopeNearing * 2));
    score += scopeImpact;
    drivers.push({
      label: "Scope risk",
      detail:
        scopeExceeded + scopeNearing > 0
          ? `${scopeExceeded} past scope, ${scopeNearing} nearing it this month`
          : "No clients past scope",
      impact: scopeImpact,
      tone: scopeImpact < 0 ? "negative" : "neutral",
    });
  }

  if (hasAlertData) {
    const alertImpact = Math.max(-20, -(alerts.critical * 4 + alerts.warning * 2));
    score += alertImpact;
    drivers.push({
      label: "Open alerts",
      detail:
        alerts.critical + alerts.warning > 0
          ? `${alerts.critical} critical, ${alerts.warning} warning unresolved`
          : "No unresolved alerts",
      impact: alertImpact,
      tone: alertImpact < 0 ? "negative" : "neutral",
    });
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), drivers };
}

export type NeedsAttentionAlertInput = {
  id: string;
  clientId: string;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  client: { name: string };
};

export function computeNeedsAttention(input: {
  clientRows: ClientHealthRow[];
  currency: string;
  alerts?: NeedsAttentionAlertInput[];
}): NeedsAttentionItem[] {
  const { clientRows, currency, alerts = [] } = input;
  const items: NeedsAttentionItem[] = [];

  for (const row of clientRows) {
    if (row.marginStatus === "WARNING" || row.marginStatus === "CRITICAL") {
      const target = row.healthyThreshold;
      const shortfall = Math.max(
        0,
        (row.revenue * (target - (row.marginPercent ?? 0))) / 100,
      );
      items.push({
        id: `${row.clientId}:MARGIN`,
        clientId: row.clientId,
        clientName: row.name,
        kind: "MARGIN",
        severity: row.marginStatus === "CRITICAL" ? "CRITICAL" : "WARNING",
        title: `Low margin — ${(row.marginPercent ?? 0).toFixed(1)}%`,
        detail: `Earning below the healthy ${target}% margin on ${row.revenue > 0 ? "retainer revenue" : "logged hours"} this period.`,
        action:
          "Raise the retainer, renegotiate scope, or reduce hours to protect margin.",
        impact: shortfall,
      });
    }

    if (row.budget?.status === "OVER" || row.budget?.status === "AT_RISK") {
      items.push({
        id: `${row.clientId}:BUDGET`,
        clientId: row.clientId,
        clientName: row.name,
        kind: "BUDGET",
        severity: row.budget.status === "OVER" ? "CRITICAL" : "WARNING",
        title:
          row.budget.status === "OVER"
            ? "Budget already exceeded"
            : "Budget burn projected",
        detail: `Current month spend is ${fmtAmount(row.budget.used, currency)} against a ${fmtAmount(row.budget.limit, currency)} budget.`,
        action: "Cap hours or raise the monthly budget before month end.",
        impact: row.budget.projectedOverrun,
      });
    }

    if (row.scope?.status === "EXCEEDED" || row.scope?.status === "OVERRUN") {
      const overrunHours = Math.max(0, row.scope.used - row.scope.limit);
      const rate = row.hours > 0 ? row.revenue / row.hours : 0;
      const impact = roundToTwo(overrunHours * rate);
      items.push({
        id: `${row.clientId}:SCOPE`,
        clientId: row.clientId,
        clientName: row.name,
        kind: "SCOPE",
        severity: row.scope.status === "OVERRUN" ? "CRITICAL" : "WARNING",
        title:
          row.scope.status === "OVERRUN"
            ? "Scope overrun this month"
            : "Scope limit reached",
        detail: `${row.scope.used.toFixed(1)} hrs logged against ${row.scope.limit} scope hrs this month.`,
        action: "Pause work over scope or renegotiate a higher scope cap.",
        impact,
      });
    }
  }

  for (const alert of alerts) {
    items.push({
      id: `alert:${alert.id}`,
      clientId: alert.clientId,
      clientName: alert.client.name,
      kind: "ALERT",
      severity: alert.severity,
      title: alert.title,
      detail: alert.description ?? "Unresolved alert.",
      action: "Review and resolve this alert.",
      impact: 0,
    });
  }

  return items
    .sort(
      (a, b) =>
        severityRank(b) - severityRank(a) || b.impact - a.impact,
    )
    .slice(0, 6);
}

function severityRank(item: NeedsAttentionItem): number {
  return item.severity === "CRITICAL" ? 2 : item.severity === "WARNING" ? 1 : 0;
}

export function computeBiggestProfitLeak(
  clientRows: ClientHealthRow[],
): ProfitLeak | null {
  let best: ProfitLeak | null = null;

  for (const row of clientRows) {
    if (row.marginStatus === null) continue;

    const margin = row.marginPercent ?? 0;
    if (margin >= row.healthyThreshold) continue;
    const impact = roundToTwo(
      (row.revenue * (row.healthyThreshold - margin)) / 100,
    );
    if (impact <= 0) continue;

    const leak: ProfitLeak = {
      clientId: row.clientId,
      clientName: row.name,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
      marginPercent: row.marginPercent,
      reason: `Margin ${margin.toFixed(1)}% is ${(row.healthyThreshold - margin).toFixed(1)} points below the ${row.healthyThreshold}% healthy target.`,
      impact,
    };
    if (!best || leak.impact > best.impact) {
      best = leak;
    }
  }

  return best;
}

export function computeTeamRows(input: {
  members: Array<{ memberId: string; userId: string; name: string }>;
  entries: EntryLike[];
  clientRevenue: Map<string, number>;
  bounds: PeriodBounds;
}): TeamMemberRow[] {
  const { members, entries, clientRevenue, bounds } = input;
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();

  const memberTotals = new Map<
    string,
    { hours: number; cost: number; hasUnknownCost: boolean }
  >();
  const memberByClient = new Map<string, Map<string, number>>();
  const clientHours = new Map<string, number>();

  for (const entry of entries) {
    if (!isEntryInPeriod(entry, startMs, endMs)) continue;
    const totals =
      memberTotals.get(entry.memberId) ??
      { hours: 0, cost: 0, hasUnknownCost: false };
    totals.hours += entry.hours;
    totals.cost += entry.hours * entry.costRate;
    if (entry.costRate <= 0) totals.hasUnknownCost = true;
    memberTotals.set(entry.memberId, totals);

    const byClient = memberByClient.get(entry.memberId) ?? new Map();
    byClient.set(entry.clientId, (byClient.get(entry.clientId) ?? 0) + entry.hours);
    memberByClient.set(entry.memberId, byClient);

    clientHours.set(entry.clientId, (clientHours.get(entry.clientId) ?? 0) + entry.hours);
  }

  const totalHours = [...memberTotals.values()].reduce(
    (sum, totals) => sum + totals.hours,
    0,
  );

  const grouped = new Map<
    string,
    {
      memberId: string;
      userId: string;
      name: string;
      hours: number;
      cost: number;
      hasUnknownCost: boolean;
      revenue: number;
    }
  >();

  for (const member of members) {
    const totals =
      memberTotals.get(member.memberId) ??
      { hours: 0, cost: 0, hasUnknownCost: false };
    let revenue = 0;
    const byClient = memberByClient.get(member.memberId);
    if (byClient) {
      for (const [clientId, memberHours] of byClient) {
        const clientTotal = clientHours.get(clientId) ?? 0;
        const clientRev = clientRevenue.get(clientId) ?? 0;
        if (clientTotal > 0) {
          revenue += (clientRev * memberHours) / clientTotal;
        }
      }
    }
    const key = member.name.trim().toLocaleLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.hours += totals.hours;
      existing.cost += totals.cost;
      existing.hasUnknownCost = existing.hasUnknownCost || totals.hasUnknownCost;
      existing.revenue += revenue;
    } else {
      grouped.set(key, {
        memberId: member.memberId,
        userId: member.userId,
        name: member.name,
        hours: totals.hours,
        cost: totals.cost,
        hasUnknownCost: totals.hasUnknownCost,
        revenue,
      });
    }
  }

  return [...grouped.values()].map((group) => ({
    memberId: group.memberId,
    userId: group.userId,
    name: group.name,
    hours: roundToTwo(group.hours),
    cost: roundToTwo(group.cost),
    hasUnknownCost: group.hasUnknownCost,
    revenue: roundToTwo(group.revenue),
    utilization:
      totalHours > 0 ? roundToTwo((group.hours / totalHours) * 100) : 0,
  }));
}

function fmtAmount(value: number, _currency: string): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: _currency,
    maximumFractionDigits: 0,
  });
}

export type RecentTimeRow = {
  id: string;
  clientId: string;
  clientName: string;
  memberId: string;
  memberName: string;
  task: string;
  hours: number;
  workDate: Date;
  createdAt: Date;
};

export type RecentAlertRow = {
  id: string;
  clientId: string;
  clientName: string;
  severity: AlertSeverity;
  type: string;
  title: string;
  createdAt: Date;
};

export type RecentReportRow = {
  id: string;
  clientId: string;
  clientName: string;
  marginPercent: number;
  generatedAt: Date;
};

export type RecentClientRow = {
  id: string;
  name: string;
  status: ClientStatus;
  createdAt: Date;
};

export type RecentRetainerRow = {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  createdAt: Date;
};

export type ActivityFeed = {
  timeEntries: RecentTimeRow[];
  alerts: RecentAlertRow[];
  reports: RecentReportRow[];
  clients: RecentClientRow[];
  retainers: RecentRetainerRow[];
};