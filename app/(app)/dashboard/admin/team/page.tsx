import type { Metadata } from "next";
import { getAdminMembers } from "@/lib/admin";
import { getCurrentWorkspace } from "@/lib/permissions";
import { getClerkUserInfos } from "@/lib/clerk-users";
import {
  AdminTeamTable,
  type AdminMemberDisplayRow,
} from "@/components/admin/admin-team-table";

export const metadata: Metadata = {
  title: "Admin · Team",
  description: "Workspace-wide team administration.",
};

export default async function AdminTeamPage() {
  const workspace = await getCurrentWorkspace();
  const members = await getAdminMembers(workspace.workspaceId);

  const userInfos = await getClerkUserInfos(members.map((member) => member.userId));

  const rows: AdminMemberDisplayRow[] = members.map((member) => {
    const info = userInfos.get(member.userId);
    return {
      ...member,
      name: info?.name ?? null,
      email: info?.email ?? null,
      imageUrl: info?.imageUrl ?? null,
    };
  });

  return <AdminTeamTable members={rows} />;
}
