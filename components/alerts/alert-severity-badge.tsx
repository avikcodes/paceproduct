import { Badge } from "@/components/ui/badge";
import { alertSeverityLabel, type AlertSeverity } from "@/lib/alerts";
import { cn } from "@/lib/utils";

const ALERT_SEVERITY_STYLES: Record<AlertSeverity, string> = {
  INFO: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  WARNING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CRITICAL: "bg-destructive/10 text-destructive",
};

export function AlertSeverityBadge({
  severity,
  className,
}: {
  severity: AlertSeverity;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        ALERT_SEVERITY_STYLES[severity],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {alertSeverityLabel(severity)}
    </Badge>
  );
}
