import type { ScopeUsage } from "@/lib/scope";
import {
  SCOPE_FILL_STYLES,
  formatScopePercent,
} from "@/lib/scope-status";
import { cn } from "@/lib/utils";

export function ScopeProgress({
  usage,
  className,
}: {
  usage: ScopeUsage;
  className?: string;
}) {
  const fillPercent = Math.min(100, usage.percentUsed);

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="relative h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            SCOPE_FILL_STYLES[usage.status],
          )}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {formatScopePercent(usage.percentUsed)}
      </span>
    </div>
  );
}
