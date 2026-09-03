import type { Metadata } from "next";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
import { getDashboardData, type DashboardData } from "@/lib/dashboard";
import { getClerkUserInfos } from "@/lib/clerk-users";
import { DASHBOARD_PERIODS, type DashboardPeriod } from "@/lib/dashboard-metrics";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Live overview of revenue, profitability, and client health.",
};

export const dynamic = "force-dynamic";

function isDashboardPeriod(value: string | undefined): value is DashboardPeriod {
  return (
    !!value &&
    (DASHBOARD_PERIODS as readonly string[]).includes(value)
  );
}

function isKnownTimeZone(value: string | undefined): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tz?: string }>;
}) {
  const workspace = await requireCapability("viewDashboard");
  const params = await searchParams;

  const period = isDashboardPeriod(params.period) ? params.period : "30d";
  const timeZone = isKnownTimeZone(params.tz) ? params.tz! : "UTC";

  const data: DashboardData = await getDashboardData(
    workspace.workspaceId,
    period,
    timeZone,
    async (userIds) => {
      const infos = await getClerkUserInfos(userIds);
      return new Map(
        [...infos].map(([userId, info]) => [
          userId,
          info.name ?? userId.slice(0, 8),
        ]),
      );
    },
  );

  const canManageTeam = roleHasCapability(workspace.role, "manageTeam");
  const canManageClients = roleHasCapability(workspace.role, "manageClients");
  const canAddTime = roleHasCapability(workspace.role, "addTimeEntries");
  const canViewReports = roleHasCapability(workspace.role, "viewReports");

  return (
    <DashboardView
      data={data}
      period={period}
      timeZone={timeZone}
      capabilities={{
        manageTeam: canManageTeam,
        manageClients: canManageClients,
        addTime: canAddTime,
        viewReports: canViewReports,
      }}
    />
  );
}
