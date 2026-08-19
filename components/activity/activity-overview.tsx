"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Timer } from "lucide-react";
import { resolveAlert } from "@/app/(app)/dashboard/alerts/actions";
import type { ActivityData } from "@/lib/activity";
import type { TimelineFilters } from "@/lib/activity-filters";
import { AttentionSection } from "@/components/activity/attention-section";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { AlertsPanel } from "@/components/activity/alerts-panel";
import { RecentReports } from "@/components/activity/recent-reports";
import { LatestTimeEntries } from "@/components/activity/latest-time-entries";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { GenerateReportDialog } from "@/components/reports/generate-report-dialog";
import { TimeEntryFormDialog } from "@/components/time/time-entry-form-dialog";
import { Button } from "@/components/ui/button";

export type ActivityCapabilities = {
  manageClients: boolean;
  addTime: boolean;
  manageReports: boolean;
  viewReports: boolean;
};

export function ActivityOverview({
  data,
  filters,
  capabilities,
}: {
  data: ActivityData;
  filters: TimelineFilters;
  capabilities: ActivityCapabilities;
}) {
  const [clients, setClients] = useState(data.clients);
  const [members] = useState(data.members);
  const [reportableMonths] = useState(data.reportableMonths);
  const [reports, setReports] = useState(data.reports);
  const [timeEntries, setTimeEntries] = useState(data.timeEntries);
  const [attention, setAttention] = useState(data.attention);
  const [attentionCount, setAttentionCount] = useState(data.attentionCount);
  const [alertPanel, setAlertPanel] = useState(data.alertPanel);

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [pendingResolveId, setPendingResolveId] = useState<string | null>(null);

  const hasClients = clients.length > 0;
  const canLogTime = hasClients && members.length > 0;
  const canGenerateReport = hasClients && reportableMonths.length > 0;

  function prependReport(report: (typeof reports)[number]) {
    setReports((prev) =>
      [report, ...prev.filter((item) => item.id !== report.id)].slice(0, 5),
    );
  }

  function prependEntry(entry: (typeof timeEntries)[number]) {
    setTimeEntries((prev) =>
      [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 5),
    );
  }

  async function handleResolve(alertId: string) {
    if (pendingResolveId) return;
    setPendingResolveId(alertId);

    const result = await resolveAlert(alertId);
    setPendingResolveId(null);

    if (result.ok) {
      setAttention((prev) => prev.filter((alert) => alert.id !== alertId));
      setAttentionCount((prev) => Math.max(0, prev - 1));
      setAlertPanel((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? {
                ...result.data,
                currentLabel: null,
                thresholdLabel: null,
                impactLabel: null,
              }
            : alert,
        ),
      );
      toast.success("Alert resolved.");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Activity &amp; Alerts
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              See what changed, what needs attention, and what your team logged.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {capabilities.manageClients && (
              <Button onClick={() => setClientDialogOpen(true)}>
                <Plus />
                Add Client
              </Button>
            )}
            {capabilities.addTime && (
              <Button
                variant="outline"
                onClick={() => setTimeDialogOpen(true)}
                disabled={!canLogTime}
                title={
                  !hasClients
                    ? "Add a client before logging time."
                    : members.length === 0
                      ? "No team members available yet."
                      : undefined
                }
              >
                <Timer />
                Log Time
              </Button>
            )}
            {capabilities.manageReports && (
              <Button
                variant="outline"
                onClick={() => setReportDialogOpen(true)}
                disabled={!canGenerateReport}
                title={
                  !hasClients
                    ? "Add a client before generating a report."
                    : reportableMonths.length === 0
                      ? "Log time first to generate a report."
                      : undefined
                }
              >
                <FileText />
                Generate Report
              </Button>
            )}
          </div>
        </div>
      </section>

      <AttentionSection
        alerts={attention}
        count={attentionCount}
        canResolve={capabilities.manageClients}
        onResolve={handleResolve}
        onAddClient={() => setClientDialogOpen(true)}
      />

      <ActivityTimeline
        timeline={data.timeline}
        filters={filters}
        clients={clients}
      />
      <AlertsPanel
        alerts={alertPanel}
        canResolve={capabilities.manageClients}
        onResolve={handleResolve}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentReports
          reports={reports}
          onGenerate={() => setReportDialogOpen(true)}
        />
        <LatestTimeEntries
          entries={timeEntries}
          onLogTime={() => setTimeDialogOpen(true)}
        />
      </section>

      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        client={null}
        onCreated={(client) => {
          setClients((prev) => {
            if (prev.some((item) => item.id === client.id)) return prev;
            return [...prev, { id: client.id, name: client.name }].sort((a, b) =>
              a.name.localeCompare(b.name),
            );
          });
          toast.success("Client added.");
        }}
        onUpdated={() => {}}
      />
      <TimeEntryFormDialog
        open={timeDialogOpen}
        onOpenChange={setTimeDialogOpen}
        entry={null}
        clients={clients}
        members={members}
        onCreated={(entry) => {
          prependEntry(entry);
          toast.success("Time entry logged.");
        }}
        onUpdated={() => {}}
      />
      <GenerateReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        clients={clients}
        months={reportableMonths}
        onCreated={(report) => prependReport(report)}
      />
    </div>
  );
}
