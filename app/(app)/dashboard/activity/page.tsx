import type { Metadata } from "next";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
import {
  getActivityData,
  clampPage,
  isActivityEventType,
  isTimelineDate,
  parseSeverity,
  type TimelineFilters,
} from "@/lib/activity";
import { ActivityOverview } from "@/components/activity/activity-overview";

export const metadata: Metadata = {
  title: "Activity & Alerts",
  description:
    "See what changed, what needs attention, and what your team logged.",
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    event?: string;
    date?: string;
    client?: string;
    severity?: string;
    page?: string;
  }>;
}) {
  const workspace = await requireCapability("viewDashboard");
  const params = await searchParams;

  const filters: TimelineFilters = {
    query:
      typeof params.q === "string"
        ? params.q
        : "",
    event:
      isActivityEventType(params.event) ? params.event : "ALL",
    date: isTimelineDate(params.date) ? params.date : "ALL",
    clientId:
      typeof params.client === "string" && params.client.length > 0
        ? params.client
        : "ALL",
    severity: parseSeverity(params.severity),
    page: clampPage(params.page ? Number(params.page) : 1),
  };

  const data = await getActivityData(workspace.workspaceId, filters);

  return (
    <ActivityOverview
      data={data}
      filters={filters}
      capabilities={{
        manageClients: roleHasCapability(workspace.role, "manageClients"),
        addTime: roleHasCapability(workspace.role, "addTimeEntries"),
        manageReports: roleHasCapability(workspace.role, "manageReports"),
        viewReports: roleHasCapability(workspace.role, "viewReports"),
      }}
    />
  );
}
