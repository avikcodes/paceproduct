import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { retainerMonthlyAmount } from "@/lib/retainers";

export type BudgetStatus = "ON_TRACK" | "AT_RISK" | "OVER";

export type BudgetForecast = {
  monthlyBudget: number;
  currency: string;
  currentSpend: number;
  spendRate: number;
  estimatedMonthSpend: number;
  remainingBudget: number;
  projectedOverrun: number;
  overrunDate: Date | null;
  daysElapsed: number;
  daysInMonth: number;
  status: BudgetStatus;
};

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateBudgetForecast(input: {
  monthlyBudget: number;
  currency: string;
  entries: Array<{ cost: number }>;
  today?: Date;
}): BudgetForecast {
  const now = input.today ?? new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysElapsed = now.getUTCDate();

  const currentSpend = roundToTwo(
    input.entries.reduce((total, entry) => total + entry.cost, 0),
  );
  const spendRate = daysElapsed > 0 ? currentSpend / daysElapsed : 0;
  const estimatedMonthSpend = roundToTwo(spendRate * daysInMonth);
  const remainingBudget = roundToTwo(input.monthlyBudget - currentSpend);
  const projectedOverrun = roundToTwo(
    Math.max(0, estimatedMonthSpend - input.monthlyBudget),
  );

  let overrunDate: Date | null = null;
  if (spendRate > 0) {
    const day = input.monthlyBudget / spendRate;
    if (day <= daysInMonth) {
      const overrunDay = Math.min(Math.max(1, Math.ceil(day)), daysInMonth);
      overrunDate = new Date(Date.UTC(year, month, overrunDay));
    }
  }

  const status: BudgetStatus =
    currentSpend >= input.monthlyBudget
      ? "OVER"
      : projectedOverrun > 0
        ? "AT_RISK"
        : "ON_TRACK";

  return {
    monthlyBudget: roundToTwo(input.monthlyBudget),
    currency: input.currency,
    currentSpend,
    spendRate: roundToTwo(spendRate),
    estimatedMonthSpend,
    remainingBudget,
    projectedOverrun,
    overrunDate,
    daysElapsed,
    daysInMonth,
    status,
  };
}

export async function getBudgetForecast(
  clientId: string,
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<BudgetForecast | null> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));

  const client = await db.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
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

  if (!client) return null;
  const retainer = client.retainers[0];
  if (!retainer) return null;

  return calculateBudgetForecast({
    monthlyBudget: retainerMonthlyAmount(
      retainer.monthlyBudget.toNumber(),
      retainer.billingCycle,
    ),
    currency: retainer.currency,
    entries: client.timeEntries.map((entry) => ({
      cost: entry.hours.toNumber() * entry.member.costRate.toNumber(),
    })),
  });
}
