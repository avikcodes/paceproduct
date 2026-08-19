import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
import { getClerkUserInfos } from "@/lib/clerk-users";
import { InviteMemberForm } from "@/components/settings/team/invite-member-form";
import { TeamImportButton } from "@/components/settings/team/team-import-button";
import {
  MembersTable,
  type MemberRow,
} from "@/components/settings/team/members-table";
import {
  InvitationsTable,
  type InvitationRow,
} from "@/components/settings/team/invitations-table";

export const metadata: Metadata = {
  title: "Team",
  description: "Manage your workspace members and invitations.",
};

export default async function TeamPage() {
  const workspace = await requireCapability("viewTeam");
  const { userId, workspaceId, role } = workspace;
  const canManage = roleHasCapability(role, "manageTeam");

  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const userInfos = await getClerkUserInfos(members.map((member) => member.userId));

  const memberRows: MemberRow[] = members.map((member) => {
    const info = userInfos.get(member.userId);
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      billingRate: member.billingRate.toNumber(),
      costRate: member.costRate.toNumber(),
      currency: member.currency,
      createdAt: member.createdAt,
      name: info?.name ?? null,
      email: info?.email ?? null,
      imageUrl: info?.imageUrl ?? null,
    };
  });

  const invitationsWithEmail = invitations.filter(
    (invitation): invitation is typeof invitation & { email: string } =>
      invitation.email !== null,
  );

  const invitationRows: InvitationRow[] = invitationsWithEmail.map(
    (invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      cancelledAt: invitation.cancelledAt,
      expired:
        invitation.status === "PENDING" &&
        Boolean(
          invitation.expiresAt &&
            invitation.expiresAt.getTime() < new Date().getTime(),
        ),
    }),
  );

  const existingEmails = [
    ...new Set([
      ...[...userInfos.values()]
        .map((info) => info.email?.toLowerCase())
        .filter((email): email is string => Boolean(email)),
      ...invitationsWithEmail
        .filter((invitation) => invitation.status === "PENDING")
        .map((invitation) => invitation.email.toLowerCase()),
    ]),
  ];

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <div className="flex justify-end">
          <TeamImportButton refs={{ existingEmails }} />
        </div>
      )}
      {canManage && <InviteMemberForm />}
      {canManage && <InvitationsTable invitations={invitationRows} />}
      <MembersTable
        members={memberRows}
        currentUserId={userId}
        canManage={canManage}
      />
    </div>
  );
}
