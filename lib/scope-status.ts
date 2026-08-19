export const SCOPE_THRESHOLDS = [80, 90, 100, 110] as const;

export type ScopeThreshold = (typeof SCOPE_THRESHOLDS)[number];

export type ScopeStatus =
  | "ON_TRACK"
  | "NEARING"
  | "AT_RISK"
  | "EXCEEDED"
  | "OVERRUN";

export const SCOPE_STATUS_OPTIONS: ReadonlyArray<{
  value: ScopeStatus;
  label: string;
}> = [
  { value: "ON_TRACK", label: "On track" },
  { value: "NEARING", label: "Nearing limit" },
  { value: "AT_RISK", label: "At risk" },
  { value: "EXCEEDED", label: "Scope exceeded" },
  { value: "OVERRUN", label: "Scope overrun" },
];

export function scopeStatusLabel(status: ScopeStatus): string {
  return (
    SCOPE_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

export function formatScopePercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

export function formatScopeHours(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} hrs`;
}

export const SCOPE_FILL_STYLES: Record<ScopeStatus, string> = {
  ON_TRACK: "bg-emerald-500",
  NEARING: "bg-amber-500",
  AT_RISK: "bg-orange-500",
  EXCEEDED: "bg-destructive",
  OVERRUN: "bg-destructive",
};
