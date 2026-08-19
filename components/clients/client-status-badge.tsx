import { Badge } from "@/components/ui/badge";
import { clientStatusLabel } from "@/lib/clients";
import type { ClientStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

const STATUS_BADGE_STYLES: Record<ClientStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  PAUSED: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        STATUS_BADGE_STYLES[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {clientStatusLabel(status)}
    </Badge>
  );
}
