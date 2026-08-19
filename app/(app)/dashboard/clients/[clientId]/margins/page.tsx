import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  Clock,
  Gauge,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import {
  getClientMarginDetails,
  type MarginSummary,
  type MonthlyMarginRow,
} from "@/lib/margins";
import { formatMoney } from "@/lib/retainers";
import { formatPercent } from "@/lib/margin-status";
import { formatHours } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MarginStatusBadge } from "@/components/clients/margin-status-badge";
import { MarginTrendChart } from "@/components/clients/margin-trend-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { clientId } = await params;
  const workspace = await requireCapability("viewClients");

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.workspaceId },
    select: { name: true },
  });

  if (!client) {
    return { title: "Margin details" };
  }

  return {
    title: `${client.name} — Margin details`,
    description: `Monthly margin breakdown for ${client.name}.`,
  };
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {icon}
          {label}
        </span>
        <span
          className={cn(
            "truncate text-xl leading-snug font-semibold sm:text-2xl",
            tone === "negative"
              ? "text-destructive"
              : tone === "positive"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground",
          )}
        >
          {value}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

function formatMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function SummaryGrid({
  summary,
  totalHours,
  effectiveHourlyRate,
}: {
  summary: MarginSummary;
  totalHours: number;
  effectiveHourlyRate: number;
}) {
  const { revenue, cost, profit, marginPercent, currency } = summary;

  return (
    <section
      className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6"
      aria-label="Margin summary"
    >
      <StatCard
        label="Revenue"
        value={formatMoney(revenue, currency)}
        icon={<Wallet className="size-3.5" />}
      />
      <StatCard
        label="Cost"
        value={formatMoney(cost, currency)}
        icon={<TrendingDown className="size-3.5" />}
      />
      <StatCard
        label="Profit"
        value={formatMoney(profit, currency)}
        icon={<TrendingUp className="size-3.5" />}
        tone={profit < 0 ? "negative" : profit > 0 ? "positive" : undefined}
      />
      <StatCard
        label="Margin %"
        value={formatPercent(marginPercent)}
        icon={<Percent className="size-3.5" />}
        tone={marginPercent < 0 ? "negative" : marginPercent > 0 ? "positive" : undefined}
      />
      <StatCard
        label="Total hours"
        value={formatHours(totalHours)}
        icon={<Clock className="size-3.5" />}
      />
      <StatCard
        label="Effective rate"
        value={formatMoney(effectiveHourlyRate, currency)}
        hint="Revenue per hour"
        icon={<Gauge className="size-3.5" />}
      />
    </section>
  );
}

function MonthlyBreakdownCard({
  months,
  currency,
}: {
  months: MonthlyMarginRow[];
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" />
          Monthly breakdown
        </CardTitle>
        <CardDescription>
          Revenue, cost, and profit for each month with logged time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No monthly data yet"
            description="Log time entries for this client to see the monthly margin breakdown."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month) => (
                  <TableRow key={month.key}>
                    <TableCell className="font-medium text-foreground">
                      {formatMonthLabel(month.year, month.month)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(month.revenue, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(month.cost, currency)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        month.profit < 0
                          ? "text-destructive"
                          : month.profit > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-foreground",
                      )}
                    >
                      {formatMoney(month.profit, currency)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        month.marginPercent < 0
                          ? "text-destructive"
                          : month.marginPercent > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-foreground",
                      )}
                    >
                      {formatPercent(month.marginPercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function ClientMarginDetailsPage({ params }: PageProps) {
  const { clientId } = await params;
  const workspace = await requireCapability("viewClients");

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.workspaceId },
    select: { id: true, name: true, company: true },
  });

  if (!client) {
    notFound();
  }

  const details = await getClientMarginDetails(client.id, workspace.workspaceId);

  return (
    <div className="flex animate-in flex-col gap-6 fade-in-0 duration-200">
      <Link
        href={`/dashboard/clients/${client.id}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft className="size-4" />
        Back to client
      </Link>

      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Margin details</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {client.name}
          </h1>
          <MarginStatusBadge status={details.summary.status} />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {client.company
            ? `Monthly margin breakdown for ${client.company}.`
            : "Monthly margin breakdown for this client."}
        </p>
      </section>

      <SummaryGrid
        summary={details.summary}
        totalHours={details.totalHours}
        effectiveHourlyRate={details.effectiveHourlyRate}
      />

      <MarginTrendChart
        months={details.months}
        currency={details.currency}
      />

      <MonthlyBreakdownCard
        months={details.months}
        currency={details.currency}
      />
    </div>
  );
}
