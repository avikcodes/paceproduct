import type { Metadata } from "next";
import { getAdminOverview } from "@/lib/admin";
import { getCurrentWorkspace } from "@/lib/permissions";
import { AdminOverviewView } from "@/components/admin/admin-overview";

export const metadata: Metadata = {
  title: "Admin",
  description: "Workspace administration overview.",
};

export default async function AdminOverviewPage() {
  const workspace = await getCurrentWorkspace();
  const data = await getAdminOverview(workspace.workspaceId);

  return <AdminOverviewView data={data} />;
}
