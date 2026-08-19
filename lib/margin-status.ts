export type MarginStatus = "HEALTHY" | "WARNING" | "CRITICAL";

export type MarginThresholds = {
  healthy: number;
  warning: number;
  critical: number;
};

export const DEFAULT_MARGIN_THRESHOLDS: MarginThresholds = {
  healthy: 20,
  warning: 10,
  critical: 0,
};

export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

export const MARGIN_STATUS_OPTIONS: ReadonlyArray<{
  value: MarginStatus;
  label: string;
}> = [
  { value: "HEALTHY", label: "Healthy" },
  { value: "WARNING", label: "Warning" },
  { value: "CRITICAL", label: "Critical" },
];

export function marginStatusLabel(status: MarginStatus): string {
  return (
    MARGIN_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}
