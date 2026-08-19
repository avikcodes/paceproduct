import Link from "next/link";
import {
  Building2,
  ShieldAlert,
  HandCoins,
  Users,
  Clock,
  MailPlus,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { clientStatusLabel } from "@/lib/clients";
import type { AdminOverview } from "@/lib/admin";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<
  keyof AdminOverview["clientsByStatus"],
  string
> = {
  ACTIVE: "bg-emerald-500",
  PAUSED: "bg-amber-500",
  ARCHIVED: "bg-muted",
};

export function AdminOverviewView({ data }: { data: AdminOverview }) {
  const hasClients = data.totalClients > 0;
  const hasMembers = data.totalMembers > 0;

  return (
    <div className="flex flex-col gap-6">
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Workspace summary"
      >
        <StatCard
          label="Total clients"
          value={String(data.totalClients)}
          caption="Across all statuses"
          icon={Building2}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Team members"
          value={String(data.totalMembers)}
          caption="People with workspace access"
          icon={Users}
          iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <StatCard
          label="Active retainers"
          value={String(data.activeRetainers)}
          caption="Retainers currently active"
          icon={HandCoins}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Active alerts"
          value={String(data.activeAlerts)}
          caption="Unresolved alerts in this workspace"
          icon={ShieldAlert}
          tone={data.activeAlerts > 0 ? "negative" : undefined}
          iconClassName={
            data.activeAlerts > 0
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-muted/50 text-muted-foreground"
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              Recent clients
            </CardTitle>
            <CardDescription>
              Newest clients in this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentClients.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No clients yet"
                description="Clients you create will appear here."
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {data.recentClients.map((client) => (
                  <li key={client.id}>
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="group flex items-center gap-3 rounded-md px-1.5 py-2 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {client.name}
                      </span>
                      <span className="hidden text-xs text-muted-foreground whitespace-nowrap sm:block">
                        {formatDate(client.createdAt)}
                      </span>
                      <ClientStatusBadge status={client.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Workspace at a glance
            </CardTitle>
            <CardDescription>
              Client status and team role distribution.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Clients by status
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {data.totalClients}
                </span>
              </div>
              {hasClients ? (
                <div className="flex flex-col gap-2">
                  <div
                    role="progressbar"
                    aria-label="Clients by status"
                    className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    {Object.entries(data.clientsByStatus).map(
                      ([status, count]) =>
                        count > 0 && (
                          <div
                            key={status}
                            className={cn(
                              "h-full",
                              STATUS_TONES[
                                status as keyof typeof data.clientsByStatus
                              ],
                            )}
                            style={{
                              width: `${(count / data.totalClients) * 100}%`,
                            }}
                          />
                        ),
                    )}
                  </div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(data.clientsByStatus).map(
                      ([status, count]) => (
                        <li
                          key={status}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              STATUS_TONES[
                                status as keyof typeof data.clientsByStatus
                              ],
                            )}
                          />
                          {clientStatusLabel(
                            status as keyof typeof data.clientsByStatus,
                          )}
                          <span className="font-medium text-foreground tabular-nums">
                            {count}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No clients yet.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Roles
              </span>
              <ul className="flex flex-col gap-1">
                {(["OWNER", "MEMBER"] as const).map((role) => (
                  <li
                    key={role}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {role === "OWNER" ? "Owners" : "Members"}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {data.membersByRole[role]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <MailPlus className="size-4 text-muted-foreground" />
                Pending invitations
              </span>
              <span className="text-sm font-medium text-foreground tabular-nums">
                {data.pendingInvitations}
              </span>
            </div>

            {!hasMembers && (
              <p className="text-sm text-muted-foreground">
                Invite teammates from the team page to collaborate.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {!hasClients && !hasMembers && (
        <EmptyState
          icon={Clock}
          title="Nothing to show yet"
          description="Add clients and invite teammates to start using workspace admin."
        />
      )}
    </div>
  );
}
