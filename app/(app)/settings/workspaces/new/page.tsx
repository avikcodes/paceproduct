import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { CreateWorkspaceForm } from "@/components/settings/workspaces/create-workspace-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceList } from "@/lib/permissions";
import { MAX_OWNED_WORKSPACES } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Create workspace",
  description: "Create a new Pace workspace.",
};

export default async function NewWorkspacePage() {
  const workspaces = await getWorkspaceList();
  const ownedCount = workspaces.filter(
    (workspace) => workspace.role === "OWNER",
  ).length;
  const canCreate = ownedCount < MAX_OWNED_WORKSPACES;

  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-muted-foreground" />
            Create workspace
          </CardTitle>
          <CardDescription>
            You can own up to {MAX_OWNED_WORKSPACES} workspaces. You&apos;re
            currently the owner of {ownedCount}{" "}
            {ownedCount === 1 ? "workspace" : "workspaces"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canCreate ? (
            <CreateWorkspaceForm />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                You&apos;ve reached the maximum of {MAX_OWNED_WORKSPACES} workspaces.
                Delete one before creating another.
              </p>
              <Link
                href="/settings/workspaces"
                className="text-sm font-medium text-primary underline-offset-3 hover:underline"
              >
                Manage workspaces
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
