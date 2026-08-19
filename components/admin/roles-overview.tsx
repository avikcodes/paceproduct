import { Crown, ShieldCheck, Users, KeyRound, Check } from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  ALL_CAPABILITIES,
  CAPABILITY_LABELS,
  roleHasCapability,
} from "@/lib/capabilities";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["OWNER", "MEMBER"];

const ROLE_META: Record<
  Role,
  { label: string; icon: typeof Crown; tone: string }
> = {
  OWNER: {
    label: "Owner",
    icon: Crown,
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  MEMBER: {
    label: "Member",
    icon: Users,
    tone: "bg-muted text-muted-foreground",
  },
};

export function RolesOverview({
  counts,
  totalMembers,
}: {
  counts: Record<Role, number>;
  totalMembers: number;
}) {
  const hasMembers = totalMembers > 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(Object.keys(ROLE_META) as Role[]).map((role) => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <Card key={role}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-lg",
                      meta.tone,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  {meta.label}s
                </CardTitle>
                <CardDescription>
                  {role === "OWNER"
                    ? "Full control over the workspace. Can manage the team, permissions, settings, and the Admin area."
                    : "Standard access to workspace features. Can view data and log time, but cannot manage the team or settings."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                  {counts[role]}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {role === "OWNER"
                    ? "Workspace administrator"
                    : "Regular collaborator"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            Permissions
          </CardTitle>
          <CardDescription>
            What each role can do in this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-foreground">
                    Capability
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-foreground">
                    Owner
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-foreground">
                    Member
                  </th>
                </tr>
              </thead>
              <tbody>
                {ALL_CAPABILITIES.map((capability, index) => {
                  const label = CAPABILITY_LABELS[capability];
                  return (
                    <tr
                      key={capability}
                      className={cn(
                        "border-t border-border",
                        index % 2 === 1 && "bg-muted/20",
                      )}
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <span className="block font-medium text-foreground">
                          {label.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {label.description}
                        </span>
                      </td>
                      {ROLES.map((role) => (
                        <td
                          key={role}
                          className="px-4 py-2.5 text-right align-middle"
                        >
                          <PermissionCheck
                            allowed={roleHasCapability(role, capability)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {!hasMembers && (
        <EmptyState
          icon={ShieldCheck}
          title="No team yet"
          description="Invite your first teammate to start assigning roles."
          action={
            <ButtonLink href="/settings/team" variant="outline">
              <Users />
              Invite team
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}

function PermissionCheck({ allowed }: { allowed: boolean }) {
  if (allowed) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
        <span className="sr-only">Allowed</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground" aria-hidden="true">
      —
    </span>
  );
}
