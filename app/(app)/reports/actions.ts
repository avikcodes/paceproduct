"use server";

import { getWorkspaceIfHasCapability } from "@/lib/permissions";
import {
  DEFAULT_MARGIN_TREND_RANGE,
  MARGIN_TREND_RANGES,
  getMarginTrends,
  type MarginTrendRange,
  type MarginTrendsData,
} from "@/lib/margins";

export type MarginTrendActionResult =
  | { ok: true; data: MarginTrendsData }
  | { ok: false; error: string };

function toMarginTrendRange(value: number): MarginTrendRange {
  return (MARGIN_TREND_RANGES as readonly number[]).includes(value)
    ? (value as MarginTrendRange)
    : DEFAULT_MARGIN_TREND_RANGE;
}

export async function getMarginTrendsForRange(
  months: number,
): Promise<MarginTrendActionResult> {
  const workspace = await getWorkspaceIfHasCapability("viewReports");
  if (!workspace) {
    return { ok: false, error: "You don't have permission to view reports." };
  }

  try {
    const data = await getMarginTrends(
      workspace.workspaceId,
      toMarginTrendRange(months),
    );
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Couldn't load margin trends." };
  }
}