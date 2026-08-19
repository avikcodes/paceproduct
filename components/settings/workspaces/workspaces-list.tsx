"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  CalendarDays,
  Crown,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import {
  deleteWorkspace,
  leaveWorkspace,
  renameWorkspace,
  switchWorkspace,
} from "@/app/(app)/settings/workspaces/actions";
import { WorkspaceAvatar } from "@/components/dashboard/workspace-avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { WorkspaceSummary } from "@/lib/workspaces-shared";

function roleLabel(role: WorkspaceSummary["role"]): string {
  return role === "OWNER" ? "Owner" : "Member";
}

function RenameWorkspaceDialog({
  workspace,
}: {
  workspace: WorkspaceSummary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(workspace.workspaceName);
  const [isPending, startTransition] = useTransition();

  function onRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please enter a workspace name.");
      return;
    }
    if (trimmed.length > 100) {
      toast.error("Workspace name must be 100 characters or fewer.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("workspaceId", workspace.workspaceId);
      formData.set("workspaceName", trimmed);
      const result = await renameWorkspace(
        { error: undefined, success: undefined },
        formData,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil />
        Rename
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename workspace</DialogTitle>
          <DialogDescription>
            Update the name of {workspace.workspaceName}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rename-workspace">Workspace name</Label>
          <Input
            id="rename-workspace"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={onRename} disabled={isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteWorkspaceDialog({
  workspace,
}: {
  workspace: WorkspaceSummary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteWorkspace(workspace.workspaceId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="text-destructive" />}
      >
        <Trash2 />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes {workspace.workspaceName}, including its
            clients, time entries, reports, and integrations. This action can&apos;t
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={onDelete} disabled={isPending}>
            <Trash2 />
            Delete workspace
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LeaveWorkspaceDialog({
  workspace,
}: {
  workspace: WorkspaceSummary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onLeave() {
    startTransition(async () => {
      const result = await leaveWorkspace(workspace.workspaceId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" />}
      >
        <UserMinus />
        Leave
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll lose access to {workspace.workspaceName} and its data. You can
            only rejoin if you&apos;re invited again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={onLeave} disabled={isPending}>
            <UserMinus />
            Leave workspace
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function WorkspacesList({
  workspaces,
}: {
  workspaces: WorkspaceSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const current = workspaces.find((workspace) => workspace.isCurrent);

  function onSwitch(workspaceId: string) {
    if (workspaceId === current?.workspaceId || isPending) return;
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          You&apos;re a member of {workspaces.length}{" "}
          {workspaces.length === 1 ? "workspace" : "workspaces"}.
        </p>
        <Button onClick={() => router.push("/settings/workspaces/new")}>
          <Plus />
          Create workspace
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workspace</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Members</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workspaces.map((workspace) => (
            <TableRow key={workspace.workspaceId}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <WorkspaceAvatar workspaceName={workspace.workspaceName} />
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {workspace.workspaceName}
                      </span>
                      {workspace.isCurrent && (
                        <Badge
                          variant="outline"
                          className="rounded-full border-transparent bg-primary/10 text-primary"
                        >
                          Current
                        </Badge>
                      )}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-transparent bg-muted text-muted-foreground"
                >
                  {workspace.role === "OWNER" && (
                    <Crown className="size-3.5 text-amber-500" />
                  )}
                  {roleLabel(workspace.role)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" />
                  {formatDate(workspace.createdAt)}
                </span>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  {workspace.memberCount}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {!workspace.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSwitch(workspace.workspaceId)}
                      disabled={isPending}
                    >
                      <ArrowRightLeft />
                      Switch
                    </Button>
                  )}
                  {workspace.role === "OWNER" ? (
                    <>
                      <RenameWorkspaceDialog workspace={workspace} />
                      <DeleteWorkspaceDialog workspace={workspace} />
                    </>
                  ) : (
                    <LeaveWorkspaceDialog workspace={workspace} />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
