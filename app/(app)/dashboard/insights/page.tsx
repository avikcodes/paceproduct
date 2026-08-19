import type { Metadata } from "next";
import { requireCapability } from "@/lib/permissions";
import { getInsightsDataset } from "@/lib/insights";
import { InsightsOverview } from "@/components/dashboard/insights-overview";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Analyze profitability across clients, team, and time — and find ways to improve it.",
};

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const workspace = await requireCapability("viewDashboard");
  const dataset = await getInsightsDataset(workspace.workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Insights</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Insights
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          How can you improve profitability? Filter the data, then look at
          margins, efficiency, and growth opportunities.
        </p>
      </section>

      <InsightsOverview dataset={dataset} />
    </div>
  );
}
