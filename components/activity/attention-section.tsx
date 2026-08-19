import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleAlert,
  CircleCheckBig,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertSeverityBadge } from "@/components/alerts/alert-severity-badge";
import { AlertTypeBadge } from "@/components/alerts/alert-type-badge";
import { formatActivityTime, formatFullDateTime } from "@/lib/format";
import type { AttentionAlert } from "@/lib/activity";
import type { AlertSeverity } from "@/lib/alerts";
import { cn } from "@/lib/utils";

const SEVERITY_ICONS: Record<AlertSeverity, LucideIcon> = {
  CRITICAL: AlertTriangle,
  WARNING: CircleAlert,
  INFO: Info,
};

const SEVERITY_ICON_TONES: Record<AlertSeverity, string> = {
  CRITICAL: "bg-destructive/10 text-destructive",
  WARNING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  INFO: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const SEVERITY_ACCENT: Record<AlertSeverity, string> = {
  CRITICAL: "border-l-destructive/60",
  WARNING: "border-l-amber-500/60",
  INFO: "border-l-sky-500/60",
};

export function AttentionSection({
  alerts,
  count,
  canResolve,
  onResolve,
  onAddClient,
}: {
  alerts: AttentionAlert[];
  count: number;
  canResolve: boolean;
  onResolve: (alertId: string) => void;
  onAddClient: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="relative flex size-2">
            {alerts.length > 0 && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/40" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                alerts.length > 0 ? "bg-destructive" : "bg-emerald-500",
              )}
            />
          </span>
          Needs your attention
        </CardTitle>
        <CardDescription>
          Unresolved issues that could cost your agency money or time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <EmptyState
            icon={CircleCheckBig}
            title="You're all caught up."
            description="No active issues require your attention."
            className="py-12"
            action={
              <Button variant="outline" onClick={onAddClient}>
                Add a client
              </Button>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {alerts.map((alert) => {
                const SeverityIcon = SEVERITY_ICONS[alert.severity];
                return (
                  <li
                    key={alert.id}
                    className={cn(
                      "rounded-lg border border-l-2 bg-muted/20 p-4",
                      SEVERITY_ACCENT[alert.severity],
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg",
                            SEVERITY_ICON_TONES[alert.severity],
                          )}
                        >
                          <SeverityIcon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="text-sm font-medium text-foreground">
                              {alert.title}
                            </h3>
                            <AlertSeverityBadge severity={alert.severity} />
                          </div>
                          <Link
                            href={`/dashboard/clients/${alert.clientId}`}
                            className="mt-0.5 inline-block rounded-sm text-sm font-medium text-foreground/80 outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            {alert.clientName}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                            {alert.currentLabel && (
                              <span className="font-medium text-foreground tabular-nums">
                                {alert.currentLabel}
                              </span>
                            )}
                            {alert.thresholdLabel && (
                              <span className="text-muted-foreground">
                                · {alert.thresholdLabel}
                              </span>
                            )}
                            {alert.impactLabel && (
                              <span className="font-medium text-destructive">
                                {alert.impactLabel}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <AlertTypeBadge type={alert.type} />
                            <time
                              dateTime={alert.createdAt.toISOString()}
                              title={formatFullDateTime(alert.createdAt)}
                              className="text-xs text-muted-foreground"
                            >
                              {formatActivityTime(alert.createdAt)}
                            </time>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                        <ButtonLink href={`/dashboard/clients/${alert.clientId}`} variant="ghost" size="sm" className="h-7 text-xs">
                          View client
                          <ArrowRight />
                        </ButtonLink>
                        {canResolve && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onResolve(alert.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {count > alerts.length && (
              <div className="mt-4">
                <Link
                  href="/dashboard/alerts"
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  View all {count} open issues
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
