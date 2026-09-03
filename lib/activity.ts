import "server-only";

import { prisma } from "@/lib/prisma";
import { getReportableMonths } from "@/lib/reports";
import {
  alertSelect,
  toAlertRow,
  type AlertRow,
  type AlertSeverity,
} from "@/lib/alerts";
import { getClientMargins, type MarginSummary } from "@/lib/margins";
import { getScopeUsages, type ScopeUsage } from "@/lib/scope";
import {
  billingCyclePeriodLabel,
  formatMoney,
  retainerMonthlyAmount,
} from "@/lib/retainers";
import {
  timeEntrySelect,
  toTimeEntryRow,
  formatHours,
  type ClientOption,
  type MemberOption,
  type TimeEntryRow,
} from "@/lib/time";
import { reportMonthLabel } from "@/lib/format";
import {
  TIMELINE_PAGE_SIZE,
  TIMELINE_MAX_PAGE,
  clampPage,
  eventTypesForFilter,
  resolveSinceFilter,
  type ActivityEventType,
  type TimelineFilters,
} from "@/lib/activity-filters";

export type { ActivityEventType } from "@/lib/activity-filters";
export {
  TIMELINE_PAGE_SIZE,
  TIMELINE_MAX_PAGE,
  TIMELINE_EVENT_OPTIONS,
  TIMELINE_DATE_OPTIONS,
  TIMELINE_SEVERITY_OPTIONS,
  DEFAULT_TIMELINE_FILTERS,
  clampPage,
  resolveSinceFilter,
  eventTypesForFilter,
  parseSeverity,
  isActivityEventType,
  isTimelineDate,
  type TimelineFilters,
} from "@/lib/activity-filters";

export type RecentReportRow = {
  id: string;
  clientId: string;
  clientName: string;
  reportMonth: Date;
  marginPercent: number;
  generatedAt: Date;
};

export type AttentionAlert = AlertRow & {
  currentLabel: string | null;
  thresholdLabel: string | null;
  impactLabel: string | null;
};

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  at: Date;
  clientId: string | null;
  clientName: string | null;
  memberName: string | null;
  title: string;
  detail: string | null;
  severity: AlertSeverity | null;
};

export type TimelineResult = {
  events: ActivityEvent[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type ActivityData = {
  attention: AttentionAlert[];
  attentionCount: number;
  alertPanel: AttentionAlert[];
  timeline: TimelineResult;
  reports: RecentReportRow[];
  timeEntries: TimeEntryRow[];
  clients: ClientOption[];
  members: MemberOption[];
  reportableMonths: string[];
};

const RECENT_REPORTS_LIMIT = 5;
const RECENT_ENTRIES_LIMIT = 5;
const ALERT_PANEL_LIMIT = 100;
const ATTENTION_LIMIT = 5;
const UPDATE_NOISE_WINDOW_MS = 60_000;

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
};

function severityRank(severity: AlertSeverity): number {
  return SEVERITY_RANK[severity] ?? 0;
}

function enrichAlert(
  alert: AlertRow,
  margins: Record<string, MarginSummary>,
  scopeUsages: Record<string, ScopeUsage>,
): AttentionAlert {
  if (alert.isResolved) {
    return { ...alert, currentLabel: null, thresholdLabel: null, impactLabel: null };
  }

  if (alert.type === "MARGIN") {
    const margin = margins[alert.clientId];
    if (margin) {
      const target =
        alert.severity === "CRITICAL"
          ? margin.thresholds.critical
          : margin.thresholds.warning;
      const currentLabel = `${margin.marginPercent.toFixed(1)}% margin`;
      const thresholdLabel = `target ${target}%`;
      const gap = target - margin.marginPercent;
      let impactLabel: string | null = null;
      if (margin.revenue > 0 && gap > 0) {
        const impact = Math.round(margin.revenue * (gap / 100));
        if (impact >= 1) {
          impactLabel = `Estimated profit impact: ${formatMoney(
            impact,
            margin.currency,
          )}`;
        }
      }
      return { ...alert, currentLabel, thresholdLabel, impactLabel };
    }
  }

  if (alert.type === "SCOPE") {
    const usage = scopeUsages[alert.clientId];
    if (usage) {
      return {
        ...alert,
        currentLabel: `${usage.percentUsed.toFixed(1)}% used`,
        thresholdLabel: `${formatHours(usage.scopeHours)} scope`,
        impactLabel: null,
      };
    }
  }

  return { ...alert, currentLabel: null, thresholdLabel: null, impactLabel: null };
}

function groupAttentionAlerts(alerts: AttentionAlert[]): AttentionAlert[] {
  const byClientType = new Map<string, AttentionAlert>();
  for (const alert of alerts) {
    if (alert.isResolved) continue;
    const key = `${alert.clientId}:${alert.type}`;
    const current = byClientType.get(key);
    if (!current) {
      byClientType.set(key, alert);
      continue;
    }
    const currentRank = severityRank(current.severity);
    const nextRank = severityRank(alert.severity);
    const moreSevere = nextRank > currentRank;
    const equallySevere = nextRank === currentRank;
    if (moreSevere || (equallySevere && alert.createdAt > current.createdAt)) {
      byClientType.set(key, alert);
    }
  }
  return [...byClientType.values()].sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function getActivityData(
  workspaceId: string,
  filters: TimelineFilters = {
    query: "",
    event: "ALL",
    date: "ALL",
    clientId: "ALL",
    severity: "ALL",
    page: 1,
  },
): Promise<ActivityData> {
  const page = clampPage(filters.page);
  const since = resolveSinceFilter(filters.date);
  const hasClientFilter = filters.clientId !== "ALL";
  const hasSeverityFilter = filters.severity !== "ALL";

  const clientWhere = hasClientFilter ? { clientId: filters.clientId } : {};
  const fetchCap = Math.min(page * TIMELINE_PAGE_SIZE * 3, 1000);

  const [
    clients,
    retainers,
    members,
    timeEntries,
    recentEntries,
    timelineAlerts,
    reports,
    recentReports,
    panelAlerts,
    reportableMonths,
    margins,
    scopeUsages,
  ] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.retainer.findMany({
      where: {
        client: { workspaceId },
        ...clientWhere,
      },
      orderBy: { createdAt: "desc" },
      take: fetchCap,
      select: {
        id: true,
        clientId: true,
        monthlyBudget: true,
        currency: true,
        billingCycle: true,
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
        createdAt: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        ...clientWhere,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: fetchCap,
      select: timeEntrySelect,
    }),
    prisma.timeEntry.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: RECENT_ENTRIES_LIMIT,
      select: timeEntrySelect,
    }),
    prisma.alert.findMany({
      where: {
        workspaceId,
        ...clientWhere,
        ...(hasSeverityFilter ? { severity: filters.severity as AlertSeverity } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: fetchCap,
      select: alertSelect,
    }),
    prisma.report.findMany({
      where: { workspaceId, ...clientWhere },
      orderBy: { generatedAt: "desc" },
      take: fetchCap,
      select: {
        id: true,
        clientId: true,
        reportMonth: true,
        marginPercent: true,
        generatedAt: true,
        client: { select: { name: true } },
      },
    }),
    prisma.report.findMany({
      where: { workspaceId },
      orderBy: { generatedAt: "desc" },
      take: RECENT_REPORTS_LIMIT,
      select: {
        id: true,
        clientId: true,
        reportMonth: true,
        marginPercent: true,
        generatedAt: true,
        client: { select: { name: true } },
      },
    }),
    prisma.alert.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: ALERT_PANEL_LIMIT,
      select: alertSelect,
    }),
    getReportableMonths(workspaceId),
    getClientMargins(workspaceId),
    getScopeUsages(workspaceId),
  ]);

  // TODO: Replace with new auth system's user info lookup
  const memberInfoMap = new Map(
    members.map((member) => [
      member.id,
      { name: null as string | null, email: null as string | null },
    ]),
  );
  const memberNameById = new Map(
    members.map((member) => [
      member.id,
      "Team member",
    ]),
  );
  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));

  const events: ActivityEvent[] = [];

  for (const entry of timeEntries) {
    const memberName = memberNameById.get(entry.memberId) ?? "Team member";
    events.push({
      id: `time-${entry.id}`,
      type: "TIME",
      at: entry.createdAt,
      clientId: entry.clientId,
      clientName: entry.client.name,
      memberName,
      title: `${memberName} logged ${formatHours(entry.hours.toNumber())}`,
      detail: `${entry.client.name} · ${entry.task}`,
      severity: null,
    });
  }

  for (const client of clients) {
    events.push({
      id: `client-created-${client.id}`,
      type: "CLIENT_CREATED",
      at: client.createdAt,
      clientId: client.id,
      clientName: client.name,
      memberName: null,
      title: "Client created",
      detail: client.name,
      severity: null,
    });
    if (
      client.updatedAt.getTime() >
      client.createdAt.getTime() + UPDATE_NOISE_WINDOW_MS
    ) {
      events.push({
        id: `client-updated-${client.id}`,
        type: "CLIENT_UPDATED",
        at: client.updatedAt,
        clientId: client.id,
        clientName: client.name,
        memberName: null,
        title: "Client updated",
        detail: client.name,
        severity: null,
      });
    }
  }

  for (const retainer of retainers) {
    const clientName = clientNameById.get(retainer.clientId) ?? "Unknown client";
    const monthlyAmount = formatMoney(
      retainerMonthlyAmount(retainer.monthlyBudget.toNumber(), retainer.billingCycle),
      retainer.currency,
    );
    events.push({
      id: `retainer-created-${retainer.id}`,
      type: "RETAINER_CREATED",
      at: retainer.createdAt,
      clientId: retainer.clientId,
      clientName,
      memberName: null,
      title: `Retainer added for ${clientName}`,
      detail: `${monthlyAmount} ${billingCyclePeriodLabel(retainer.billingCycle)}`,
      severity: null,
    });
    if (
      retainer.updatedAt.getTime() >
      retainer.createdAt.getTime() + UPDATE_NOISE_WINDOW_MS
    ) {
      events.push({
        id: `retainer-updated-${retainer.id}`,
        type: "RETAINER_UPDATED",
        at: retainer.updatedAt,
        clientId: retainer.clientId,
        clientName,
        memberName: null,
        title: `Retainer updated for ${clientName}`,
        detail: null,
        severity: null,
      });
    }
  }

  for (const member of members) {
    const name = memberNameById.get(member.id) ?? "Team member";
    events.push({
      id: `member-added-${member.id}`,
      type: "MEMBER_ADDED",
      at: member.createdAt,
      clientId: null,
      clientName: null,
      memberName: name,
      title: `${name} joined the team`,
      detail: null,
      severity: null,
    });
  }

  for (const alert of timelineAlerts) {
    events.push({
      id: `alert-triggered-${alert.id}`,
      type: "ALERT_TRIGGERED",
      at: alert.createdAt,
      clientId: alert.clientId,
      clientName: alert.client.name,
      memberName: null,
      title: alert.title,
      detail: alert.client.name,
      severity: alert.severity,
    });
    if (alert.isResolved && alert.resolvedAt) {
      events.push({
        id: `alert-resolved-${alert.id}`,
        type: "ALERT_RESOLVED",
        at: alert.resolvedAt,
        clientId: alert.clientId,
        clientName: alert.client.name,
        memberName: null,
        title: alert.title,
        detail: `Resolved · ${alert.client.name}`,
        severity: alert.severity,
      });
    }
  }

  for (const report of reports) {
    events.push({
      id: `report-${report.id}`,
      type: "REPORT_GENERATED",
      at: report.generatedAt,
      clientId: report.clientId,
      clientName: report.client.name,
      memberName: null,
      title: `Report generated for ${report.client.name}`,
      detail: `${reportMonthLabel(report.reportMonth)} · ${report.marginPercent
        .toNumber()
        .toFixed(1)}% margin`,
      severity: null,
    });
  }

  const allowedTypes = eventTypesForFilter(filters.event);
  const normalizedQuery = filters.query.trim().toLowerCase();

  const filtered = events
    .filter((event) => {
      if (since && event.at.getTime() < since.getTime()) return false;
      if (hasClientFilter && event.clientId !== filters.clientId) return false;
      if (!allowedTypes.includes(event.type)) return false;
      if (hasSeverityFilter && event.severity !== filters.severity) return false;
      if (normalizedQuery) {
        const haystack = [
          event.title,
          event.detail,
          event.clientName,
          event.memberName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));

  const total = filtered.length;
  const startIndex = (page - 1) * TIMELINE_PAGE_SIZE;
  const pageEvents = filtered.slice(startIndex, startIndex + TIMELINE_PAGE_SIZE);

  const alertRows = panelAlerts.map(toAlertRow);
  const enrichedPanel = alertRows.map((alert) =>
    enrichAlert(alert, margins, scopeUsages),
  );
  const groupedAttention = groupAttentionAlerts(enrichedPanel);

  const membersForDialog: MemberOption[] = members.map((member) => {
    const info = memberInfoMap.get(member.id);
    return {
      id: member.id,
      name: info?.name ?? null,
      email: info?.email ?? null,
    };
  });

  return {
    attention: groupedAttention.slice(0, ATTENTION_LIMIT),
    attentionCount: groupedAttention.length,
    alertPanel: enrichedPanel,
    timeline: {
      events: pageEvents,
      page,
      pageSize: TIMELINE_PAGE_SIZE,
      total,
      hasMore: startIndex + pageEvents.length < total && page < TIMELINE_MAX_PAGE,
    },
    reports: recentReports.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      clientName: row.client.name,
      reportMonth: row.reportMonth,
      marginPercent: row.marginPercent.toNumber(),
      generatedAt: row.generatedAt,
    })),
    timeEntries: recentEntries.map((entry) =>
      toTimeEntryRow(
        entry,
        memberInfoMap.get(entry.memberId) ?? { name: null, email: null },
      ),
    ),
    clients,
    members: membersForDialog,
    reportableMonths,
  };
}
