import type { AlertSeverity } from "@/lib/alerts";

export type ActivityEventType =
  | "TIME"
  | "CLIENT_CREATED"
  | "CLIENT_UPDATED"
  | "RETAINER_CREATED"
  | "RETAINER_UPDATED"
  | "MEMBER_ADDED"
  | "MEMBER_UPDATED"
  | "ALERT_TRIGGERED"
  | "ALERT_RESOLVED"
  | "REPORT_GENERATED";

export const TIMELINE_PAGE_SIZE = 20;
export const TIMELINE_MAX_PAGE = 10;

export type TimelineFilters = {
  query: string;
  event: string;
  date: string;
  clientId: string;
  severity: string;
  page: number;
};

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  query: "",
  event: "ALL",
  date: "ALL",
  clientId: "ALL",
  severity: "ALL",
  page: 1,
};

export const TIMELINE_EVENT_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "ALL", label: "All events" },
  { value: "TIME", label: "Time logged" },
  { value: "CLIENT", label: "Clients" },
  { value: "RETAINER", label: "Retainers" },
  { value: "MEMBER", label: "Team" },
  { value: "ALERT", label: "Alerts" },
  { value: "REPORT", label: "Reports" },
];

export const TIMELINE_DATE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "ALL", label: "All time" },
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "Last 7 days" },
  { value: "30D", label: "Last 30 days" },
  { value: "MONTH", label: "This month" },
];

export const TIMELINE_SEVERITY_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "ALL", label: "All severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "WARNING", label: "Warning" },
  { value: "INFO", label: "Info" },
];

export function clampPage(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value, 1), TIMELINE_MAX_PAGE);
}

export function resolveSinceFilter(date: string, now: Date = new Date()): Date | null {
  switch (date) {
    case "TODAY": {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      return start;
    }
    case "7D":
      return new Date(now.getTime() - 7 * 86_400_000);
    case "30D":
      return new Date(now.getTime() - 30 * 86_400_000);
    case "MONTH":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    default:
      return null;
  }
}

export function eventTypesForFilter(filter: string): ActivityEventType[] {
  switch (filter) {
    case "TIME":
      return ["TIME"];
    case "CLIENT":
      return ["CLIENT_CREATED", "CLIENT_UPDATED"];
    case "RETAINER":
      return ["RETAINER_CREATED", "RETAINER_UPDATED"];
    case "MEMBER":
      return ["MEMBER_ADDED", "MEMBER_UPDATED"];
    case "ALERT":
      return ["ALERT_TRIGGERED", "ALERT_RESOLVED"];
    case "REPORT":
      return ["REPORT_GENERATED"];
    default:
      return [
        "TIME",
        "CLIENT_CREATED",
        "CLIENT_UPDATED",
        "RETAINER_CREATED",
        "RETAINER_UPDATED",
        "MEMBER_ADDED",
        "MEMBER_UPDATED",
        "ALERT_TRIGGERED",
        "ALERT_RESOLVED",
        "REPORT_GENERATED",
      ];
  }
}

export function parseSeverity(value: string | undefined): AlertSeverity | "ALL" {
  if (value === "CRITICAL" || value === "WARNING" || value === "INFO") {
    return value;
  }
  return "ALL";
}

export function isActivityEventType(
  value: string | undefined,
): value is ActivityEventType {
  if (!value || value === "ALL") return false;
  return TIMELINE_EVENT_OPTIONS.some(
    (option) => option.value !== "ALL" && option.value === value,
  );
}

export function isTimelineDate(
  value: string | undefined,
): value is string {
  if (!value || value === "ALL") return false;
  return TIMELINE_DATE_OPTIONS.some(
    (option) => option.value !== "ALL" && option.value === value,
  );
}
