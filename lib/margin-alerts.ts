import "server-only";
import { prisma } from "@/lib/prisma";
import { getClientMargin } from "@/lib/margins";
import type { PrismaClient } from "@/lib/generated/prisma/client";

const ALERT_TYPE = "MARGIN" as const;

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function alertContent(
  severity: "WARNING" | "CRITICAL",
  marginPercent: number,
  revenue: number,
  cost: number,
  currency: string,
  threshold: number,
): { title: string; description: string } {
  if (severity === "WARNING") {
    return {
      title: "Margin below warning threshold",
      description: `Current margin is ${formatPercent(marginPercent)}, below the warning threshold of ${formatPercent(threshold)}. Revenue ${formatCurrency(revenue, currency)} · Cost ${formatCurrency(cost, currency)}.`,
    };
  }
  return {
    title: "Margin below critical threshold",
    description: `Current margin is ${formatPercent(marginPercent)}, below the critical threshold of ${formatPercent(threshold)}. Revenue ${formatCurrency(revenue, currency)} · Cost ${formatCurrency(cost, currency)}.`,
  };
}

export async function evaluateClientMarginAlert(
  clientId: string,
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const client = await db.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      retainers: {
        where: { isActive: true },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!client || client.retainers.length === 0) {
    const existing = await db.alert.findFirst({
      where: {
        workspaceId,
        clientId,
        type: ALERT_TYPE,
        isResolved: false,
      },
      select: { id: true },
    });
    if (existing) {
      await db.alert.update({
        where: { id: existing.id },
        data: { isResolved: true, resolvedAt: new Date() },
      });
    }
    return;
  }

  const margin = await getClientMargin(clientId, workspaceId, db);

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

    if (margin.status === "HEALTHY") {
      if (existing) {
        await tx.alert.update({
          where: { id: existing.id },
          data: { isResolved: true, resolvedAt: new Date() },
        });
      }
      return;
    }

    const severity = margin.status as "WARNING" | "CRITICAL";
    const threshold =
      severity === "WARNING"
        ? margin.thresholds.warning
        : margin.thresholds.critical;
    const { title, description } = alertContent(
      severity,
      margin.marginPercent,
      margin.revenue,
      margin.cost,
      margin.currency,
      threshold,
    );

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
        data: {
          severity,
          title,
          description,
          isRead: false,
        },
      });
      return;
    }

    await tx.alert.update({
      where: { id: existing.id },
      data: { description },
    });
  });
}

export async function evaluateAllMarginAlerts(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const clients = await db.client.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  for (const client of clients) {
    await evaluateClientMarginAlert(client.id, workspaceId, db);
  }
}
