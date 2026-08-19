import Link from "next/link";
import {
  ArrowRight,
  Gauge,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarginStatusBadge } from "@/components/clients/margin-status-badge";
import type { MarginSummary } from "@/lib/margins";
import { formatPercent } from "@/lib/margin-status";
import { formatMoney } from "@/lib/retainers";
import { cn } from "@/lib/utils";

function TileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function Tile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5">
        {icon}
        <TileLabel>{label}</TileLabel>
      </span>
      <span
        className={cn(
          "truncate text-lg leading-snug font-semibold",
          tone === "negative"
            ? "text-destructive"
            : tone === "positive"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ThresholdsCaption({ margin }: { margin: MarginSummary }) {
  const { healthy, warning } = margin.thresholds;
  return (
    <CardDescription>
      Healthy ≥ {formatPercent(healthy)} · Warning {formatPercent(warning)}–
      {formatPercent(healthy)} · Critical &lt; {formatPercent(warning)}
    </CardDescription>
  );
}

export function ClientMarginSummaryCard({
  clientId,
  margin,
}: {
  clientId: string;
  margin: MarginSummary;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" />
          Client margin
        </CardTitle>
        <ThresholdsCaption margin={margin} />
        <CardAction>
          <MarginStatusBadge status={margin.status} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <Tile
            label="Revenue"
            value={formatMoney(margin.revenue, margin.currency)}
            icon={<Wallet className="size-3.5 text-muted-foreground" />}
          />
          <Tile
            label="Cost"
            value={formatMoney(margin.cost, margin.currency)}
            icon={<TrendingDown className="size-3.5 text-muted-foreground" />}
          />
          <Tile
            label="Profit"
            value={formatMoney(margin.profit, margin.currency)}
            icon={<TrendingUp className="size-3.5 text-muted-foreground" />}
            tone={margin.profit < 0 ? "negative" : margin.profit > 0 ? "positive" : undefined}
          />
          <Tile
            label="Margin %"
            value={formatPercent(margin.marginPercent)}
            icon={<Percent className="size-3.5 text-muted-foreground" />}
            tone={
              margin.marginPercent < 0
                ? "negative"
                : margin.marginPercent > 0
                  ? "positive"
                  : undefined
            }
          />
        </div>
      </CardContent>
      <CardFooter>
        <Link
          href={`/dashboard/clients/${clientId}/margins`}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          View margin details
          <ArrowRight className="size-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}
