import "server-only";

import { prisma } from "@/lib/prisma";
import { computeMonthlyMarginRows, roundToTwo } from "@/lib/margins";
import { monthKeyOf } from "@/lib/format";
import type { BillingCycle } from "@/lib/generated/prisma/enums";
import {
  buildReportTrendSnapshot,
  nextReportVersion,
} from "@/lib/report-snapshot";

export type ReportRow = {
  id: string;
  clientId: string;
  clientName: string;
  reportMonth: Date;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  currency: string;
  generatedAt: Date;
  version: number;
  hours: number;
  monthlyBudget: number | null;
  scopeHours: number | null;
};

const MONTH_KEY_REGEX = /^(\d{4})-(\d{2})$/;

export function monthKeyToDate(key: string): Date | null {
  const match = MONTH_KEY_REGEX.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

type ReportPayload = {
  id: string;
  clientId: string;
  reportMonth: Date;
  revenue: { toNumber(): number };
  cost: { toNumber(): number };
  profit: { toNumber(): number };
  marginPercent: { toNumber(): number };
  currency: string;
  generatedAt: Date;
  version: number;
  client: { name: string };
};

export function toReportRow(
  report: ReportPayload,
): Omit<ReportRow, "hours" | "monthlyBudget" | "scopeHours"> {
  return {
    id: report.id,
    clientId: report.clientId,
    clientName: report.client.name,
    reportMonth: report.reportMonth,
    revenue: report.revenue.toNumber(),
    cost: report.cost.toNumber(),
    profit: report.profit.toNumber(),
    marginPercent: report.marginPercent.toNumber(),
    currency: report.currency,
    generatedAt: report.generatedAt,
    version: report.version,
  };
}

const reportSelect = {
  id: true,
  clientId: true,
  reportMonth: true,
  version: true,
  revenue: true,
  cost: true,
  profit: true,
  marginPercent: true,
  currency: true,
  hours: true,
  monthlyBudget: true,
  scopeHours: true,
  generatedAt: true,
  client: { select: { name: true } },
} as const;

type DecimalLike = { toNumber(): number };

export async function getStoredReports(
  workspaceId: string,
): Promise<ReportRow[]> {
  const [reports, retainers, timeEntries] = await Promise.all([
    prisma.report.findMany({
      where: { workspaceId },
      select: reportSelect,
      orderBy: [{ reportMonth: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.retainer.findMany({
      where: { isActive: true, client: { workspaceId } },
      orderBy: { updatedAt: "desc" },
      select: { clientId: true, monthlyBudget: true, scopeHours: true },
    }),
    prisma.timeEntry.findMany({
      where: { workspaceId },
      select: { clientId: true, workDate: true, hours: true },
    }),
  ]);

  const retainerByClient = new Map<
    string,
    { monthlyBudget: DecimalLike | null; scopeHours: number | null }
  >();
  for (const retainer of retainers) {
    if (!retainerByClient.has(retainer.clientId)) {
      retainerByClient.set(retainer.clientId, retainer);
    }
  }

  const hoursByClientMonth = new Map<string, number>();
  for (const entry of timeEntries) {
    const key = `${entry.clientId}:${monthKeyOf(entry.workDate)}`;
    hoursByClientMonth.set(
      key,
      (hoursByClientMonth.get(key) ?? 0) + entry.hours.toNumber(),
    );
  }

  return reports.map((report) => {
    // Reports generated after the snapshot feature always store their own
    // hours, budget, and scope. Legacy rows predate those columns; keep the
    // old live-derived display for them rather than dropping the data.
    const hasSnapshot = report.hours != null;
    const retainer = retainerByClient.get(report.clientId);
    const budget = retainer?.monthlyBudget;

    const hours = hasSnapshot
      ? roundToTwo(report.hours!.toNumber())
      : roundToTwo(
          hoursByClientMonth.get(
            `${report.clientId}:${monthKeyOf(report.reportMonth)}`,
          ) ?? 0,
        );

    const monthlyBudget = hasSnapshot
      ? report.monthlyBudget != null
        ? roundToTwo(report.monthlyBudget.toNumber())
        : null
      : budget != null
        ? roundToTwo(budget.toNumber())
        : null;

    const scopeHours = hasSnapshot
      ? report.scopeHours ?? null
      : retainer?.scopeHours ?? null;

    return {
      ...toReportRow(report),
      hours,
      monthlyBudget,
      scopeHours,
    };
  });
}

export async function getReportableMonths(
  workspaceId: string,
): Promise<string[]> {
  const entries = await prisma.timeEntry.findMany({
    where: { workspaceId },
    select: { workDate: true },
  });

  const keys = new Set(entries.map((entry) => monthKeyOf(entry.workDate)));
  return [...keys].sort((a, b) => b.localeCompare(a));
}

export async function generateReportSnapshot(
  workspaceId: string,
  clientId: string,
  monthKey: string,
): Promise<ReportRow | null> {
  const reportMonth = monthKeyToDate(monthKey);
  if (!reportMonth) return null;

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      healthyThreshold: true,
      warningThreshold: true,
      criticalThreshold: true,
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
          scopeHours: true,
        },
      },
      timeEntries: {
        select: {
          hours: true,
          workDate: true,
          member: { select: { costRate: true } },
        },
      },
    },
  });

  if (!client) return null;

  const { months, currency } = computeMonthlyMarginRows(client);
  const month = months.find((row) => row.key === monthKey);
  if (!month) return null;

  const revenue = roundToTwo(month.revenue);
  const cost = roundToTwo(month.cost);
  const profit = roundToTwo(month.profit);
  const marginPercent = roundToTwo(month.marginPercent);
  const hours = roundToTwo(month.hours);

  const retainer = client.retainers[0];
  const monthlyBudget = retainer
    ? roundToTwo(retainer.monthlyBudget.toNumber())
    : null;
  const scopeHours = retainer?.scopeHours ?? null;
  const billingCycle: BillingCycle | null = retainer?.billingCycle ?? null;
  const retainerStartDate = retainer?.startDate ?? null;
  const retainerEndDate = retainer?.endDate ?? null;

  const trendJson = buildReportTrendSnapshot(months, monthKey);
  const latest = await prisma.report.findFirst({
    where: { workspaceId, clientId, reportMonth },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = nextReportVersion(latest?.version);

  const report = await prisma.report.create({
    data: {
      workspaceId,
      clientId,
      reportMonth,
      version,
      revenue,
      cost,
      profit,
      marginPercent,
      currency,
      hours,
      monthlyBudget,
      scopeHours,
      billingCycle,
      retainerStartDate,
      retainerEndDate,
      trendJson,
      generatedAt: new Date(),
    },
    select: reportSelect,
  });

  return {
    ...toReportRow(report),
    hours,
    monthlyBudget,
    scopeHours,
  };
}