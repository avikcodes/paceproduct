import type { Metadata } from "next";
import { requireCapability } from "@/lib/permissions";
import { getClientOverview } from "@/lib/client-overview";
import { ClientOverviewTable } from "@/components/clients/client-overview-table";

export const metadata: Metadata = {
  title: "Client overview",
  description:
    "Financial snapshot of every client in your workspace, sorted by revenue, profit, margin, and burn risk.",
};

export default async function ClientOverviewPage() {
  const workspace = await requireCapability("viewClients");
  const rows = await getClientOverview(workspace.workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Clients</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Client overview
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Revenue, cost, profit, and margin for the current month, alongside
          budget burn status and active alerts. Sort by revenue, profit, margin,
          or burn risk.
        </p>
      </section>

      <ClientOverviewTable initialRows={rows} />
    </div>
  );
}
