import type { Metadata } from "next";
import { getWorkspaceData } from "@/lib/permissions";
import { WorkspacesList } from "@/components/settings/workspaces/workspaces-list";

export const metadata: Metadata = {
  title: "Workspaces",
  description: "Manage the workspaces you own or belong to.",
};

export default async function WorkspacesPage() {
  const { workspaces } = await getWorkspaceData();

  return (
    <div className="flex flex-col gap-6">
      <WorkspacesList workspaces={workspaces} />
    </div>
  );
}
