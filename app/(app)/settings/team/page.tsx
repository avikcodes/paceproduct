import type { Metadata } from "next";
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
  // TODO: Get workspace data from new auth system
  const memberRows: MemberRow[] = [];
  const invitationRows: InvitationRow[] = [];
  const existingEmails: string[] = [];
  const userId = "";
  const canManage = false;

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
