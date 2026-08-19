import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
import { clientSelect } from "@/lib/clients";
import { getClientMargins } from "@/lib/margins";
import { getScopeUsages } from "@/lib/scope";
import { ClientsTable } from "@/components/clients/clients-table";

export const metadata: Metadata = {
  title: "Clients",
  description: "Manage all agency clients.",
};

export default async function ClientsPage() {
  const workspace = await requireCapability("viewClients");
  const canManageClients = roleHasCapability(workspace.role, "manageClients");
  const canManageRetainers = roleHasCapability(workspace.role, "manageRetainers");

  const clients = await prisma.client.findMany({
    where: { workspaceId: workspace.workspaceId },
    orderBy: [{ createdAt: "desc" }],
    select: clientSelect,
  });

  const activeRetainerClientIds = await prisma.client
    .findMany({
      where: {
        workspaceId: workspace.workspaceId,
        retainers: { some: { isActive: true } },
      },
      select: { id: true },
    })
    .then((rows) => rows.map((row) => row.id));

  const margins = await getClientMargins(workspace.workspaceId);
  const scopeUsages = await getScopeUsages(workspace.workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Clients</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Clients
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Manage all agency clients.
        </p>
      </section>

      <ClientsTable
        initialClients={clients}
        initialMargins={margins}
        initialScope={scopeUsages}
        canManageClients={canManageClients}
        canManageRetainers={canManageRetainers}
        activeRetainerClientIds={activeRetainerClientIds}
      />
    </div>
  );
}
