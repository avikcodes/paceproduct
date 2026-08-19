import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  iconClassName,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  iconClassName?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card size="sm" className="relative overflow-hidden">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
          <div
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              iconClassName ?? "bg-muted/50 text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <span
          className={cn(
            "truncate text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-[1.75rem]",
            tone === "positive"
              ? "text-emerald-600 dark:text-emerald-400"
              : tone === "negative"
                ? "text-destructive"
                : undefined,
          )}
        >
          {value}
        </span>
        {caption && (
          <span className="text-xs text-muted-foreground">{caption}</span>
        )}
      </CardContent>
    </Card>
  );
}
