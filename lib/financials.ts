/**
 * Shared financial computation used by the Dashboard, Insights, and
 * Reports pipelines so cost and margin are derived consistently.
 *
 * A member cost rate of 0 means the rate is unset (the schema defaults it
 * to 0 rather than null). Treating an unset rate as a $0 cost would report
 * a false 100% margin, so cost is only summed for entries with a rate > 0
 * and the caller is told whether the total is incomplete via
 * `hasUnknownCost`.
 */

import type { BillingCycle } from "@/lib/generated/prisma/enums";
import { retainerMonthlyAmount } from "@/lib/retainers";

export type CostEntryLike = {
  hours: number;
  costRate: number;
};

export type CostTotals = {
  cost: number;
  hasUnknownCost: boolean;
};

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Sums hours × costRate across entries, treating a rate of 0 (unset) as
 * unknown cost rather than $0. Entries with an unset rate set
 * `hasUnknownCost` so margin is not reported as if cost were complete.
 */
export function accumulateEntryCosts(entries: CostEntryLike[]): CostTotals {
  let cost = 0;
  let hasUnknownCost = false;
  for (const entry of entries) {
    if (entry.costRate <= 0) {
      hasUnknownCost = true;
    } else {
      cost += entry.hours * entry.costRate;
    }
  }
  return { cost: roundToTwo(cost), hasUnknownCost };
}

export type MarginResult = {
  profit: number;
  marginPercent: number;
};

/**
 * Profit and margin for a revenue/cost pair. When cost is unknown (unset
 * cost rates) or revenue is zero, margin is reported as 0 rather than a
 * misleading figure derived from an incomplete cost total.
 */
export function computeMargin(
  revenue: number,
  cost: number,
  hasUnknownCost: boolean,
): MarginResult {
  const profit = roundToTwo(revenue - cost);
  const marginPercent =
    hasUnknownCost || revenue <= 0
      ? 0
      : Math.round((profit / revenue) * 1000) / 10;
  return { profit, marginPercent };
}

const DAY_MS = 86_400_000;

function utcMonthStart(instantMs: number): number {
  const date = new Date(instantMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function nextUtcMonthStart(monthStartMs: number): number {
  const date = new Date(monthStartMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export type RetainerRevenueLike = {
  monthlyBudget: number;
  billingCycle: BillingCycle;
  startDate: Date;
  endDate: Date | null;
};

function retainerActiveInMonth(
  retainer: RetainerRevenueLike,
  monthStartMs: number,
  monthEndMs: number,
  now: Date,
): boolean {
  const windowStart = retainer.startDate.getTime();
  const windowEnd = retainer.endDate
    ? retainer.endDate.getTime()
    : now.getTime();
  return Math.max(windowStart, monthStartMs) < Math.min(windowEnd, monthEndMs);
}

/**
 * Retainer revenue recognized over a [start, end) window. A retainer
 * contributes its monthly amount for every calendar month it is active in,
 * prorated by the fraction of that month inside the window. This is the one
 * source of retainer revenue shared by the Dashboard, Insights, and every
 * monthly trend so the figures stay consistent across views.
 */
export function retainerRevenueForPeriod(
  retainers: RetainerRevenueLike[],
  startMs: number,
  endMs: number,
  now: Date,
): number {
  let revenue = 0;
  let monthStart = utcMonthStart(startMs);
  let guard = 0;
  while (monthStart < endMs && guard < 240) {
    guard += 1;
    const monthEnd = nextUtcMonthStart(monthStart);
    const overlapStart = Math.max(monthStart, startMs);
    const overlapEnd = Math.min(monthEnd, endMs);
    if (overlapEnd > overlapStart) {
      const daysInMonth = (monthEnd - monthStart) / DAY_MS;
      const proration = (overlapEnd - overlapStart) / DAY_MS / daysInMonth;
      for (const retainer of retainers) {
        if (retainerActiveInMonth(retainer, monthStart, monthEnd, now)) {
          revenue +=
            retainerMonthlyAmount(retainer.monthlyBudget, retainer.billingCycle) *
            proration;
        }
      }
    }
    monthStart = monthEnd;
  }
  return roundToTwo(revenue);
}