import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { alertSelect, toAlertRow } from "@/lib/alerts";
import { AlertsTable } from "@/components/alerts/alerts-table";

export const metadata: Metadata = {
  title: "Alerts",
  description: "Review alerts about margins, budgets, and scope.",
};

export default async function AlertsPage() {
  const workspace = await requireCapability("viewDashboard");

  const rows = await prisma.alert.findMany({
    where: { workspaceId: workspace.workspaceId },
    orderBy: [{ createdAt: "desc" }],
    select: alertSelect,
  });

  const alerts = rows.map(toAlertRow);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Alerts</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Alerts
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Review alerts about margins, budgets, and scope.
        </p>
      </section>

      <AlertsTable initialAlerts={alerts} />
    </div>
  );
}
