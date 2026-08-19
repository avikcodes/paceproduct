export const MARGIN_TREND_RANGES = [3, 6, 12] as const;
export type MarginTrendRange = (typeof MARGIN_TREND_RANGES)[number];
export const DEFAULT_MARGIN_TREND_RANGE: MarginTrendRange = 6;