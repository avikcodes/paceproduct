import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
import { getClerkUserInfos } from "@/lib/clerk-users";
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
  const { workspaceId } = workspace;

  const [timeEntries, clients, members] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { workspaceId },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      select: timeEntrySelect,
    }),
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    }),
  ]);

  const userInfos = await getClerkUserInfos(members.map((member) => member.userId));
  const memberInfoMap = new Map(
    members.map((member) => [
      member.id,
      userInfos.get(member.userId) ?? { name: null, email: null },
    ]),
  );

  const rows: TimeEntryRow[] = timeEntries.map((entry) =>
    toTimeEntryRow(
      entry,
      memberInfoMap.get(entry.memberId) ?? { name: null, email: null },
    ),
  );

  const clientOptions: ClientOption[] = clients;
  const memberOptions: MemberOption[] = members.map((member) => {
    const info = userInfos.get(member.userId);
    return { id: member.id, name: info?.name ?? null, email: info?.email ?? null };
  });

  const currentMemberId =
    members.find((member) => member.userId === workspace.userId)?.id ?? null;

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
        canEditAll={roleHasCapability(workspace.role, "manageTeam")}
      />
    </div>
  );
}
