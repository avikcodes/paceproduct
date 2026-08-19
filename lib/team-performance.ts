import "server-only";

import { prisma } from "@/lib/prisma";
import {
  computeTeamRows,
  type TeamMemberRow,
} from "@/lib/dashboard-metrics";
import { roundToTwo } from "@/lib/financials";
import { retainerMonthlyAmount } from "@/lib/retainers";

export type TeamMemberMetric = {
  memberId: string;
  userId: string;
  currency: string;
  billableHours: number;
  cost: number;
  /**
   * True when any of this member's entries has an unset cost rate (0). Cost is
   * then incomplete and must not be shown as a real number.
   */
  hasUnknownCost: boolean;
  revenue: number;
  profit: number;
  utilization: number;
};

export type TeamPerformanceSummary = {
  highestRevenue: { memberId: string; value: number } | null;
  highestProfit: { memberId: string; value: number } | null;
  /**
   * True when members have logged hours but none of them has usable cost
   * data (unset cost rates). Profit cannot be attributed to anyone, so the
   * card should explain that cost data is unavailable instead of showing
   * "No data".
   */
  highestProfitCostUnknown: boolean;
  mostBillableHours: { memberId: string; value: number } | null;
  leastUtilized: { memberId: string; value: number } | null;
};

export type ReportsTeamEntry = {
  id: string;
  clientId: string;
  memberId: string;
  task: string;
  hours: number;
  workDate: Date;
  createdAt: Date;
  costRate: number;
};

export type ReportsTeamInput = {
  members: Array<{ id: string; userId: string; currency: string }>;
  clients: Array<{ id: string; retainerRevenue: number }>;
  entries: ReportsTeamEntry[];
};

function buildTeamSummary(rows: TeamMemberMetric[]): TeamPerformanceSummary {
  const withHours = rows.filter((row) => row.billableHours > 0);

  function best(
    candidates: TeamMemberMetric[],
    pick: (row: TeamMemberMetric) => number,
  ): TeamMemberMetric | null {
    let winner: TeamMemberMetric | null = null;
    let winnerValue = -Infinity;
    for (const row of candidates) {
      const value = pick(row);
      if (value > winnerValue) {
        winnerValue = value;
        winner = row;
      }
    }
    return winner;
  }

  const knownCost = withHours.filter((row) => !row.hasUnknownCost);

  const highestRevenueRow = best(withHours, (row) => row.revenue);
  const highestProfitRow = best(knownCost, (row) => row.profit);
  const mostHoursRow = best(withHours, (row) => row.billableHours);
  const leastUtilizedRow = best(withHours, (row) => -row.utilization);

  return {
    highestRevenue: highestRevenueRow
      ? { memberId: highestRevenueRow.memberId, value: highestRevenueRow.revenue }
      : null,
    highestProfit: highestProfitRow
      ? { memberId: highestProfitRow.memberId, value: highestProfitRow.profit }
      : null,
    highestProfitCostUnknown: withHours.length > 0 && knownCost.length === 0,
    mostBillableHours: mostHoursRow
      ? { memberId: mostHoursRow.memberId, value: mostHoursRow.billableHours }
      : null,
    leastUtilized: leastUtilizedRow
      ? { memberId: leastUtilizedRow.memberId, value: leastUtilizedRow.utilization }
      : null,
  };
}

/**
 * Team performance over all logged time. Revenue is the same retainer-derived
 * revenue used by client profitability, prorated to each member by their share
 * of the client's logged hours (the canonical allocation also used by the
 * Dashboard). Cost is hours × the member's cost rate via the shared
 * accumulateEntryCosts rule, so unset cost rates are flagged rather than
 * reported as $0.
 */
export function computeReportsTeam(
  input: ReportsTeamInput,
): { rows: TeamMemberMetric[]; summary: TeamPerformanceSummary } {
  const memberCurrency = new Map(
    input.members.map((member) => [member.id, member.currency]),
  );

  const startMs = input.entries.length
    ? Math.min(...input.entries.map((entry) => entry.workDate.getTime()))
    : Date.now();
  const endMs = input.entries.length
    ? Math.max(...input.entries.map((entry) => entry.workDate.getTime())) + 1
    : Date.now() + 1;

  const teamRows = computeTeamRows({
    members: input.members.map((member) => ({
      memberId: member.id,
      userId: member.userId,
      // Unique per-member key so rows are never merged by name (names are
      // resolved from Clerk after this function returns).
      name: member.id,
    })),
    entries: input.entries.map((entry) => ({
      id: entry.id,
      clientId: entry.clientId,
      memberId: entry.memberId,
      task: entry.task,
      hours: entry.hours,
      workDate: entry.workDate,
      createdAt: entry.createdAt,
      costRate: entry.costRate,
    })),
    clientRevenue: new Map(
      input.clients.map((client) => [client.id, client.retainerRevenue]),
    ),
    bounds: { start: new Date(startMs), end: new Date(endMs) },
  });

  const rows: TeamMemberMetric[] = teamRows.map((row: TeamMemberRow) => ({
    memberId: row.memberId,
    userId: row.userId,
    currency: memberCurrency.get(row.memberId) ?? "USD",
    billableHours: row.hours,
    cost: row.cost,
    hasUnknownCost: row.hasUnknownCost,
    revenue: row.revenue,
    profit: roundToTwo(row.revenue - row.cost),
    utilization: row.utilization,
  }));

  return { rows, summary: buildTeamSummary(rows) };
}

export async function getTeamPerformance(
  workspaceId: string,
): Promise<{ rows: TeamMemberMetric[]; summary: TeamPerformanceSummary }> {
  const [members, clients, entries] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        id: true,
        userId: true,
        currency: true,
      },
    }),
    prisma.client.findMany({
      where: { workspaceId },
      select: {
        id: true,
        retainers: {
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { monthlyBudget: true, billingCycle: true },
        },
      },
    }),
    prisma.timeEntry.findMany({
      where: { workspaceId },
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
  ]);

  return computeReportsTeam({
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      currency: member.currency,
    })),
    clients: clients.map((client) => ({
      id: client.id,
      retainerRevenue: client.retainers[0]
        ? retainerMonthlyAmount(
            client.retainers[0].monthlyBudget.toNumber(),
            client.retainers[0].billingCycle,
          )
        : 0,
    })),
    entries: entries.map((entry) => ({
      id: entry.id,
      clientId: entry.clientId,
      memberId: entry.memberId,
      task: entry.task,
      hours: entry.hours.toNumber(),
      workDate: entry.workDate,
      createdAt: entry.createdAt,
      costRate: entry.member.costRate.toNumber(),
    })),
  });
}