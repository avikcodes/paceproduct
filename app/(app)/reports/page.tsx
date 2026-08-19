import type { Metadata } from "next";
import { clerkClient } from "@clerk/nextjs/server";

import { getMarginTrends, DEFAULT_MARGIN_TREND_RANGE } from "@/lib/margins";
import { requireCapability } from "@/lib/permissions";
import { getClientProfitability } from "@/lib/profitability";
import { getTeamPerformance } from "@/lib/team-performance";
import { MarginTrends } from "@/components/reports/margin-trends";
import { ProfitabilityRanking } from "@/components/reports/profitability-ranking";
import {
  TeamPerformance,
  type TeamPerformanceRow,
} from "@/components/reports/team-performance";

export const metadata: Metadata = {
  title: "Reports",
  description: "Client profitability and team performance.",
};

const USER_CHUNK_SIZE = 100;

export default async function ReportsPage() {
  const workspace = await requireCapability("viewReports");

  const [clientProfitability, team, marginTrends] = await Promise.all([
    getClientProfitability(workspace.workspaceId),
    getTeamPerformance(workspace.workspaceId),
    getMarginTrends(workspace.workspaceId, DEFAULT_MARGIN_TREND_RANGE),
  ]);

  const client = await clerkClient();
  const userIds = [...new Set(team.rows.map((row) => row.userId))];

  const userChunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += USER_CHUNK_SIZE) {
    userChunks.push(userIds.slice(i, i + USER_CHUNK_SIZE));
  }

  const users = (
    await Promise.all(
      userChunks.map((ids) =>
        client.users.getUserList({ userId: ids, limit: USER_CHUNK_SIZE }),
      ),
    )
  ).flatMap((result) => result.data);

  const userById = new Map(users.map((user) => [user.id, user]));

  const teamRows: TeamPerformanceRow[] = team.rows.map((row) => {
    const user = userById.get(row.userId);
    return {
      ...row,
      name:
        user
          ? [user.firstName, user.lastName].filter(Boolean).join(" ") || null
          : null,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      imageUrl: user?.imageUrl ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Reports</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Reports
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Profitability across your clients and team.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Client profitability
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Every client ranked by revenue, profit, margin, and hours.
        </p>
      </section>

      <ProfitabilityRanking initialRows={clientProfitability} />

      <section className="mt-2 flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Team performance
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Billed vs cost per team member across all logged time.
        </p>
      </section>

      <TeamPerformance initialRows={teamRows} summary={team.summary} />

      <section className="mt-2 flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Historical margin trends
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Revenue, cost, profit, and margin % over time, filterable by client.
        </p>
      </section>

      <MarginTrends initialData={marginTrends} />
    </div>
  );
}
