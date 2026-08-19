import "server-only";

import { prisma } from "@/lib/prisma";
import { accumulateEntryCosts, computeMargin, roundToTwo } from "@/lib/financials";
import type { MarginStatus } from "@/lib/margin-status";
import { retainerMonthlyAmount } from "@/lib/retainers";

export type ProfitabilityBadge = "TOP_PERFORMER" | MarginStatus;

export type ClientProfitability = {
  clientId: string;
  name: string;
  currency: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  marginStatus: MarginStatus;
  totalHours: number;
  /**
   * True when any time entry belongs to a member whose cost rate is unset (0).
   * Cost is then incomplete, so cost/profit/margin are shown as unknown rather
   * than reported as if a full cost total existed.
   */
  hasUnknownCost: boolean;
  badge: ProfitabilityBadge;
};

export type ClientProfitabilityInput = {
  id: string;
  name: string;
  currency: string;
  healthyThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  retainerRevenue: number;
  entries: Array<{ hours: number; costRate: number }>;
};

function marginStatusFor(
  revenue: number,
  marginPercent: number,
  hasUnknownCost: boolean,
  healthy: number,
  warning: number,
  critical: number,
): MarginStatus {
  if (revenue <= 0) return "CRITICAL";
  if (hasUnknownCost) return "CRITICAL";
  if (marginPercent >= healthy) return "HEALTHY";
  if (marginPercent >= warning) return "WARNING";
  if (marginPercent >= critical) return "CRITICAL";
  return "CRITICAL";
}

export function computeClientProfitabilityRows(
  clients: ClientProfitabilityInput[],
): ClientProfitability[] {
  const rows: ClientProfitability[] = clients.map((client) => {
    const { cost, hasUnknownCost } = accumulateEntryCosts(client.entries);
    const totalHours = roundToTwo(
      client.entries.reduce((total, entry) => total + entry.hours, 0),
    );
    const revenue = roundToTwo(client.retainerRevenue);
    const { profit, marginPercent } = computeMargin(
      revenue,
      cost,
      hasUnknownCost,
    );

    return {
      clientId: client.id,
      name: client.name,
      currency: client.currency,
      revenue,
      cost,
      profit,
      marginPercent,
      marginStatus: marginStatusFor(
        revenue,
        marginPercent,
        hasUnknownCost,
        client.healthyThreshold,
        client.warningThreshold,
        client.criticalThreshold,
      ),
      totalHours,
      hasUnknownCost,
      badge: "CRITICAL",
    };
  });

  const topPerformer = rows
    .filter((row) => !row.hasUnknownCost && row.profit > 0)
    .sort(
      (a, b) =>
        b.profit - a.profit ||
        b.marginPercent - a.marginPercent ||
        b.revenue - a.revenue,
    )[0];

  if (topPerformer) {
    for (const row of rows) {
      if (row.clientId === topPerformer.clientId) {
        row.badge = "TOP_PERFORMER";
      }
    }
  }

  return rows;
}

export async function getClientProfitability(
  workspaceId: string,
): Promise<ClientProfitability[]> {
  const clients = await prisma.client.findMany({
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
        select: {
          hours: true,
          member: { select: { costRate: true } },
        },
      },
    },
  });

  return computeClientProfitabilityRows(
    clients.map((client) => {
      const retainer = client.retainers[0];
      return {
        id: client.id,
        name: client.name,
        currency: retainer?.currency ?? "USD",
        healthyThreshold: client.healthyThreshold.toNumber(),
        warningThreshold: client.warningThreshold.toNumber(),
        criticalThreshold: client.criticalThreshold.toNumber(),
        retainerRevenue: retainer
          ? retainerMonthlyAmount(
              retainer.monthlyBudget.toNumber(),
              retainer.billingCycle,
            )
          : 0,
        entries: client.timeEntries.map((entry) => ({
          hours: entry.hours.toNumber(),
          costRate: entry.member.costRate.toNumber(),
        })),
      };
    }),
  );
}