import { Gauge, Hourglass, Percent, Scale, Timer } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScopeStatusBadge } from "@/components/clients/scope-status-badge";
import type { ScopeUsage } from "@/lib/scope";
import {
  SCOPE_THRESHOLDS,
  SCOPE_FILL_STYLES,
  formatScopeHours,
  formatScopePercent,
} from "@/lib/scope-status";
import { cn } from "@/lib/utils";

const VISIBLE_MARKERS = SCOPE_THRESHOLDS.filter((threshold) => threshold <= 100);

function TileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function Tile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5">
        {icon}
        <TileLabel>{label}</TileLabel>
      </span>
      <span
        className={cn(
          "truncate text-lg leading-snug font-semibold",
          tone === "negative"
            ? "text-destructive"
            : tone === "positive"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ScopeProgressBar({ usage }: { usage: ScopeUsage }) {
  const fillPercent = Math.min(100, usage.percentUsed);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative h-2.5 w-full overflow-visible rounded-full bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
            SCOPE_FILL_STYLES[usage.status],
          )}
          style={{ width: `${fillPercent}%` }}
        />
        {VISIBLE_MARKERS.map((threshold) => (
          <span
            key={threshold}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-background/70"
            style={{ left: `${threshold}%` }}
          />
        ))}
      </div>
      <div className="relative h-4 text-[11px] leading-4 font-medium text-muted-foreground tabular-nums">
        {VISIBLE_MARKERS.map((threshold) => (
          <span
            key={threshold}
            className="absolute -translate-x-1/2"
            style={{ left: `${threshold}%` }}
          >
            {threshold}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function ScopeUsageCard({ usage }: { usage: ScopeUsage | null }) {
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" />
          Scope usage
        </CardTitle>
        {usage && (
          <>
            <CardDescription>
              Logged hours vs monthly scope for {monthLabel}
            </CardDescription>
            <CardAction>
              <ScopeStatusBadge status={usage.status} />
            </CardAction>
          </>
        )}
      </CardHeader>
      <CardContent>
        {usage ? (
          <div className="flex flex-col gap-6">
            <ScopeProgressBar usage={usage} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <Tile
                label="Hours used"
                value={formatScopeHours(usage.loggedHours)}
                icon={<Timer className="size-3.5 text-muted-foreground" />}
              />
              <Tile
                label="Hours remaining"
                value={formatScopeHours(usage.remainingHours)}
                icon={<Hourglass className="size-3.5 text-muted-foreground" />}
                tone={
                  usage.remainingHours < 0
                    ? "negative"
                    : usage.remainingHours > 0
                      ? "positive"
                      : undefined
                }
              />
              <Tile
                label="Monthly scope"
                value={formatScopeHours(usage.scopeHours)}
                icon={<Scale className="size-3.5 text-muted-foreground" />}
              />
              <Tile
                label="Percentage used"
                value={formatScopePercent(usage.percentUsed)}
                icon={<Percent className="size-3.5 text-muted-foreground" />}
                tone={
                  usage.percentUsed >= 100
                    ? "negative"
                    : usage.percentUsed >= 80
                      ? undefined
                      : "positive"
                }
              />
            </div>
          </div>
        ) : (
          <EmptyState
            className="py-8"
            icon={Gauge}
            title="No scope to track"
            description="Set up an active retainer with scope hours to compare logged hours against a monthly scope."
          />
        )}
      </CardContent>
    </Card>
  );
}
