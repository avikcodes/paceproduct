import { Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { marginStatusLabel } from "@/lib/margin-status";
import type { ProfitabilityBadge } from "@/lib/profitability";
import { cn } from "@/lib/utils";

const BADGE_LABELS: Record<ProfitabilityBadge, string> = {
  TOP_PERFORMER: "Top Performer",
  HEALTHY: marginStatusLabel("HEALTHY"),
  WARNING: marginStatusLabel("WARNING"),
  CRITICAL: marginStatusLabel("CRITICAL"),
};

const BADGE_STYLES: Record<ProfitabilityBadge, string> = {
  TOP_PERFORMER: "bg-emerald-600 text-white",
  HEALTHY: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  WARNING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CRITICAL: "bg-destructive/10 text-destructive",
};

export function ProfitabilityBadge({
  badge,
  className,
}: {
  badge: ProfitabilityBadge;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        BADGE_STYLES[badge],
        className,
      )}
    >
      {badge === "TOP_PERFORMER" ? (
        <Trophy className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {BADGE_LABELS[badge]}
    </Badge>
  );
}
