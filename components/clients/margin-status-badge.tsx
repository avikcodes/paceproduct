import { Badge } from "@/components/ui/badge";
import { marginStatusLabel, type MarginStatus } from "@/lib/margin-status";
import { cn } from "@/lib/utils";

const MARGIN_STATUS_STYLES: Record<MarginStatus, string> = {
  HEALTHY: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  WARNING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CRITICAL: "bg-destructive/10 text-destructive",
};

export function MarginStatusBadge({
  status,
  className,
}: {
  status: MarginStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        MARGIN_STATUS_STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {marginStatusLabel(status)}
    </Badge>
  );
}
