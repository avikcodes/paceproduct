import type { Metadata } from "next";
import { getAdminClients } from "@/lib/admin";
import { requireCapability } from "@/lib/permissions";
import { AdminClientsTable } from "@/components/admin/admin-clients-table";

export const metadata: Metadata = {
  title: "Admin · Clients",
  description: "Workspace-wide client administration.",
};

export default async function AdminClientsPage() {
  const workspace = await requireCapability("manageClients");
  const clients = await getAdminClients(workspace.workspaceId);

  return <AdminClientsTable initialClients={clients} />;
}
