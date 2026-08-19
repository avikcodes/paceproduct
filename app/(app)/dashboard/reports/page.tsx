import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
import {
  getReportableMonths,
  getStoredReports,
} from "@/lib/reports";
import { ReportsTable } from "@/components/reports/reports-table";

export const metadata: Metadata = {
  title: "Generated reports",
  description: "Monthly snapshots of revenue, cost, and profit per client.",
};

export default async function ReportsPage() {
  const workspace = await requireCapability("viewReports");
  const canManageReports = roleHasCapability(workspace.role, "manageReports");
  const { workspaceId } = workspace;

  const [reports, clients, reportableMonths] = await Promise.all([
    getStoredReports(workspaceId),
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getReportableMonths(workspaceId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Reports</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Generated reports
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Monthly snapshots of revenue, cost, and profit for every client.
        </p>
      </section>

      <ReportsTable
        initialReports={reports}
        clients={clients}
        reportableMonths={reportableMonths}
        canManageReports={canManageReports}
      />
    </div>
  );
}
