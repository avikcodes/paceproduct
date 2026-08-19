import "server-only";

import { prisma } from "@/lib/prisma";
import { formatHours } from "@/lib/time";
import { formatMoney, retainerMonthlyAmount } from "@/lib/retainers";
import {
  type BudgetScopeRow,
  type ClientHealthRow,
  type DashboardPeriod,
  type Finances,
  type HealthScore,
  type NeedsAttentionItem,
  type PeriodBounds,
  type ProfitLeak,
  type RetainerLike,
  buildClientHealthRow,
  computeBiggestProfitLeak,
  computeBudgetUsage,
  computeFinances,
  computeHealthScore,
  computeNeedsAttention,
  computeScopeUsage,
  resolvePeriod,
} from "@/lib/dashboard-metrics";

export type {
  DashboardPeriod,
  Finances,
  PeriodBounds,
  ClientHealthRow,
  NeedsAttentionItem,
  HealthScore,
  ProfitLeak,
  BudgetScopeRow,
};

export { DASHBOARD_PERIODS, DASHBOARD_PERIOD_LABELS } from "@/lib/dashboard-metrics";

export type ActivityEvent = {
  id: string;
  kind: "TIME" | "CLIENT" | "RETAINER" | "ALERT" | "REPORT";
  title: string;
  sub: string;
  href: string;
  at: Date;
};

export type DashboardData = {
  period: DashboardPeriod;
  timeZone: string;
  label: string;
  previousLabel: string;
  bounds: PeriodBounds;
  previousBounds: PeriodBounds;
  currency: string;
  finances: Finances;
  previousFinances: Finances;
  /**
   * Members whose entries fall inside the current period but whose internal
   * cost rate is unset (0). Cost is genuinely unavailable for these members,
   * so they are surfaced by name instead of being silently costed at $0.
   */
  missingCostRateMembers: Array<{ memberId: string; name: string }>;
  hasFinancialData: boolean;
  hasInPeriodHours: boolean;
  hasHistoricalData: boolean;
  hasAnyData: boolean;
  health: HealthScore;
  needsAttention: NeedsAttentionItem[];
  biggestLeak: ProfitLeak | null;
  clients: ClientHealthRow[];
  budgetScope: BudgetScopeRow[];
  activity: ActivityEvent[];
  alertSummary: {
    unresolved: number;
    critical: number;
    warning: number;
    info: number;
  };
  counts: { clients: number; retainers: number; timeEntries: number };
  generatedAt: string;
};

const ACTIVITY_EVENT_LIMIT = 10;
const ACTIVITY_TIME_LIMIT = 6;
const ACTIVITY_ALERT_LIMIT = 5;
const ACTIVITY_REPORT_LIMIT = 5;
const ACTIVITY_CLIENT_LIMIT = 5;
const ACTIVITY_RETAINER_LIMIT = 5;

const HEALTH_RANK: Record<ClientHealthRow["health"], number> = {
  CRITICAL: 3,
  AT_RISK: 2,
  WATCH: 1,
  HEALTHY: 0,
};

export async function getDashboardData(
  workspaceId: string,
  period: DashboardPeriod,
  timeZone: string,
  memberNames: (userIds: string[]) => Promise<Map<string, string>>,
  now: Date = new Date(),
): Promise<DashboardData> {
  const resolved = resolvePeriod(period, now, timeZone);
  const widestStart = new Date(
    Math.min(
      resolved.current.start.getTime(),
      resolved.previous.start.getTime(),
    ),
  );
  const widestEnd = new Date(
    Math.max(
      resolved.current.end.getTime(),
      resolved.previous.end.getTime(),
    ),
  );

  const [
    clients,
    activeRetainers,
    members,
    entries,
    alerts,
    reports,
    totalEntryCount,
  ] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        healthyThreshold: true,
        warningThreshold: true,
        criticalThreshold: true,
        createdAt: true,
      },
    }),
    prisma.retainer.findMany({
      where: { isActive: true, client: { workspaceId } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clientId: true,
        monthlyBudget: true,
        currency: true,
        billingCycle: true,
        scopeHours: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        costRate: true,
        billingRate: true,
        currency: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: { workspaceId, workDate: { gte: widestStart, lte: widestEnd } },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        clientId: true,
        memberId: true,
        task: true,
        hours: true,
        workDate: true,
        createdAt: true,
        member: { select: { costRate: true } },
      },
    }),
    prisma.alert.findMany({
      where: { workspaceId, isResolved: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        clientId: true,
        type: true,
        severity: true,
        title: true,
        description: true,
        createdAt: true,
        client: { select: { name: true } },
      },
    }),
    prisma.report.findMany({
      where: { workspaceId },
      orderBy: { generatedAt: "desc" },
      take: ACTIVITY_REPORT_LIMIT,
      select: {
        id: true,
        clientId: true,
        marginPercent: true,
        generatedAt: true,
        client: { select: { name: true } },
      },
    }),
    prisma.timeEntry.count({ where: { workspaceId } }),
  ]);

  const nameByUserId = await memberNames(members.map((member) => member.userId));
  const memberNameById = new Map<string, string>();
  for (const member of members) {
    memberNameById.set(
      member.id,
      nameByUserId.get(member.userId) ?? member.userId.slice(0, 8),
    );
  }

  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));
  const clientThresholds = new Map(
    clients.map((client) => [
      client.id,
      {
        healthy: client.healthyThreshold.toNumber(),
        warning: client.warningThreshold.toNumber(),
        critical: client.criticalThreshold.toNumber(),
      },
    ]),
  );

  const retainerByClient = new Map<string, RetainerLike>();
  for (const retainer of activeRetainers) {
    if (retainerByClient.has(retainer.clientId)) continue;
    retainerByClient.set(retainer.clientId, {
      clientId: retainer.clientId,
      monthlyBudget: retainer.monthlyBudget.toNumber(),
      currency: retainer.currency,
      billingCycle: retainer.billingCycle,
      scopeHours: retainer.scopeHours,
      startDate: retainer.startDate,
      endDate: retainer.endDate,
    });
  }
  const retainerLikes = [...retainerByClient.values()];

  const entriesLike = entries.map((entry) => ({
    id: entry.id,
    clientId: entry.clientId,
    memberId: entry.memberId,
    task: entry.task,
    hours: entry.hours.toNumber(),
    workDate: entry.workDate,
    createdAt: entry.createdAt,
    costRate: entry.member.costRate.toNumber(),
  }));

  const entriesByClient = new Map<string, typeof entriesLike>();
  for (const entry of entriesLike) {
    const list = entriesByClient.get(entry.clientId) ?? [];
    list.push(entry);
    entriesByClient.set(entry.clientId, list);
  }

  const missingCostRateMemberIds = new Set<string>();
  const currentStartMs = resolved.current.start.getTime();
  const currentEndMs = resolved.current.end.getTime();
  for (const entry of entriesLike) {
    const time = entry.workDate.getTime();
    if (
      time >= currentStartMs &&
      time < currentEndMs &&
      entry.costRate <= 0
    ) {
      missingCostRateMemberIds.add(entry.memberId);
    }
  }
  const missingCostRateMembers = [...missingCostRateMemberIds].map(
    (memberId) => ({
      memberId,
      name: memberNameById.get(memberId) ?? "Unnamed member",
    }),
  );

  const finances = computeFinances({
    retainers: retainerLikes,
    entries: entriesLike,
    bounds: resolved.current,
    timeZone,
    now,
  });
  const previousFinances = computeFinances({
    retainers: retainerLikes,
    entries: entriesLike,
    bounds: resolved.previous,
    timeZone,
    now,
  });

  const currency =
    retainerLikes[0]?.currency ?? members[0]?.currency ?? "USD";

  const operationalClientIds = new Set<string>();
  for (const retainer of retainerLikes) operationalClientIds.add(retainer.clientId);
  for (const entry of entriesLike) {
    const time = entry.workDate.getTime();
    if (
      time >= resolved.previous.start.getTime() &&
      time < resolved.current.end.getTime()
    ) {
      operationalClientIds.add(entry.clientId);
    }
  }

  const clientRows: ClientHealthRow[] = [];
  const previousClientRows: ClientHealthRow[] = [];
  const budgetScope: BudgetScopeRow[] = [];

  for (const client of clients) {
    if (!operationalClientIds.has(client.id)) continue;
    const clientEntries = entriesByClient.get(client.id) ?? [];
    const retainer = retainerByClient.get(client.id) ?? null;
    const thresholds = clientThresholds.get(client.id)!;

    const clientFinances = computeFinances({
      retainers: retainer ? [retainer] : [],
      entries: clientEntries,
      bounds: resolved.current,
      timeZone,
      now,
    });
    const clientPreviousFinances = computeFinances({
      retainers: retainer ? [retainer] : [],
      entries: clientEntries,
      bounds: resolved.previous,
      timeZone,
      now,
    });

    let budget: ReturnType<typeof computeBudgetUsage> | null = null;
    let scope: ReturnType<typeof computeScopeUsage> | null = null;
    if (retainer) {
      budget = computeBudgetUsage({
        limit: retainerMonthlyAmount(retainer.monthlyBudget, retainer.billingCycle),
        entries: clientEntries,
        now,
        timeZone,
      });
      if (retainer.scopeHours > 0) {
        scope = computeScopeUsage({
          limit: retainer.scopeHours,
          entries: clientEntries,
          now,
          timeZone,
        });
      }
    }

    clientRows.push(
      buildClientHealthRow({
        clientId: client.id,
        name: client.name,
        status: client.status,
        healthyThreshold: thresholds.healthy,
        thresholds,
        finances: clientFinances,
        budget,
        scope,
      }),
    );

    previousClientRows.push(
      buildClientHealthRow({
        clientId: client.id,
        name: client.name,
        status: client.status,
        healthyThreshold: thresholds.healthy,
        thresholds,
        finances: clientPreviousFinances,
        budget,
        scope,
      }),
    );

    budgetScope.push({
      clientId: client.id,
      clientName: client.name,
      budget,
      scope,
    });
  }

  const alertSummary = {
    unresolved: alerts.length,
    critical: alerts.filter((alert) => alert.severity === "CRITICAL").length,
    warning: alerts.filter((alert) => alert.severity === "WARNING").length,
    info: alerts.filter((alert) => alert.severity === "INFO").length,
  };

  const health = computeHealthScore({
    finances,
    previousFinances,
    clientRows,
    previousClientRows,
    alerts: alertSummary,
  });

  const needsAttention = computeNeedsAttention({
    clientRows,
    currency,
    alerts,
  });

  const biggestLeak = computeBiggestProfitLeak(clientRows);

  const activity = buildActivityFeed({
    entries: entriesLike,
    clients,
    retainers: activeRetainers,
    alerts,
    reports,
    clientNameById,
    memberNameById,
  });

  const sortedClientRows = [...clientRows].sort(
    (a, b) =>
      HEALTH_RANK[b.health] - HEALTH_RANK[a.health] ||
      b.revenue - a.revenue ||
      a.name.localeCompare(b.name),
  );

  const sortedBudgetScope = [...budgetScope].sort((a, b) => {
    const aRisk = budgetRiskRank(a.budget) + scopeRiskRank(a.scope);
    const bRisk = budgetRiskRank(b.budget) + scopeRiskRank(b.scope);
    return bRisk - aRisk || a.clientName.localeCompare(b.clientName);
  });

  const hasAnyData =
    clients.length > 0 || activeRetainers.length > 0 || totalEntryCount > 0;

  return {
    period,
    timeZone,
    label: resolved.label,
    previousLabel: resolved.previousLabel,
    bounds: resolved.current,
    previousBounds: resolved.previous,
    currency,
    finances,
    previousFinances,
    missingCostRateMembers,
    hasFinancialData: finances.revenue > 0,
    hasInPeriodHours: finances.hours > 0,
    hasHistoricalData: totalEntryCount > 0,
    hasAnyData,
    health,
    needsAttention,
    biggestLeak,
    clients: sortedClientRows,
    budgetScope: sortedBudgetScope,
    activity,
    alertSummary,
    counts: {
      clients: clients.length,
      retainers: activeRetainers.length,
      timeEntries: totalEntryCount,
    },
    generatedAt: now.toISOString(),
  };
}

type ActivityFeedInput = {
  entries: Array<{
    id: string;
    clientId: string;
    memberId: string;
    hours: number;
    createdAt: Date;
  }>;
  clients: Array<{ id: string; name: string; createdAt: Date }>;
  retainers: Array<{
    id: string;
    clientId: string;
    monthlyBudget: { toNumber: () => number };
    currency: string;
    updatedAt: Date;
  }>;
  alerts: Array<{
    id: string;
    clientId: string;
    title: string;
    createdAt: Date;
    client: { name: string };
  }>;
  reports: Array<{
    id: string;
    clientId: string;
    generatedAt: Date;
    client: { name: string };
  }>;
  clientNameById: Map<string, string>;
  memberNameById: Map<string, string>;
};

function buildActivityFeed(input: ActivityFeedInput): ActivityEvent[] {
  const { entries, clients, retainers, alerts, reports, clientNameById, memberNameById } = input;
  const events: ActivityEvent[] = [];

  for (const entry of entries
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, ACTIVITY_TIME_LIMIT)) {
    events.push({
      id: `time:${entry.id}`,
      kind: "TIME",
      title: `${memberNameById.get(entry.memberId) ?? "Unknown member"} logged ${formatHours(entry.hours)}`,
      sub: `Time logged · ${clientNameById.get(entry.clientId) ?? "Unknown client"}`,
      href: "/dashboard/time",
      at: entry.createdAt,
    });
  }

  for (const client of clients
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, ACTIVITY_CLIENT_LIMIT)) {
    events.push({
      id: `client:${client.id}`,
      kind: "CLIENT",
      title: client.name,
      sub: "Client created",
      href: `/dashboard/clients/${client.id}`,
      at: client.createdAt,
    });
  }

  for (const retainer of retainers.slice(0, ACTIVITY_RETAINER_LIMIT)) {
    events.push({
      id: `retainer:${retainer.id}`,
      kind: "RETAINER",
      title: clientNameById.get(retainer.clientId) ?? "Unknown client",
      sub: `Retainer changed · ${formatMoney(retainer.monthlyBudget.toNumber(), retainer.currency)}`,
      href: `/dashboard/clients/${retainer.clientId}`,
      at: retainer.updatedAt,
    });
  }

  for (const alert of alerts.slice(0, ACTIVITY_ALERT_LIMIT)) {
    events.push({
      id: `alert:${alert.id}`,
      kind: "ALERT",
      title: alert.title,
      sub: `Alert triggered · ${alert.client.name}`,
      href: "/dashboard/alerts",
      at: alert.createdAt,
    });
  }

  for (const report of reports) {
    events.push({
      id: `report:${report.id}`,
      kind: "REPORT",
      title: `Report for ${report.client.name}`,
      sub: "Report generated",
      href: "/reports",
      at: report.generatedAt,
    });
  }

  return events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, ACTIVITY_EVENT_LIMIT);
}

function budgetRiskRank(
  budget: ReturnType<typeof computeBudgetUsage> | null,
): number {
  if (!budget) return 0;
  return budget.status === "OVER" ? 3 : budget.status === "AT_RISK" ? 2 : 0;
}

function scopeRiskRank(
  scope: ReturnType<typeof computeScopeUsage> | null,
): number {
  if (!scope) return 0;
  if (scope.status === "OVERRUN" || scope.status === "EXCEEDED") return 3;
  if (scope.status === "AT_RISK") return 2;
  if (scope.status === "NEARING") return 1;
  return 0;
}