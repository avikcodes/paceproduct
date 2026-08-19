import type { AlertType, AlertSeverity } from "@/lib/generated/prisma/enums";
import type { AlertGetPayload } from "@/lib/generated/prisma/models";

export type { AlertType, AlertSeverity };

export type AlertRow = {
  id: string;
  clientId: string;
  clientName: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  isRead: boolean;
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
};

export const alertSelect = {
  id: true,
  clientId: true,
  client: { select: { id: true, name: true } },
  type: true,
  severity: true,
  title: true,
  description: true,
  isRead: true,
  isResolved: true,
  resolvedAt: true,
  createdAt: true,
} as const;

export type AlertWithClient = AlertGetPayload<{ select: typeof alertSelect }>;

export function toAlertRow(row: AlertWithClient): AlertRow {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client.name,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    isRead: row.isRead,
    isResolved: row.isResolved,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

export const ALERT_TYPE_OPTIONS: ReadonlyArray<{
  value: AlertType;
  label: string;
}> = [
  { value: "MARGIN", label: "Margin" },
  { value: "BUDGET", label: "Budget" },
  { value: "SCOPE", label: "Scope" },
];

export const ALERT_SEVERITY_OPTIONS: ReadonlyArray<{
  value: AlertSeverity;
  label: string;
}> = [
  { value: "INFO", label: "Info" },
  { value: "WARNING", label: "Warning" },
  { value: "CRITICAL", label: "Critical" },
];

export function alertTypeLabel(type: AlertType): string {
  return (
    ALERT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
  );
}

export function alertSeverityLabel(severity: AlertSeverity): string {
  return (
    ALERT_SEVERITY_OPTIONS.find((option) => option.value === severity)?.label ??
    severity
  );
}
