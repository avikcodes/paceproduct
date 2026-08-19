import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BudgetStatus } from "@/lib/budget";

const BURN_STATUS_STYLES: Record<BudgetStatus, string> = {
  ON_TRACK: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  AT_RISK: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  OVER: "bg-destructive/10 text-destructive",
};

const BURN_STATUS_LABELS: Record<BudgetStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OVER: "Over budget",
};

export function BurnStatusBadge({
  status,
  className,
}: {
  status: BudgetStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        BURN_STATUS_STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {BURN_STATUS_LABELS[status]}
    </Badge>
  );
}

export function burnStatusLabel(status: BudgetStatus): string {
  return BURN_STATUS_LABELS[status];
}
