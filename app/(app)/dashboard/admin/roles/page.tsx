import type { Metadata } from "next";
import { getMemberRoleCounts } from "@/lib/admin";
import { getCurrentWorkspace } from "@/lib/permissions";
import { RolesOverview } from "@/components/admin/roles-overview";

export const metadata: Metadata = {
  title: "Admin · Roles",
  description: "Workspace roles and permissions.",
};

export default async function AdminRolesPage() {
  const workspace = await getCurrentWorkspace();
  const counts = await getMemberRoleCounts(workspace.workspaceId);
  const totalMembers = counts.OWNER + counts.MEMBER;

  return <RolesOverview counts={counts} totalMembers={totalMembers} />;
}
