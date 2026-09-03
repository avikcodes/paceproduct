import type { Metadata } from "next";
import { getAdminMembers } from "@/lib/admin";
import {
  AdminTeamTable,
  type AdminMemberDisplayRow,
} from "@/components/admin/admin-team-table";

export const metadata: Metadata = {
  title: "Admin · Team",
  description: "Workspace-wide team administration.",
};

export default async function AdminTeamPage() {
  // TODO: Get workspace from new auth system
  const rows: AdminMemberDisplayRow[] = [];

  return <AdminTeamTable members={rows} />;
}
