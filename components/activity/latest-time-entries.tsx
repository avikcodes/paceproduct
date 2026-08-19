"use client";

import Link from "next/link";
import { ArrowRight, Plus, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SourceBadge } from "@/components/time/source-badge";
import { formatHours, formatWorkDate, type TimeEntryRow } from "@/lib/time";
import { cn } from "@/lib/utils";

export function LatestTimeEntries({
  entries,
  onLogTime,
}: {
  entries: TimeEntryRow[];
  onLogTime: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Timer className="size-4 text-muted-foreground" />
          Latest time entries
        </CardTitle>
        <CardDescription>Most recently logged hours.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {entries.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No time logged"
            description="Log billable hours for a client to see them here."
            className="py-10"
            action={
              <Button variant="outline" onClick={onLogTime}>
                <Plus />
                Log time
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col">
            {entries.map((entry, index) => (
              <li
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  index > 0 && "border-t border-border",
                )}
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                  <Timer className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {entry.memberName}
                  </p>
                  <Link
                    href={`/dashboard/clients/${entry.clientId}`}
                    className="block truncate rounded-sm text-xs text-muted-foreground outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {entry.clientName} · {entry.task}
                  </Link>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatHours(entry.hours)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {formatWorkDate(entry.workDate)}
                    </span>
                    <SourceBadge source={entry.source} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <div className="border-t border-border px-4 py-2.5">
        <Link
          href="/dashboard/time"
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          View all time entries
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
