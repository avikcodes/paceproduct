import { Badge } from "@/components/ui/badge";
import { sourceLabel } from "@/lib/time";
import type { TimeEntrySource } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

const SOURCE_BADGE_STYLES: Record<TimeEntrySource, string> = {
  MANUAL: "bg-muted text-muted-foreground",
  CSV: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  TOGGL: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  HARVEST: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export function SourceBadge({ source }: { source: TimeEntrySource }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        SOURCE_BADGE_STYLES[source],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {sourceLabel(source)}
    </Badge>
  );
}
