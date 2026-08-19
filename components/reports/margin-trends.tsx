"use client";

import { useCallback, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";

import { getMarginTrendsForRange } from "@/app/(app)/reports/actions";
import { MarginTrendChart } from "@/components/clients/margin-trend-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_MARGIN_TREND_RANGE,
  type MarginTrendRange,
} from "@/lib/margin-trend-ranges";
import type { MarginTrendsData } from "@/lib/margins";

const ALL_CLIENTS = "ALL";

export function MarginTrends({ initialData }: { initialData: MarginTrendsData }) {
  const [range, setRange] = useState<MarginTrendRange>(
    DEFAULT_MARGIN_TREND_RANGE,
  );
  const [data, setData] = useState<MarginTrendsData>(initialData);
  const [clientId, setClientId] = useState<string>(ALL_CLIENTS);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = useCallback(
    async (next: MarginTrendRange) => {
      if (next === range) return;
      setRange(next);
      setError(null);
      const result = await getMarginTrendsForRange(next);
      if (result.ok) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    },
    [range],
  );

  const clientOptions = useMemo(() => {
    const items: Record<string, string> = { [ALL_CLIENTS]: "All clients" };
    for (const client of data.clients) {
      items[client.id] = client.name;
    }
    return items;
  }, [data.clients]);

  const selected =
    clientId === ALL_CLIENTS
      ? { months: data.allMonths, currency: data.currency }
      : data.clients.find((client) => client.id === clientId) ?? {
          months: [],
          currency: data.currency,
        };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            Historical margin trends
          </CardTitle>
          <CardDescription>
            Revenue, cost, profit, and margin % over time for the selected
            client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={clientId}
            onValueChange={(value) => setClientId(value ?? ALL_CLIENTS)}
            items={clientOptions}
          >
            <SelectTrigger
              aria-label="Filter by client"
              className="w-full sm:w-[220px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value={ALL_CLIENTS}>All clients</SelectItem>
              {data.clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <MarginTrendChart
        months={selected.months}
        currency={selected.currency}
        range={range}
        onRangeChange={handleRangeChange}
      />
    </div>
  );
}