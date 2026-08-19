import { Percent, Wallet, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { alertTypeLabel, type AlertType } from "@/lib/alerts";
import { cn } from "@/lib/utils";

const ALERT_TYPE_STYLES: Record<AlertType, { icon: typeof Percent; className: string }> = {
  MARGIN: {
    icon: Percent,
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  BUDGET: {
    icon: Wallet,
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  SCOPE: {
    icon: Target,
    className: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  },
};

export function AlertTypeBadge({
  type,
  className,
}: {
  type: AlertType;
  className?: string;
}) {
  const { icon: Icon, className: tone } = ALERT_TYPE_STYLES[type];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        tone,
        className,
      )}
    >
      <Icon className="size-3" />
      {alertTypeLabel(type)}
    </Badge>
  );
}
