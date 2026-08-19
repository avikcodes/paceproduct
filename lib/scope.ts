import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import {
  SCOPE_THRESHOLDS,
  type ScopeStatus,
  type ScopeThreshold,
} from "@/lib/scope-status";

export type { ScopeStatus, ScopeThreshold };
export { SCOPE_THRESHOLDS };

export type ScopeUsage = {
  scopeHours: number;
  loggedHours: number;
  remainingHours: number;
  percentUsed: number;
  status: ScopeStatus;
};

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function scopeStatusForPercent(percentUsed: number): ScopeStatus {
  if (percentUsed >= 110) return "OVERRUN";
  if (percentUsed >= 100) return "EXCEEDED";
  if (percentUsed >= 90) return "AT_RISK";
  if (percentUsed >= 80) return "NEARING";
  return "ON_TRACK";
}

export function calculateScopeUsage(input: {
  scopeHours: number;
  entries: Array<{ hours: number }>;
}): ScopeUsage {
  const scopeHours = roundToTwo(Math.max(0, input.scopeHours || 0));
  const loggedHours = roundToTwo(
    input.entries.reduce((total, entry) => total + entry.hours, 0),
  );
  const remainingHours = roundToTwo(scopeHours - loggedHours);
  const percentUsed =
    scopeHours > 0 ? Math.round((loggedHours / scopeHours) * 1000) / 10 : 0;

  return {
    scopeHours,
    loggedHours,
    remainingHours,
    percentUsed,
    status: scopeStatusForPercent(percentUsed),
  };
}

type ScopeClientData = {
  id: string;
  retainers: Array<{ scopeHours: number }>;
  timeEntries: Array<{ hours: { toNumber(): number } }>;
};

export function computeScopeUsage(client: ScopeClientData): ScopeUsage | null {
  const retainer = client.retainers[0];
  if (!retainer) return null;
  return calculateScopeUsage({
    scopeHours: retainer.scopeHours,
    entries: client.timeEntries.map((entry) => ({
      hours: entry.hours.toNumber(),
    })),
  });
}

function currentMonthWindow(now: Date): { start: Date; end: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  };
}

export async function getScopeUsage(
  clientId: string,
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<ScopeUsage | null> {
  const { start, end } = currentMonthWindow(new Date());

  const client = await db.client.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      id: true,
      retainers: {
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { scopeHours: true },
      },
      timeEntries: {
        where: { workDate: { gte: start, lt: end } },
        select: { hours: true },
      },
    },
  });

  if (!client) return null;

  return computeScopeUsage(client);
}

export async function getScopeUsages(
  workspaceId: string,
): Promise<Record<string, ScopeUsage>> {
  const { start, end } = currentMonthWindow(new Date());

  const clients = await prisma.client.findMany({
    where: { workspaceId },
    select: {
      id: true,
      retainers: {
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { scopeHours: true },
      },
      timeEntries: {
        where: { workDate: { gte: start, lt: end } },
        select: { hours: true },
      },
    },
  });

  return Object.fromEntries(
    clients
      .map((client) => {
        const usage = computeScopeUsage(client);
        return usage ? [client.id, usage] : null;
      })
      .filter((entry): entry is [string, ScopeUsage] => entry !== null),
  );
}
