import { Pencil, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPercent, type MarginThresholds } from "@/lib/margin-status";
import { cn } from "@/lib/utils";

const THRESHOLD_ITEMS: ReadonlyArray<{
  key: keyof MarginThresholds;
  label: string;
  dot: string;
}> = [
  { key: "healthy", label: "Healthy", dot: "bg-emerald-500" },
  { key: "warning", label: "Warning", dot: "bg-amber-500" },
  { key: "critical", label: "Critical", dot: "bg-destructive" },
];

export function MarginThresholdsCard({
  thresholds,
  onEdit,
  canEdit,
}: {
  thresholds: MarginThresholds;
  onEdit: () => void;
  canEdit: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          Margin thresholds
        </CardTitle>
        <CardDescription>
          Status bands used to classify this client&apos;s margin.
        </CardDescription>
        {canEdit && (
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Edit margin thresholds"
              onClick={onEdit}
            >
              <Pencil />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {THRESHOLD_ITEMS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span
                  className={cn("size-2 rounded-full", item.dot)}
                  aria-hidden="true"
                />
                {item.label}
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {formatPercent(thresholds[item.key])}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
