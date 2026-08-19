"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createWorkspace } from "@/app/(app)/settings/workspaces/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function CreateWorkspaceForm() {
  const [state, formAction, isPending] = useActionState(createWorkspace, {
    error: undefined,
  });
  const [name, setName] = useState("");

  const trimmed = name.trim();
  const tooLong = trimmed.length > 100;
  const error =
    tooLong ? "Workspace name must be 100 characters or fewer." : state.error;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (trimmed.length === 0) {
      event.preventDefault();
      toast.error("Please enter a workspace name.");
      return;
    }
    if (tooLong) {
      event.preventDefault();
      toast.error("Workspace name must be 100 characters or fewer.");
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="workspace-name">Workspace Name</Label>
        <Input
          id="workspace-name"
          name="workspaceName"
          placeholder="e.g. Acme Agency"
          autoComplete="organization"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "workspace-name-error" : undefined}
          maxLength={100}
          className={cn("h-10 px-3 text-base", error && "aria-invalid:border-destructive")}
        />
        {error && (
          <p id="workspace-name-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-10 w-full text-sm" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="animate-spin" />
            Creating workspace…
          </>
        ) : (
          "Create Workspace"
        )}
      </Button>
    </form>
  );
}
