"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, FileText, Loader2, Plus } from "lucide-react";
import { downloadReportPdf } from "@/app/(app)/dashboard/reports/actions";
import type { RecentReportRow } from "@/lib/activity";
import { formatActivityTime, formatFullDateTime, reportMonthLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function RecentReports({
  reports,
  onGenerate,
}: {
  reports: RecentReportRow[];
  onGenerate: () => void;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function runDownload(report: RecentReportRow) {
    if (downloadingId) return;
    setDownloadingId(report.id);
    try {
      const result = await downloadReportPdf(report.id);
      if (result.ok) {
        const { downloadClientPdf } = await import(
          "@/lib/pdf-report-generator"
        );
        downloadClientPdf(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Couldn't download the report.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="size-4 text-muted-foreground" />
          Recent reports
        </CardTitle>
        <CardDescription>Monthly snapshots you generated.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            description="Generate a report for a client and it will show up here."
            className="py-10"
            action={
              <Button variant="outline" onClick={onGenerate}>
                <Plus />
                Generate report
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col">
            {reports.map((report, index) => (
              <li
                key={report.id}
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  index > 0 && "border-t border-border",
                )}
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/clients/${report.clientId}`}
                    className="block truncate rounded-sm text-sm font-medium text-foreground outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {report.clientName}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {reportMonthLabel(report.reportMonth)} ·{" "}
                    <time
                      dateTime={report.generatedAt.toISOString()}
                      title={formatFullDateTime(report.generatedAt)}
                    >
                      {formatActivityTime(report.generatedAt)}
                    </time>
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium tabular-nums",
                    report.marginPercent < 0
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  {report.marginPercent.toFixed(1)}% margin
                </span>
                <button
                  type="button"
                  onClick={() => runDownload(report)}
                  aria-label={`Download ${report.clientName} report`}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {downloadingId === report.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
