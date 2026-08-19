"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug, PlugZap, Unplug } from "lucide-react";
import { toast } from "sonner";
import {
  connectToggl,
  disconnectToggl,
  type TogglActionState,
} from "@/app/(app)/settings/integrations/actions";
import type { ClientOption } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TogglImportDialog } from "@/components/settings/integrations/toggl-import-dialog";
import { cn } from "@/lib/utils";

export type TogglConnectionData = {
  email: string | null;
  name: string | null;
  togglWorkspaceName: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
};

type TogglSettingsCardProps = {
  connection: TogglConnectionData | null;
  canManage: boolean;
  clients: ClientOption[];
};

const STATUS_LABELS: Record<string, string> = {
  NEVER: "Not synced yet",
  RUNNING: "Syncing…",
  SUCCESS: "Synced",
  PARTIAL: "Partially synced",
  FAILED: "Sync failed",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return <Badge variant="outline">{STATUS_LABELS[status]}</Badge>;
  }
  if (status === "PARTIAL" || status === "RUNNING") {
    return <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>;
  }
  if (status === "FAILED") {
    return <Badge variant="destructive">{STATUS_LABELS[status]}</Badge>;
  }
  return <Badge variant="outline">{STATUS_LABELS[status]}</Badge>;
}

function ConnectForm() {
  const [state, formAction, isPending] = useActionState<TogglActionState, FormData>(
    connectToggl,
    {},
  );
  const [token, setToken] = useState("");
  const { error, success } = state;

  useEffect(() => {
    if (error) toast.error(error);
    if (success) toast.success(success);
  }, [error, success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="toggl-token">Toggl API token</Label>
        <Input
          key={success ?? "idle"}
          id="toggl-token"
          name="token"
          type="password"
          placeholder="Paste your API token"
          autoComplete="off"
          value={success ? "" : token}
          onChange={(event) => setToken(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn("h-9", error && "aria-invalid:border-destructive")}
        />
        <p className="text-xs text-muted-foreground">
          Find it under{" "}
          <a
            href="https://track.toggl.com/profile"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-3 hover:text-foreground"
          >
            Toggl Track → Profile
          </a>
          . The token is encrypted before it is stored.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div>
        <Button type="submit" size="lg" className="h-9" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <PlugZap />
              Connect Toggl
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function TogglSettingsCard({
  connection,
  canManage,
  clients,
}: TogglSettingsCardProps) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Toggl? Existing imported entries will be kept.")) {
      return;
    }
    setDisconnecting(true);
    const result = await disconnectToggl();
    setDisconnecting(false);
    if (result.success) {
      toast.success(result.success);
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not disconnect Toggl.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4 text-muted-foreground" />
          Toggl
        </CardTitle>
        <CardDescription>
          Import tracked time from Toggl Track into your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!connection ? (
          canManage ? (
            <ConnectForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Toggl hasn&apos;t been connected yet. Only workspace owners can connect it.
            </p>
          )
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Connected account</dt>
                <dd className="text-sm font-medium text-foreground">
                  {connection.name || "Toggl account"}
                  {connection.email && (
                    <span className="block text-sm font-normal text-muted-foreground">
                      {connection.email}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Toggl workspace</dt>
                <dd className="text-sm font-medium text-foreground">
                  {connection.togglWorkspaceName || "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={connection.lastSyncStatus} />
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Last import</dt>
                <dd className="text-sm font-medium text-foreground">
                  {connection.lastSyncAt
                    ? new Date(connection.lastSyncAt).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>

            {connection.lastSyncError && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                {connection.lastSyncError}
              </p>
            )}

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setImportOpen(true)}>
                  <PlugZap />
                  Import entries
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Unplug />
                  )}
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {connection && canManage && (
        <TogglImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          clients={clients}
        />
      )}
    </Card>
  );
}
