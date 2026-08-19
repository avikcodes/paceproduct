import "server-only";
import { prisma } from "@/lib/prisma";
import {
  getScopeUsage,
  SCOPE_THRESHOLDS,
  type ScopeThreshold,
  type ScopeUsage,
} from "@/lib/scope";
import type { PrismaClient } from "@/lib/generated/prisma/client";

const ALERT_TYPE = "SCOPE" as const;

function formatHours(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} hrs`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function severityForThreshold(
  threshold: ScopeThreshold,
): "INFO" | "WARNING" | "CRITICAL" {
  if (threshold >= 100) return "CRITICAL";
  if (threshold === 90) return "WARNING";
  return "INFO";
}

function scopeAlertContent(
  threshold: ScopeThreshold,
  usage: ScopeUsage,
): { title: string; description: string } {
  const used = formatHours(usage.loggedHours);
  const total = formatHours(usage.scopeHours);
  const percent = formatPercent(usage.percentUsed);

  if (threshold === 100) {
    return {
      title: "Scope limit reached",
      description: `${used} logged against ${total} of monthly scope hours (${percent}). The scope is fully consumed.`,
    };
  }

  if (threshold === 110) {
    const over = formatHours(Math.max(0, usage.loggedHours - usage.scopeHours));
    return {
      title: "Scope overrun",
      description: `${used} logged against ${total} of monthly scope hours (${percent}) — over scope by ${over}.`,
    };
  }

  return {
    title: `${threshold}% of scope used`,
    description: `${used} logged against ${total} of monthly scope hours (${percent}).`,
  };
}

export async function evaluateClientScopeAlert(
  clientId: string,
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const usage = await getScopeUsage(clientId, workspaceId, db);

  await db.$transaction(async (tx) => {
    const existing = await tx.alert.findMany({
      where: {
        workspaceId,
        clientId,
        type: ALERT_TYPE,
        isResolved: false,
      },
      select: { id: true, severity: true, scopeThreshold: true },
    });

    const byThreshold = new Map<number | null, (typeof existing)[number]>();
    for (const alert of existing) {
      byThreshold.set(alert.scopeThreshold, alert);
    }

    if (!usage) {
      for (const alert of existing) {
        await tx.alert.update({
          where: { id: alert.id },
          data: { isResolved: true, resolvedAt: new Date() },
        });
      }
      return;
    }

    for (const threshold of SCOPE_THRESHOLDS) {
      const crossed = usage.percentUsed >= threshold;
      const alert = byThreshold.get(threshold);

      if (!crossed) {
        if (alert) {
          await tx.alert.update({
            where: { id: alert.id },
            data: { isResolved: true, resolvedAt: new Date() },
          });
        }
        continue;
      }

      const severity = severityForThreshold(threshold);
      const { title, description } = scopeAlertContent(threshold, usage);

      if (!alert) {
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
            scopeThreshold: threshold,
          },
        });
        continue;
      }

      if (alert.severity !== severity) {
        await tx.alert.update({
          where: { id: alert.id },
          data: { severity, title, description, isRead: false },
        });
        continue;
      }

      await tx.alert.update({
        where: { id: alert.id },
        data: { title, description },
      });
    }
  });
}

export async function evaluateAllScopeAlerts(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const clients = await db.client.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  for (const client of clients) {
    await evaluateClientScopeAlert(client.id, workspaceId, db);
  }
}
