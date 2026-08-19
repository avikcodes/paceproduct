export type ReportSnapshotTrendPoint = {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  hours: number;
};

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const PERIOD_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function reportPeriodLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return key;
  return PERIOD_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Version number for a newly generated report. Historical reports are
 * immutable, so regeneration creates a new version rather than overwriting
 * the previous one.
 */
export function nextReportVersion(currentMax: number | null | undefined): number {
  return (currentMax ?? 0) + 1;
}

type TrendMonthSource = {
  key: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  hours: number;
};

/**
 * Trailing monthly window ending at (and including) the report month, oldest
 * first, capped at six points. This is captured at generation time so later
 * changes to retainers or cost rates never mutate an existing report.
 */
export function buildReportTrendSnapshot(
  months: TrendMonthSource[],
  reportMonthKey: string,
): ReportSnapshotTrendPoint[] {
  return months
    .filter((month) => month.key <= reportMonthKey)
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 6)
    .reverse()
    .map((month) => ({
      key: month.key,
      label: reportPeriodLabel(month.key),
      revenue: roundToTwo(month.revenue),
      cost: roundToTwo(month.cost),
      profit: roundToTwo(month.profit),
      marginPercent: roundToTwo(month.marginPercent),
      hours: roundToTwo(month.hours),
    }));
}

/**
 * Validates and normalizes the snapshot trend JSON stored on a Report row.
 * Returns null when the stored value is missing or malformed so callers can
 * fall back to a single-point view derived from the report itself (never by
 * recomputing historical values from live database state).
 */
export function parseReportTrendJson(value: unknown): ReportSnapshotTrendPoint[] | null {
  if (!Array.isArray(value)) return null;

  const points: ReportSnapshotTrendPoint[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : null;
    const revenue = typeof record.revenue === "number" ? record.revenue : null;
    const cost = typeof record.cost === "number" ? record.cost : null;
    const profit = typeof record.profit === "number" ? record.profit : null;
    const marginPercent =
      typeof record.marginPercent === "number" ? record.marginPercent : null;
    const hours = typeof record.hours === "number" ? record.hours : null;
    if (
      key === null ||
      revenue === null ||
      cost === null ||
      profit === null ||
      marginPercent === null ||
      hours === null
    ) {
      return null;
    }
    points.push({
      key,
      label:
        typeof record.label === "string" && record.label
          ? record.label
          : reportPeriodLabel(key),
      revenue,
      cost,
      profit,
      marginPercent,
      hours,
    });
  }

  return points;
}