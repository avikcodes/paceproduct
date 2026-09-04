import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
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
  const workspace = await requireCapability("addTimeEntries");
  const canEditAll = roleHasCapability(workspace.role, "manageClients");

  const [clientRows, memberRows, entryRows] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: workspace.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    }),
    prisma.timeEntry.findMany({
      where: { workspaceId: workspace.workspaceId },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      select: timeEntrySelect,
    }),
  ]);

  const clientOptions: ClientOption[] = clientRows;
  const memberOptions: MemberOption[] = memberRows.map((m) => ({
    id: m.id,
    name: null,
    email: null,
  }));

  const memberDisplayMap = new Map(memberRows.map((m) => [m.id, m.userId]));
  const rows: TimeEntryRow[] = entryRows.map((entry) =>
    toTimeEntryRow(entry, {
      name: memberDisplayMap.get(entry.memberId) ?? null,
      email: null,
    }),
  );

  const currentMember = memberRows.find((m) => m.userId === workspace.userId);
  const currentMemberId = currentMember?.id ?? null;

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
