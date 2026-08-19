"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  TIMELINE_EVENT_OPTIONS,
  TIMELINE_DATE_OPTIONS,
  TIMELINE_SEVERITY_OPTIONS,
  type TimelineFilters,
} from "@/lib/activity-filters";
import type { ClientOption } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function timelineHref(
  pathname: string,
  filters: TimelineFilters,
): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.event !== "ALL") params.set("event", filters.event);
  if (filters.date !== "ALL") params.set("date", filters.date);
  if (filters.clientId !== "ALL") params.set("client", filters.clientId);
  if (filters.severity !== "ALL") params.set("severity", filters.severity);
  if (filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

const EVENT_ITEMS = Object.fromEntries(
  TIMELINE_EVENT_OPTIONS.map((option) => [option.value, option.label]),
);
const DATE_ITEMS = Object.fromEntries(
  TIMELINE_DATE_OPTIONS.map((option) => [option.value, option.label]),
);
const SEVERITY_ITEMS = Object.fromEntries(
  TIMELINE_SEVERITY_OPTIONS.map((option) => [option.value, option.label]),
);

function hasActiveFilters(filters: TimelineFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.event !== "ALL" ||
    filters.date !== "ALL" ||
    filters.clientId !== "ALL" ||
    filters.severity !== "ALL"
  );
}

export function ActivityFiltersBar({
  filters,
  clients,
}: {
  filters: TimelineFilters;
  clients: ClientOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(filters.query);

  function go(patch: Partial<TimelineFilters>) {
    const next: TimelineFilters = {
      ...filters,
      ...patch,
      page: patch.page ?? 1,
    };
    router.push(timelineHref(pathname, next));
  }

  const active = hasActiveFilters(filters);
  const clientItems = Object.fromEntries(
    clients.map((client) => [client.id, client.name]),
  );

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <form
        className="relative flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          const value = query.trim();
          if (value === filters.query) return;
          go({ query: value });
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search activity…"
          aria-label="Search activity"
          className="pl-8"
        />
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.event}
          onValueChange={(value) => go({ event: value ?? "ALL" })}
          items={EVENT_ITEMS}
        >
          <SelectTrigger
            aria-label="Filter by event type"
            className="w-full sm:w-[150px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {TIMELINE_EVENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.date}
          onValueChange={(value) => go({ date: value ?? "ALL" })}
          items={DATE_ITEMS}
        >
          <SelectTrigger
            aria-label="Filter by date"
            className="w-full sm:w-[150px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {TIMELINE_DATE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.clientId}
          onValueChange={(value) => go({ clientId: value ?? "ALL" })}
          items={clientItems}
        >
          <SelectTrigger
            aria-label="Filter by client"
            className="w-full sm:w-[170px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="ALL">All clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.severity}
          onValueChange={(value) => go({ severity: value ?? "ALL" })}
          items={SEVERITY_ITEMS}
        >
          <SelectTrigger
            aria-label="Filter by severity"
            className="w-full sm:w-[150px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {TIMELINE_SEVERITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              go({
                query: "",
                event: "ALL",
                date: "ALL",
                clientId: "ALL",
                severity: "ALL",
              })
            }
            className={cn("h-7 text-xs text-muted-foreground")}
          >
            <X />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
