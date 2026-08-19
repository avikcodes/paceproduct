"use client";

import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type HarvestImportHistoryRow = {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

type HarvestImportHistoryProps = {
  imports: HarvestImportHistoryRow[];
};

function statusBadge(status: string) {
  if (status === "SUCCESS") {
    return <Badge variant="outline">Success</Badge>;
  }
  if (status === "PARTIAL") {
    return <Badge variant="secondary">Partial</Badge>;
  }
  if (status === "RUNNING") {
    return <Badge variant="secondary">Running</Badge>;
  }
  return <Badge variant="destructive">Failed</Badge>;
}

function formatRange(row: HarvestImportHistoryRow): string {
  const start = row.startDate?.slice(0, 10) ?? "—";
  const end = row.endDate?.slice(0, 10) ?? "—";
  return start === end ? start : `${start} → ${end}`;
}

export function HarvestImportHistory({
  imports,
}: HarvestImportHistoryProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-medium text-foreground">Sync history</h2>

      {imports.length === 0 ? (
        <EmptyState
          icon={History}
          title="No syncs yet"
          description="Your Harvest imports will show up here with their status and results."
        />
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Date range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Imported</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">
                    {formatRange(row)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {statusBadge(row.status)}
                      {row.error && (
                        <span
                          className="line-clamp-2 max-w-[220px] text-xs text-muted-foreground"
                          title={row.error}
                        >
                          {row.error}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {row.importedCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.skippedCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(row.startedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
