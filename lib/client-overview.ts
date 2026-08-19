import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import {
  calculateMargin,
  toMarginThresholds,
  type MarginStatus,
} from "@/lib/margins";
import { calculateBudgetForecast, type BudgetStatus } from "@/lib/budget";
import { retainerMonthlyAmount } from "@/lib/retainers";

export type { BudgetStatus };

export type ClientBurnStatus = BudgetStatus;

export type ClientOverviewRow = {
  id: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  marginStatus: MarginStatus;
  currency: string;
  burnStatus: ClientBurnStatus | null;
  burnProjectedOverrun: number;
  activeAlerts: number;
};

export async function getClientOverview(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<ClientOverviewRow[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));

  const clients = await db.client.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      healthyThreshold: true,
      warningThreshold: true,
      criticalThreshold: true,
      retainers: {
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { monthlyBudget: true, currency: true, billingCycle: true },
      },
      timeEntries: {
        where: { workDate: { gte: monthStart, lt: nextMonthStart } },
        select: {
          hours: true,
          member: { select: { costRate: true } },
        },
      },
    },
  });

  const alertCounts = await db.alert.groupBy({
    by: ["clientId"],
    where: { workspaceId, isResolved: false },
    _count: { id: true },
  });
  const alertCountMap = new Map(
    alertCounts.map((row) => [row.clientId, row._count.id]),
  );

  return clients.map((client) => {
    const retainer = client.retainers[0];
    const currency = retainer?.currency ?? "USD";
    const revenue = retainer
      ? retainerMonthlyAmount(
          retainer.monthlyBudget.toNumber(),
          retainer.billingCycle,
        )
      : 0;
    const entries = client.timeEntries.map((entry) => ({
      cost: entry.hours.toNumber() * entry.member.costRate.toNumber(),
    }));
    const cost = entries.reduce((total, entry) => total + entry.cost, 0);

    const thresholds = toMarginThresholds(client);
    const margin = calculateMargin(revenue, cost, currency, thresholds);

    const burn = retainer
      ? calculateBudgetForecast({
          monthlyBudget: revenue,
          currency,
          entries,
        })
      : null;

    return {
      id: client.id,
      name: client.name,
      revenue: margin.revenue,
      cost: margin.cost,
      profit: margin.profit,
      marginPercent: margin.marginPercent,
      marginStatus: margin.status,
      currency: margin.currency,
      burnStatus: burn?.status ?? null,
      burnProjectedOverrun: burn?.projectedOverrun ?? 0,
      activeAlerts: alertCountMap.get(client.id) ?? 0,
    };
  });
}
