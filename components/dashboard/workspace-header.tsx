import { WorkspaceAvatar } from "@/components/dashboard/workspace-avatar";

export function WorkspaceHeader({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <WorkspaceAvatar workspaceName={workspaceName} />
      <div className="min-w-0 flex-col">
        <span className="block truncate text-sm font-medium leading-tight text-foreground">
          {workspaceName}
        </span>
        <span className="block truncate text-xs leading-tight text-muted-foreground">
          Workspace
        </span>
      </div>
    </div>
  );
}
