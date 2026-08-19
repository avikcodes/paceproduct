"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  archiveClient,
  deleteClient,
  listClients,
} from "@/app/(app)/dashboard/clients/actions";
import { CLIENT_IMPORT_SPEC } from "@/lib/imports/clients";
import { RETAINER_IMPORT_SPEC } from "@/lib/imports/retainers";
import { type ClientRow } from "@/lib/clients";
import type { ClientStatus } from "@/lib/generated/prisma/enums";
import type { MarginSummary } from "@/lib/margins";
import type { ScopeUsage } from "@/lib/scope";
import { formatPercent } from "@/lib/margin-status";
import { getInitials, formatDate } from "@/lib/format";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { MarginStatusBadge } from "@/components/clients/margin-status-badge";
import { ScopeProgress } from "@/components/clients/scope-progress";
import { SpecImportDialog } from "@/components/import/spec-import-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

type StatusFilter = "ALL" | ClientStatus;

const STATUS_FILTER_ITEMS: Record<string, string> = {
  ALL: "All statuses",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};

export function ClientsTable({
  initialClients,
  initialMargins,
  initialScope,
  canManageClients,
  canManageRetainers = false,
  activeRetainerClientIds = [],
}: {
  initialClients: ClientRow[];
  initialMargins: Record<string, MarginSummary>;
  initialScope: Record<string, ScopeUsage>;
  canManageClients: boolean;
  canManageRetainers?: boolean;
  activeRetainerClientIds?: string[];
}) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [importKind, setImportKind] = useState<"clients" | "retainers" | null>(
    null,
  );

  function openCreate() {
    setEditingClient(null);
    setIsFormOpen(true);
  }

  function openEdit(client: ClientRow) {
    setEditingClient(client);
    setIsFormOpen(true);
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (statusFilter !== "ALL" && client.status !== statusFilter) {
        return false;
      }
      if (!normalized) return true;
      return [
        client.name,
        client.company,
        client.contactName,
        client.contactEmail,
      ]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(normalized));
    });
  }, [clients, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function handleCreated(client: ClientRow) {
    setClients((prev) => [client, ...prev]);
    setPage(1);
    toast.success("Client created.");
  }

  function handleUpdated(client: ClientRow) {
    setClients((prev) =>
      prev.map((item) => (item.id === client.id ? client : item)),
    );
    toast.success("Client updated.");
  }

  async function refreshClients() {
    try {
      const fresh = await listClients();
      setClients(fresh);
    } catch {
      // The server re-render below still refreshes the page.
    }
  }

  async function runArchive() {
    const target = archiveTarget;
    if (!target || pendingId) return;
    setPendingId(target.id);

    const previous = target;
    setClients((prev) =>
      prev.map((item) =>
        item.id === target.id ? { ...item, status: "ARCHIVED" as const } : item,
      ),
    );

    const result = await archiveClient(target.id);
    setPendingId(null);

    if (result.ok) {
      setArchiveTarget(null);
      setClients((prev) =>
        prev.map((item) => (item.id === target.id ? result.data : item)),
      );
      toast.success("Client archived.");
    } else {
      setClients((prev) =>
        prev.map((item) => (item.id === target.id ? previous : item)),
      );
      toast.error(result.error);
    }
  }

  async function runDelete() {
    const target = deleteTarget;
    if (!target || pendingId) return;
    setPendingId(target.id);

    const previous = target;
    setClients((prev) => prev.filter((item) => item.id !== target.id));

    const result = await deleteClient(target.id);
    setPendingId(null);

    if (result.ok) {
      setDeleteTarget(null);
      toast.success("Client deleted.");
    } else {
      setClients((prev) =>
        [...prev, previous].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        ),
      );
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search clients…"
              aria-label="Search clients"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as StatusFilter);
                setPage(1);
              }}
              items={STATUS_FILTER_ITEMS}
            >
              <SelectTrigger
                aria-label="Filter by status"
                className="w-full sm:w-[150px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            {canManageClients && (
              <Button
                variant="outline"
                onClick={() => setImportKind("clients")}
                className="shrink-0"
              >
                <Upload />
                Import Clients
              </Button>
            )}
            {canManageRetainers && (
              <Button
                variant="outline"
                onClick={() => setImportKind("retainers")}
                className="shrink-0"
              >
                <Upload />
                Import Retainers
              </Button>
            )}
            {canManageClients && (
              <Button onClick={openCreate} className="shrink-0">
                <Plus />
                New Client
              </Button>
            )}
          </div>
        </div>

        {clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Create your first client to start tracking work and profitability."
            action={
              canManageClients ? (
                <Button onClick={openCreate}>
                  <Plus />
                  New Client
                </Button>
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No clients found"
            description="No clients match your search or filter. Try adjusting the criteria."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("ALL");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Company</TableHead>
                  <TableHead>Primary contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead className="min-w-[140px]">Scope</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-sm shadow-blue-900/20">
                          {getInitials(client.name)}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <Link
                            href={`/dashboard/clients/${client.id}`}
                            className="truncate font-medium text-foreground transition-colors rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {client.name}
                          </Link>
                          {client.company && (
                            <span className="truncate text-xs text-muted-foreground">
                              {client.company}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {client.contactName ? (
                          <span className="text-foreground">
                            {client.contactName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {client.contactEmail && (
                          <span className="truncate text-xs text-muted-foreground">
                            {client.contactEmail}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell>
                      {initialMargins[client.id] ? (
                        <div className="flex items-center gap-2">
                          <MarginStatusBadge
                            status={initialMargins[client.id].status}
                          />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatPercent(initialMargins[client.id].marginPercent)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {initialScope[client.id] ? (
                        <ScopeProgress usage={initialScope[client.id]} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(client.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageClients ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${client.name}`}
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(client)}>
                              <Pencil />
                              Edit
                            </DropdownMenuItem>
                            {client.status !== "ARCHIVED" && (
                              <DropdownMenuItem
                                onClick={() => setArchiveTarget(client)}
                              >
                                <Archive />
                                Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(client)}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex}–{endIndex} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={safePage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <ClientFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={editingClient}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
      />

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Archive />
            </AlertDialogMedia>
            <AlertDialogTitle>Archive client?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget ? (
                <>
                  <span className="font-medium text-foreground">
                    {archiveTarget.name}
                  </span>{" "}
                  will be marked as archived and hidden from the active list.
                  Its records will be kept for reference.
                </>
              ) : (
                "This client will be marked as archived."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={runArchive}
              disabled={pendingId !== null}
            >
              {pendingId === archiveTarget?.id && (
                <Loader2 className="animate-spin" />
              )}
              Archive
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium text-foreground">
                    {deleteTarget.name}
                  </span>{" "}
                  will be permanently deleted, including any associated data.
                  This can&apos;t be undone.
                </>
              ) : (
                "This client will be permanently deleted. This can't be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={runDelete}
              disabled={pendingId !== null}
            >
              {pendingId === deleteTarget?.id && (
                <Loader2 className="animate-spin" />
              )}
              Delete
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SpecImportDialog
        key={importKind === "clients" ? "clients-open" : "clients-closed"}
        open={importKind === "clients"}
        onOpenChange={(open) => {
          if (!open) setImportKind(null);
        }}
        spec={CLIENT_IMPORT_SPEC}
        endpoint="/api/clients/import"
        refs={{
          existingClientNames: clients.map((client) => client.name),
        }}
        onComplete={() => {
          void refreshClients();
          router.refresh();
        }}
      />

      <SpecImportDialog
        key={importKind === "retainers" ? "retainers-open" : "retainers-closed"}
        open={importKind === "retainers"}
        onOpenChange={(open) => {
          if (!open) setImportKind(null);
        }}
        spec={RETAINER_IMPORT_SPEC}
        endpoint="/api/retainers/import"
        refs={{
          clients: clients.map((client) => ({
            id: client.id,
            name: client.name,
          })),
          existingClientNames: clients.map((client) => client.name),
          existingActiveClients: activeRetainerClientIds,
        }}
        onComplete={() => router.refresh()}
      />
    </Card>
  );
}
