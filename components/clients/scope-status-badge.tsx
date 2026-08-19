import { Badge } from "@/components/ui/badge";
import { scopeStatusLabel, type ScopeStatus } from "@/lib/scope-status";
import { cn } from "@/lib/utils";

const SCOPE_STATUS_STYLES: Record<ScopeStatus, string> = {
  ON_TRACK: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  NEARING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  AT_RISK: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  EXCEEDED: "bg-destructive/10 text-destructive",
  OVERRUN: "bg-destructive/10 text-destructive",
};

export function ScopeStatusBadge({
  status,
  className,
}: {
  status: ScopeStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        SCOPE_STATUS_STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {scopeStatusLabel(status)}
    </Badge>
  );
}
