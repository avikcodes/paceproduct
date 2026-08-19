import "server-only";
import { prisma } from "@/lib/prisma";
import { getBudgetForecast, type BudgetForecast } from "@/lib/budget";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { formatMoney } from "@/lib/retainers";

const ALERT_TYPE = "BUDGET" as const;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    date,
  );
}

function budgetAlertContent(forecast: BudgetForecast): {
  title: string;
  description: string;
} {
  if (forecast.currentSpend >= forecast.monthlyBudget) {
    return {
      title: "Budget exceeded",
      description: `Current spend is ${formatMoney(forecast.currentSpend, forecast.currency)} against a ${formatMoney(forecast.monthlyBudget, forecast.currency)} monthly budget. Projected end-of-month spend is ${formatMoney(forecast.estimatedMonthSpend, forecast.currency)}.`,
    };
  }

  const date = forecast.overrunDate
    ? ` by ${formatDate(forecast.overrunDate)}`
    : "";
  return {
    title: "Budget burn projected",
    description: `Projected spend is ${formatMoney(forecast.estimatedMonthSpend, forecast.currency)} by month end against a ${formatMoney(forecast.monthlyBudget, forecast.currency)} budget — an expected overrun of ${formatMoney(forecast.projectedOverrun, forecast.currency)}${date}.`,
  };
}

export async function evaluateClientBudgetAlert(
  clientId: string,
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const forecast = await getBudgetForecast(clientId, workspaceId, db);

  await db.$transaction(async (tx) => {
    const existing = await tx.alert.findFirst({
      where: {
        workspaceId,
        clientId,
        type: ALERT_TYPE,
        isResolved: false,
      },
      select: { id: true, severity: true },
      orderBy: { createdAt: "desc" },
    });

    if (!forecast || forecast.projectedOverrun <= 0) {
      if (existing) {
        await tx.alert.update({
          where: { id: existing.id },
          data: { isResolved: true, resolvedAt: new Date() },
        });
      }
      return;
    }

    const severity: "WARNING" | "CRITICAL" =
      forecast.currentSpend >= forecast.monthlyBudget ? "CRITICAL" : "WARNING";
    const { title, description } = budgetAlertContent(forecast);

    if (!existing) {
      await tx.alert.create({
        data: {
          workspaceId,
          clientId,
          type: ALERT_TYPE,
          severity,
          title,
          description,
          isRead: false,
          isResolved: false,
        },
      });
      return;
    }

    if (existing.severity !== severity) {
      await tx.alert.update({
        where: { id: existing.id },
        data: { severity, title, description, isRead: false },
      });
      return;
    }

    await tx.alert.update({
      where: { id: existing.id },
      data: { description },
    });
  });
}

export async function evaluateAllBudgetAlerts(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const clients = await db.client.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  for (const client of clients) {
    await evaluateClientBudgetAlert(client.id, workspaceId, db);
  }
}
