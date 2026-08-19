"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Carrot, KeyRound, Loader2, PlugZap, Unplug } from "lucide-react";
import { toast } from "sonner";
import {
  connectHarvest,
  disconnectHarvest,
  type HarvestActionState,
} from "@/app/(app)/settings/integrations/harvest-actions";
import type { ClientOption, MemberOption } from "@/lib/time";
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
import { HarvestImportDialog } from "@/components/settings/integrations/harvest-import-dialog";
import { cn } from "@/lib/utils";

export type HarvestConnectionData = {
  name: string | null;
  email: string | null;
  company: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
};

type HarvestSettingsCardProps = {
  connection: HarvestConnectionData | null;
  canManage: boolean;
  clients: ClientOption[];
  members: MemberOption[];
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

type ConnectFormProps = {
  onCancel?: () => void;
};

function ConnectForm({ onCancel }: ConnectFormProps) {
  const [state, formAction, isPending] = useActionState<HarvestActionState, FormData>(
    connectHarvest,
    {},
  );
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const { error, success } = state;

  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (error) toast.error(error);
    if (success) {
      toast.success(success);
      onCancelRef.current?.();
    }
  }, [error, success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="harvest-token">Harvest API token</Label>
        <Input
          key={`token-${success ?? "idle"}`}
          id="harvest-token"
          name="token"
          type="password"
          placeholder="Paste your personal access token"
          autoComplete="off"
          value={success ? "" : token}
          onChange={(event) => setToken(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn("h-9", error && "aria-invalid:border-destructive")}
        />
        <p className="text-xs text-muted-foreground">
          Create one under{" "}
          <a
            href="https://id.getharvest.com/developers"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-3 hover:text-foreground"
          >
            Harvest → Developers → Personal access tokens
          </a>
          . Credentials are encrypted before they are stored.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="harvest-account">Harvest Account ID</Label>
        <Input
          key={`account-${success ?? "idle"}`}
          id="harvest-account"
          name="accountId"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 2468101"
          autoComplete="off"
          value={success ? "" : accountId}
          onChange={(event) => setAccountId(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn("h-9", error && "aria-invalid:border-destructive")}
        />
        <p className="text-xs text-muted-foreground">
          Find it next to the account name in the{" "}
          <a
            href="https://id.getharvest.com/account"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-3 hover:text-foreground"
          >
            Harvest account switcher
          </a>
          .
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-9" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <Carrot />
              {onCancel ? "Save credentials" : "Connect Harvest"}
            </>
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-9"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function HarvestSettingsCard({
  connection,
  canManage,
  clients,
  members,
}: HarvestSettingsCardProps) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (
      !window.confirm("Disconnect Harvest? Existing imported entries will be kept.")
    ) {
      return;
    }
    setDisconnecting(true);
    const result = await disconnectHarvest();
    setDisconnecting(false);
    if (result.success) {
      toast.success(result.success);
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not disconnect Harvest.");
    }
  }

  const showUpdate =
    Boolean(connection) &&
    connection !== null &&
    connection.lastSyncStatus === "FAILED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Carrot className="size-4 text-muted-foreground" />
          Harvest
        </CardTitle>
        <CardDescription>
          Import tracked time from Harvest into your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!connection ? (
          canManage ? (
            <ConnectForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Harvest hasn&apos;t been connected yet. Only workspace owners can connect it.
            </p>
          )
        ) : editing ? (
          <ConnectForm onCancel={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Connected account</dt>
                <dd className="text-sm font-medium text-foreground">
                  {connection.name || "Harvest account"}
                  {connection.email && (
                    <span className="block text-sm font-normal text-muted-foreground">
                      {connection.email}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Company</dt>
                <dd className="text-sm font-medium text-foreground">
                  {connection.company || "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={connection.lastSyncStatus} />
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Last sync</dt>
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
                {showUpdate && (
                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                  >
                    <KeyRound />
                    Update credentials
                  </Button>
                )}
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
        <HarvestImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          clients={clients}
          members={members}
        />
      )}
    </Card>
  );
}
