import Link from "next/link";
import {
  Activity,
  CircleCheck,
  FileText,
  Pencil,
  Timer,
  UserCog,
  UserPlus,
  Wallet,
  AlertTriangle,
  CircleAlert,
  Info,
  ArrowDown,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertSeverityBadge } from "@/components/alerts/alert-severity-badge";
import {
  formatActivityTime,
  formatFullDateTime,
} from "@/lib/format";
import type { ActivityEvent, TimelineResult } from "@/lib/activity";
import type { TimelineFilters } from "@/lib/activity-filters";
import type { ClientOption } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  ActivityFiltersBar,
  timelineHref,
} from "@/components/activity/activity-filters-bar";

type EventStyle = {
  icon: LucideIcon;
  tone: string;
};

function eventStyle(event: ActivityEvent): EventStyle {
  switch (event.type) {
    case "TIME":
      return { icon: Timer, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
    case "CLIENT_CREATED":
      return { icon: UserPlus, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };
    case "CLIENT_UPDATED":
      return { icon: Pencil, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };
    case "RETAINER_CREATED":
    case "RETAINER_UPDATED":
      return { icon: Wallet, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
    case "MEMBER_ADDED":
      return { icon: UserPlus, tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400" };
    case "MEMBER_UPDATED":
      return { icon: UserCog, tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400" };
    case "ALERT_RESOLVED":
      return { icon: CircleCheck, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    case "ALERT_TRIGGERED": {
      if (event.severity === "CRITICAL") {
        return { icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" };
      }
      if (event.severity === "WARNING") {
        return {
          icon: CircleAlert,
          tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        };
      }
      return { icon: Info, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };
    }
    case "REPORT_GENERATED":
      return { icon: FileText, tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" };
    default:
      return { icon: Activity, tone: "bg-muted text-muted-foreground" };
  }
}

export function ActivityTimeline({
  timeline,
  filters,
  clients,
}: {
  timeline: TimelineResult;
  filters: TimelineFilters;
  clients: ClientOption[];
}) {
  const { events, page, pageSize, total, hasMore } = timeline;
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);

  const prevHref = timelineHref("/dashboard/activity", {
    ...filters,
    page: Math.max(1, page - 1),
  });
  const nextHref = timelineHref("/dashboard/activity", {
    ...filters,
    page: page + 1,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Recent activity
        </CardTitle>
        <CardDescription>
          What changed across your workspace, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActivityFiltersBar
          key={[
            filters.query,
            filters.event,
            filters.date,
            filters.clientId,
            filters.severity,
            filters.page,
          ].join(":")}
          filters={filters}
          clients={clients}
        />

        {events.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Your team's actions will appear here as your workspace becomes active."
            className="py-12"
          />
        ) : (
          <div className="flex flex-col gap-1">
            <ol className="relative flex flex-col">
              <span
                aria-hidden
                className="absolute top-2 bottom-2 left-[15px] w-px bg-border"
              />
              {events.map((event) => {
                const { icon: Icon, tone } = eventStyle(event);
                return (
                  <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                    <span
                      className={cn(
                        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background",
                        tone,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {event.title}
                        </p>
                        {event.type === "ALERT_TRIGGERED" &&
                          event.severity && (
                            <AlertSeverityBadge severity={event.severity} />
                          )}
                      </div>
                      {event.detail && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {event.clientId ? (
                            <>
                              <Link
                                href={`/dashboard/clients/${event.clientId}`}
                                className="rounded-sm font-medium text-foreground/80 outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                              >
                                {event.clientName}
                              </Link>
                              <span aria-hidden> · </span>
                            </>
                          ) : null}
                          {event.detail}
                        </p>
                      )}
                    </div>
                    <time
                      dateTime={event.at.toISOString()}
                      title={formatFullDateTime(event.at)}
                      className="shrink-0 pt-1 text-xs whitespace-nowrap text-muted-foreground"
                    >
                      {formatActivityTime(event.at)}
                    </time>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {startIndex}–{endIndex} of {total}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <ButtonLink href={prevHref} variant="outline" size="sm">
                  <ArrowUp />
                  Newer
                </ButtonLink>
              ) : null}
              {hasMore ? (
                <ButtonLink href={nextHref} variant="outline" size="sm">
                  Older
                  <ArrowDown />
                </ButtonLink>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
