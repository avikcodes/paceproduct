import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceOwner } from "@/lib/permissions";
import { roleHasCapability } from "@/lib/capabilities";
import { getClerkUserInfos } from "@/lib/clerk-users";
import { InviteLinkCard } from "@/components/settings/team/invite-link-card";
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
  const workspace = await requireWorkspaceOwner();
  const canManage = roleHasCapability(workspace.role, "manageTeam");

  const [memberRows, invitationRows, existingInviteLink] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        role: true,
        billingRate: true,
        costRate: true,
        currency: true,
        createdAt: true,
      },
    }),
    prisma.workspaceInvitation.findMany({
      where: { workspaceId: workspace.workspaceId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        acceptedAt: true,
        cancelledAt: true,
      },
    }),
    prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId: workspace.workspaceId,
        email: null,
        status: "PENDING",
      },
      select: { id: true },
    }),
  ]);

  const clerkInfos = await getClerkUserInfos(
    memberRows.map((m) => m.userId),
  );

  const members: MemberRow[] = memberRows.map((member) => {
    const clerkInfo = clerkInfos.get(member.userId);
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      billingRate: member.billingRate.toNumber(),
      costRate: member.costRate.toNumber(),
      currency: member.currency,
      createdAt: member.createdAt,
      name: clerkInfo?.name ?? null,
      email: clerkInfo?.email ?? null,
      imageUrl: clerkInfo?.imageUrl ?? null,
    };
  });

  const existingEmails = invitationRows
    .map((inv) => inv.email)
    .filter((email): email is string => Boolean(email));

  const now = new Date();
  const invitations = invitationRows
    .filter((inv) => inv.email !== null)
    .map((inv) => ({
      ...inv,
      email: inv.email ?? "",
      expired:
        inv.status === "PENDING" &&
        inv.expiresAt !== null &&
        inv.expiresAt.getTime() <= now.getTime(),
    }));

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <div className="flex justify-end">
          <TeamImportButton refs={{ existingEmails }} />
        </div>
      )}
      {canManage && <InviteLinkCard existingLink={null} />}
      {canManage && <InvitationsTable invitations={invitations} />}
      <MembersTable
        members={members}
        currentUserId={workspace.userId}
        canManage={canManage}
      />
    </div>
  );
}
