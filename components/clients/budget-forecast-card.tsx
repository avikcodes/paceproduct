import {
  AlertTriangle,
  CalendarDays,
  Flame,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { BudgetForecast, BudgetStatus } from "@/lib/budget";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/retainers";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<BudgetStatus, string> = {
  ON_TRACK: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  AT_RISK: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  OVER: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<BudgetStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OVER: "Over budget",
};

function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        STATUS_STYLES[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

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

export function BudgetForecastCard({
  forecast,
}: {
  forecast: BudgetForecast | null;
}) {
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date());

  const isOver = forecast
    ? forecast.currentSpend >= forecast.monthlyBudget
    : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="size-4 text-muted-foreground" />
          Budget burn forecast
        </CardTitle>
        {forecast && (
          <>
            <CardDescription>
              Projected spend for {monthLabel}
            </CardDescription>
            <CardAction>
              <BudgetStatusBadge status={forecast.status} />
            </CardAction>
          </>
        )}
      </CardHeader>
      <CardContent>
        {forecast ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <Tile
              label="Current budget"
              value={formatMoney(forecast.monthlyBudget, forecast.currency)}
              icon={<Wallet className="size-3.5 text-muted-foreground" />}
            />
            <Tile
              label="Forecast budget"
              value={formatMoney(forecast.estimatedMonthSpend, forecast.currency)}
              icon={<TrendingUp className="size-3.5 text-muted-foreground" />}
              tone={
                forecast.estimatedMonthSpend > forecast.monthlyBudget
                  ? "negative"
                  : undefined
              }
            />
            <Tile
              label="Remaining budget"
              value={formatMoney(forecast.remainingBudget, forecast.currency)}
              icon={<PiggyBank className="size-3.5 text-muted-foreground" />}
              tone={
                forecast.remainingBudget < 0
                  ? "negative"
                  : forecast.remainingBudget > 0
                    ? "positive"
                    : undefined
              }
            />
            <Tile
              label="Projected overrun"
              value={formatMoney(forecast.projectedOverrun, forecast.currency)}
              icon={<AlertTriangle className="size-3.5 text-muted-foreground" />}
              tone={forecast.projectedOverrun > 0 ? "negative" : undefined}
            />
            <Tile
              label="Expected date"
              value={
                forecast.overrunDate
                  ? formatDate(forecast.overrunDate)
                  : isOver
                    ? "Already over"
                    : "—"
              }
              icon={<CalendarDays className="size-3.5 text-muted-foreground" />}
              tone={forecast.overrunDate ? "negative" : undefined}
            />
          </div>
        ) : (
          <EmptyState
            className="py-8"
            icon={Wallet}
            title="No budget to forecast"
            description="Set up an active retainer to track budget burn against a monthly budget."
          />
        )}
      </CardContent>
    </Card>
  );
}
