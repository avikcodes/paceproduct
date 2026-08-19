"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Check,
  Loader2,
  Minus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  archiveClient,
  deleteClient,
  type ClientActionResult,
} from "@/app/(app)/dashboard/clients/actions";
import {
  archiveClients,
  deleteClients,
} from "@/app/(app)/dashboard/admin/clients/actions";
import { type AdminClientRow } from "@/lib/admin";
import type { ClientStatus } from "@/lib/generated/prisma/enums";
import type { ClientRow } from "@/lib/clients";
import { getInitials, formatDate } from "@/lib/format";
import { billingCycleRateLabel, formatMoney } from "@/lib/retainers";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

type StatusFilter = "ALL" | ClientStatus;

const STATUS_FILTER_ITEMS: Record<string, string> = {
  ALL: "All statuses",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};

const STATUS_RANK: Record<ClientStatus, number> = {
  ACTIVE: 0,
  PAUSED: 1,
  ARCHIVED: 2,
};

type SortKey = "name" | "status" | "monthlyBudget" | "scopeHours" | "createdAt";
type SortDir = "asc" | "desc";

function sortValue(client: AdminClientRow, key: SortKey): number | string {
  switch (key) {
    case "name":
      return client.name.toLowerCase();
    case "status":
      return STATUS_RANK[client.status];
    case "monthlyBudget":
      return client.monthlyBudget ?? -1;
    case "scopeHours":
      return client.scopeHours ?? -1;
    case "createdAt":
      return client.createdAt.getTime();
  }
}

function TableCheckbox({
  checked,
  indeterminate,
  onToggle,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        checked || indeterminate
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:border-primary/60",
      )}
    >
      {checked ? (
        <Check className="size-3" strokeWidth={3} />
      ) : indeterminate ? (
        <Minus className="size-3" strokeWidth={3} />
      ) : null}
    </button>
  );
}

function SortableHead({
  label,
  sortKey,
  current,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const isActive = current.key === sortKey;
  const Icon = isActive
    ? current.dir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead
      aria-sort={
        isActive
          ? current.dir === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-xs font-medium tracking-wide uppercase outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          align === "right" && "justify-end",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3.5",
            !isActive && "opacity-50",
          )}
        />
      </button>
    </TableHead>
  );
}

export function AdminClientsTable({
  initialClients,
}: {
  initialClients: AdminClientRow[];
}) {
  const [clients, setClients] = useState<AdminClientRow[]>(initialClients);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "createdAt",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<AdminClientRow | null>(
    null,
  );
  const [archiveTarget, setArchiveTarget] = useState<AdminClientRow | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminClientRow | null>(null);
  const [isBulkArchiveOpen, setIsBulkArchiveOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

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
        .some((value) =>
          (value as string).toLowerCase().includes(normalized),
        );
    });
  }, [clients, query, statusFilter]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av === bv) return a.name.localeCompare(b.name) * dir;
      const comparison =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : Number(av) - Number(bv);
      return comparison * dir;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, sorted.length);
  const paginated = sorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((client) => selectedIds.has(client.id));
  const someFilteredSelected = filtered.some((client) =>
    selectedIds.has(client.id),
  );

  function handleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return {
        key,
        dir: key === "name" || key === "status" ? "asc" : "desc",
      };
    });
    setPage(1);
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((client) => next.delete(client.id));
      } else {
        filtered.forEach((client) => next.add(client.id));
      }
      return next;
    });
  }

  function openEdit(client: AdminClientRow) {
    setEditingClient(client);
    setIsFormOpen(true);
  }

  function handleUpdated(client: ClientRow) {
    setClients((prev) =>
      prev.map((item) =>
        item.id === client.id ? { ...item, ...client } : item,
      ),
    );
    toast.success("Client updated.");
  }

  async function runArchive() {
    const target = archiveTarget;
    if (!target || pendingId) return;
    setPendingId(target.id);

    const result: ClientActionResult<ClientRow> = await archiveClient(
      target.id,
    );
    setPendingId(null);

    if (result.ok) {
      setClients((prev) =>
        prev.map((item) =>
          item.id === target.id ? { ...item, status: "ARCHIVED" } : item,
        ),
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      setArchiveTarget(null);
      toast.success("Client archived.");
    } else {
      toast.error(result.error);
    }
  }

  async function runDelete() {
    const target = deleteTarget;
    if (!target || pendingId) return;
    setPendingId(target.id);

    const result = await deleteClient(target.id);
    setPendingId(null);

    if (result.ok) {
      setClients((prev) => prev.filter((item) => item.id !== target.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      setDeleteTarget(null);
      toast.success("Client deleted.");
    } else {
      toast.error(result.error);
    }
  }

  async function runBulkArchive() {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkPending) return;
    setBulkPending(true);

    const result = await archiveClients(ids);
    setBulkPending(false);

    if (result.ok) {
      setClients((prev) =>
        prev.map((item) =>
          selectedIds.has(item.id) ? { ...item, status: "ARCHIVED" } : item,
        ),
      );
      setSelectedIds(new Set());
      setIsBulkArchiveOpen(false);
      toast.success(
        `${result.affectedCount} ${result.affectedCount === 1 ? "client" : "clients"} archived.`,
      );
    } else {
      toast.error(result.error);
    }
  }

  async function runBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkPending) return;
    setBulkPending(true);

    const result = await deleteClients(ids);
    setBulkPending(false);

    if (result.ok) {
      setClients((prev) =>
        prev.filter((item) => !selectedIds.has(item.id)),
      );
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
      toast.success(
        `${result.affectedCount} ${result.affectedCount === 1 ? "client" : "clients"} deleted.`,
      );
    } else {
      toast.error(result.error);
    }
  }

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
    setPage(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          All clients
          <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {clients.length}
          </span>
        </CardTitle>
        <CardDescription>
          Every client in this workspace with retainer and scope data.
        </CardDescription>
      </CardHeader>

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
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
            <span className="text-sm font-medium text-foreground tabular-nums">
              {selectedCount} {selectedCount === 1 ? "client" : "clients"}{" "}
              selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBulkArchiveOpen(true)}
                disabled={bulkPending}
              >
                <Archive />
                Archive selected
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteOpen(true)}
                disabled={bulkPending}
              >
                <Trash2 />
                Delete selected
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedIds(new Set())}
                aria-label="Clear selection"
              >
                <X />
              </Button>
            </div>
          </div>
        )}

        {clients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No clients yet"
            description="Create a client from the Clients page and it will show up here."
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No clients found"
            description="No clients match your search or filters."
            action={
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-10">
                      <TableCheckbox
                        checked={allFilteredSelected}
                        indeterminate={
                          !allFilteredSelected && someFilteredSelected
                        }
                        onToggle={toggleAll}
                        label="Select all clients"
                      />
                    </TableHead>
                    <SortableHead
                      label="Client"
                      sortKey="name"
                      current={sort}
                      onSort={handleSort}
                    />
                    <SortableHead
                      label="Status"
                      sortKey="status"
                      current={sort}
                      onSort={handleSort}
                    />
                    <SortableHead
                      label="Retainer amount"
                      sortKey="monthlyBudget"
                      current={sort}
                      onSort={handleSort}
                    />
                    <SortableHead
                      label="Scope hours"
                      sortKey="scopeHours"
                      current={sort}
                      onSort={handleSort}
                    />
                    <SortableHead
                      label="Created"
                      sortKey="createdAt"
                      current={sort}
                      onSort={handleSort}
                    />
                    <TableHead className="w-10 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((client) => {
                    const isSelected = selectedIds.has(client.id);
                    return (
                      <TableRow
                        key={client.id}
                        data-state={isSelected ? "selected" : undefined}
                        className={cn(isSelected && "bg-muted/30")}
                      >
                        <TableCell>
                          <TableCheckbox
                            checked={isSelected}
                            onToggle={() => toggleOne(client.id)}
                            label={`Select ${client.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-sm shadow-blue-900/20">
                              {getInitials(client.name)}
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <Link
                                href={`/dashboard/clients/${client.id}`}
                                className="truncate rounded-sm font-medium text-foreground outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                          <ClientStatusBadge status={client.status} />
                        </TableCell>
                        <TableCell>
                          {client.monthlyBudget !== null ? (
                            <span className="text-foreground tabular-nums">
                              {formatMoney(
                                client.monthlyBudget,
                                client.currency ?? "USD",
                              )}
                              {client.billingCycle && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {billingCycleRateLabel(client.billingCycle)}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.scopeHours !== null ? (
                            <span className="text-foreground tabular-nums">
                              {client.scopeHours}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(client.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
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
                              <DropdownMenuItem
                                onClick={() => openEdit(client)}
                              >
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex}–{endIndex} of {sorted.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                >
                  Previous
                </Button>
                <Button
                  type="button"
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
          </>
        )}
      </CardContent>

      <ClientFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={editingClient}
        onCreated={(client) =>
          setClients((prev) => [client as AdminClientRow, ...prev])
        }
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

      <AlertDialog
        open={isBulkArchiveOpen}
        onOpenChange={setIsBulkArchiveOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Archive />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Archive {selectedCount}{" "}
              {selectedCount === 1 ? "client" : "clients"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The selected clients will be marked as archived and hidden from
              the active list. Their records will be kept for reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={runBulkArchive}
              disabled={bulkPending}
            >
              {bulkPending && <Loader2 className="animate-spin" />}
              Archive
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Delete {selectedCount} {selectedCount === 1 ? "client" : "clients"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The selected clients will be permanently deleted, including any
              associated data. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={runBulkDelete}
              disabled={bulkPending}
            >
              {bulkPending && <Loader2 className="animate-spin" />}
              Delete
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
