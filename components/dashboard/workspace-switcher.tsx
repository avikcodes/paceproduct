"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Building2,
  ChevronsUpDown,
  Plus,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { switchWorkspace } from "@/app/(app)/settings/workspaces/actions";
import { WorkspaceAvatar } from "@/components/dashboard/workspace-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_OWNED_WORKSPACES, type WorkspaceSummary } from "@/lib/workspaces-shared";

function roleLabel(role: WorkspaceSummary["role"]): string {
  return role === "OWNER" ? "Owner" : "Member";
}

export function WorkspaceSwitcher({
  workspaces,
}: {
  workspaces: WorkspaceSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const current =
    workspaces.find((workspace) => workspace.isCurrent) ?? workspaces[0];
  const ownedCount = workspaces.filter(
    (workspace) => workspace.role === "OWNER",
  ).length;
  const canCreateWorkspace = ownedCount < MAX_OWNED_WORKSPACES;

  if (!current) return null;

  function onSwitch(workspaceId: string) {
    if (workspaceId === current.workspaceId || isPending) return;
    startTransition(async () => {
      const result = await switchWorkspace(workspaceId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex max-w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-expanded:bg-muted hover:bg-muted"
        aria-label="Switch workspace"
      >
        <WorkspaceAvatar workspaceName={current.workspaceName} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium leading-tight text-foreground">
            {current.workspaceName}
          </span>
          <span className="truncate text-xs leading-tight text-muted-foreground">
            Workspace · {roleLabel(current.role)}
          </span>
        </span>
        <ChevronsUpDown className="ml-1 size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Current workspace</DropdownMenuLabel>
          <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
            <WorkspaceAvatar workspaceName={current.workspaceName} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {current.workspaceName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {roleLabel(current.role)}
              </span>
            </div>
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuRadioGroup
          value={current.workspaceId}
          onValueChange={onSwitch}
        >
          <DropdownMenuLabel>All workspaces</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuRadioItem
              key={workspace.workspaceId}
              value={workspace.workspaceId}
              disabled={isPending}
              className="cursor-pointer py-1.5"
            >
              <WorkspaceAvatar
                workspaceName={workspace.workspaceName}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{workspace.workspaceName}</span>
                <span className="block text-xs text-muted-foreground">
                  {roleLabel(workspace.role)}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push("/settings/workspaces/new")}
        >
          <Plus />
          Create workspace
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push("/settings/workspaces")}
        >
          <Settings2 />
          Manage workspaces
        </DropdownMenuItem>

        {!canCreateWorkspace && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-start gap-1.5 pt-2 text-xs leading-snug">
              <Building2 className="mt-0.5 size-3.5 shrink-0" />
              You&apos;ve reached the limit of 3 owned workspaces.
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
