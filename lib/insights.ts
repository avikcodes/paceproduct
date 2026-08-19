import "server-only";
import { prisma } from "@/lib/prisma";
import { getClerkUserInfos } from "@/lib/clerk-users";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { InsightDataset } from "@/lib/insights-analysis";
import {
  INSIGHT_RANGES,
  type InsightMonthlyRow,
  type InsightRange,
  type InsightTotals,
} from "@/lib/insight-ranges";
import type { BillingCycle } from "@/lib/generated/prisma/enums";
import { accumulateEntryCosts, computeMargin, retainerRevenueForPeriod } from "@/lib/financials";

export type { InsightMonthlyRow, InsightRange, InsightTotals };
export { INSIGHT_RANGES };

type DecimalLike = { toNumber(): number };

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const DAY_MS = 86_400_000;

export function rangeBounds(
  range: InsightRange,
  now: Date,
): { start: Date; end: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const end = new Date(Date.UTC(year, month, now.getUTCDate() + 1));

  switch (range) {
    case "THIS_MONTH":
      return { start: new Date(Date.UTC(year, month, 1)), end };
    case "LAST_30_DAYS": {
      const start = new Date(end.getTime() - 30 * DAY_MS);
      return { start, end };
    }
    case "LAST_QUARTER":
      return { start: new Date(Date.UTC(year, month - 2, 1)), end };
    case "LAST_YEAR":
      return { start: new Date(Date.UTC(year, month - 11, 1)), end };
  }
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

type RetainerLike = {
  monthlyBudget: DecimalLike;
  currency: string;
  billingCycle: BillingCycle;
  startDate: Date;
  endDate: Date | null;
};

type EntryLike = {
  hours: DecimalLike;
  workDate: Date;
  costRate: DecimalLike;
};

export function computeInsights(input: {
  range: InsightRange;
  now: Date;
  retainers: RetainerLike[];
  entries: EntryLike[];
}): InsightTotals {
  const { start, end } = rangeBounds(input.range, input.now);
  const currency = input.retainers[0]?.currency ?? "USD";

  const retainerLikes = input.retainers.map((retainer) => ({
    monthlyBudget: retainer.monthlyBudget.toNumber(),
    billingCycle: retainer.billingCycle,
    startDate: retainer.startDate,
    endDate: retainer.endDate,
  }));

  const months = monthSteps(start, end);
  const rows: InsightMonthlyRow[] = months.map(({ year, month }) => {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 1));

    const revenue = retainerRevenueForPeriod(
      retainerLikes,
      Math.max(monthStart.getTime(), start.getTime()),
      Math.min(monthEnd.getTime(), end.getTime()),
      input.now,
    );

    const monthEntries = input.entries.filter(
      (entry) =>
        entry.workDate >= start &&
        entry.workDate < end &&
        entry.workDate >= monthStart &&
        entry.workDate < monthEnd,
    );
    const { cost, hasUnknownCost } = accumulateEntryCosts(
      monthEntries.map((entry) => ({
        hours: entry.hours.toNumber(),
        costRate: entry.costRate.toNumber(),
      })),
    );
    const { profit, marginPercent } = computeMargin(
      revenue,
      cost,
      hasUnknownCost,
    );

    return {
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      year,
      month: month + 1,
      revenue: roundToTwo(revenue),
      cost,
      profit,
      marginPercent,
      hasUnknownCost,
    };
  });

  const revenue = roundToTwo(rows.reduce((total, row) => total + row.revenue, 0));
  const cost = roundToTwo(rows.reduce((total, row) => total + row.cost, 0));
  const hasUnknownCost = rows.some((row) => row.hasUnknownCost);
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
    currency,
    startDate: start,
    endDate: end,
    months: rows,
    hasUnknownCost,
  };
}

export async function getInsightsAllRanges(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<Record<InsightRange, InsightTotals>> {
  const now = new Date();
  const widestStart = rangeBounds("LAST_YEAR", now).start;
  const widestEnd = rangeBounds("LAST_YEAR", now).end;

  const clients = await db.client.findMany({
    where: { workspaceId },
    select: {
      id: true,
      retainers: {
        where: { isActive: true },
        select: {
          monthlyBudget: true,
          currency: true,
          billingCycle: true,
          startDate: true,
          endDate: true,
        },
      },
      timeEntries: {
        where: { workDate: { gte: widestStart, lte: widestEnd } },
        select: {
          hours: true,
          workDate: true,
          member: { select: { costRate: true } },
        },
      },
    },
  });

  const retainers = clients.flatMap((client) => client.retainers);
  const entries = clients.flatMap((client) =>
    client.timeEntries.map((entry) => ({
      hours: entry.hours,
      workDate: entry.workDate,
      costRate: entry.member.costRate,
    })),
  );

  return Object.fromEntries(
    INSIGHT_RANGES.map((range) => [
      range,
      computeInsights({ range, now, retainers, entries }),
    ]),
  ) as Record<InsightRange, InsightTotals>;
}

export async function getInsightsDataset(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<InsightDataset> {
  const now = new Date();
  const widestStart = rangeBounds("LAST_YEAR", now).start;
  const widestEnd = now;

  const [clients, members, entries, reports] = await Promise.all([
    db.client.findMany({
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
        retainers: {
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
          select: {
            monthlyBudget: true,
            currency: true,
            billingCycle: true,
            scopeHours: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    }),
    db.workspaceMember.findMany({
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
    db.timeEntry.findMany({
      where: { workspaceId, workDate: { gte: widestStart, lte: widestEnd } },
      orderBy: { workDate: "desc" },
      select: {
        id: true,
        clientId: true,
        memberId: true,
        task: true,
        hours: true,
        workDate: true,
        createdAt: true,
      },
    }),
    db.report.findMany({
      where: { workspaceId },
      orderBy: { generatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        clientId: true,
        reportMonth: true,
        marginPercent: true,
        generatedAt: true,
      },
    }),
  ]);

  const userInfos = await getClerkUserInfos(
    members.map((member) => member.userId),
  );

  const currency =
    clients.find((client) => client.retainers.length > 0)?.retainers[0]
      ?.currency ?? members[0]?.currency ?? "USD";

  return {
    currency,
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      status: client.status,
      healthyThreshold: client.healthyThreshold.toNumber(),
      warningThreshold: client.warningThreshold.toNumber(),
      criticalThreshold: client.criticalThreshold.toNumber(),
      createdAt: client.createdAt,
      retainers: client.retainers.map((retainer) => ({
        monthlyBudget: retainer.monthlyBudget.toNumber(),
        currency: retainer.currency,
        billingCycle: retainer.billingCycle,
        scopeHours: retainer.scopeHours,
        startDate: retainer.startDate,
        endDate: retainer.endDate,
      })),
    })),
    members: members.map((member) => {
      const info = userInfos.get(member.userId) ?? { name: null };
      return {
        id: member.id,
        name: info.name ?? "Unnamed member",
        costRate: member.costRate.toNumber(),
        billingRate: member.billingRate.toNumber(),
        currency: member.currency,
      };
    }),
    entries: entries.map((entry) => ({
      id: entry.id,
      clientId: entry.clientId,
      memberId: entry.memberId,
      task: entry.task,
      hours: entry.hours.toNumber(),
      workDate: entry.workDate,
      createdAt: entry.createdAt,
    })),
    reports: reports.map((report) => ({
      id: report.id,
      clientId: report.clientId,
      reportMonth: report.reportMonth,
      marginPercent: report.marginPercent.toNumber(),
      generatedAt: report.generatedAt,
    })),
  };
}
