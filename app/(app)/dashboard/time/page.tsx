import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  timeEntrySelect,
  toTimeEntryRow,
  type ClientOption,
  type MemberOption,
  type TimeEntryRow,
} from "@/lib/time";
import { TimeLogTable } from "@/components/time/time-log-table";

export const metadata: Metadata = {
  title: "Time",
  description: "Track time across your team and clients.",
};

export default async function TimePage() {
  // TODO: Get workspace from new auth system
  const rows: TimeEntryRow[] = [];
  const clientOptions: ClientOption[] = [];
  const memberOptions: MemberOption[] = [];
  const currentMemberId = null;
  const canEditAll = false;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Time</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Time log
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Track billable hours across your team and clients.
        </p>
      </section>

      <TimeLogTable
        initialEntries={rows}
        clients={clientOptions}
        members={memberOptions}
        currentMemberId={currentMemberId}
        canEditAll={canEditAll}
      />
    </div>
  );
}
