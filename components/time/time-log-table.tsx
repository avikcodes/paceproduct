"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  FileUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Timer,
  Trash2,
  Users,
} from "lucide-react";
import { deleteTimeEntry } from "@/app/(app)/dashboard/time/actions";
import {
  formatHours,
  formatWorkDate,
  memberLabel,
  type ClientOption,
  type MemberOption,
  type TimeEntryRow,
} from "@/lib/time";
import { getInitials } from "@/lib/format";
import { CsvImportDialog } from "@/components/time/csv-import-dialog";
import { TimeEntryFormDialog } from "@/components/time/time-entry-form-dialog";
import { SourceBadge } from "@/components/time/source-badge";
import { ButtonLink } from "@/components/ui/button-link";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

type DateFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "YEAR";

const DATE_FILTER_ITEMS: Record<string, string> = {
  ALL: "All dates",
  TODAY: "Today",
  WEEK: "This week",
  MONTH: "This month",
  YEAR: "This year",
};

function sortEntries(entries: TimeEntryRow[]): TimeEntryRow[] {
  return [...entries].sort((a, b) => {
    if (b.workDate.getTime() !== a.workDate.getTime()) {
      return b.workDate.getTime() - a.workDate.getTime();
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function matchesDateFilter(date: Date, filter: DateFilter): boolean {
  const now = new Date();
  const todayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const value = date.getTime();

  switch (filter) {
    case "TODAY":
      return value >= todayStart && value < todayStart + 86_400_000;
    case "WEEK":
      return value >= todayStart - 6 * 86_400_000;
    case "MONTH":
      return (
        date.getUTCFullYear() === now.getUTCFullYear() &&
        date.getUTCMonth() === now.getUTCMonth()
      );
    case "YEAR":
      return date.getUTCFullYear() === now.getUTCFullYear();
    default:
      return true;
  }
}

export function TimeLogTable({
  initialEntries,
  clients,
  members,
  currentMemberId,
  canEditAll,
}: {
  initialEntries: TimeEntryRow[];
  clients: ClientOption[];
  members: MemberOption[];
  currentMemberId?: string | null;
  canEditAll?: boolean;
}) {
  const [entries, setEntries] = useState<TimeEntryRow[]>(initialEntries);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [memberFilter, setMemberFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [page, setPage] = useState(1);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntryRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const canLog = clients.length > 0 && members.length > 0;

  const canEditEntry = (entry: TimeEntryRow) =>
    canEditAll === true || entry.memberId === currentMemberId;

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients],
  );

  function openCreate() {
    setEditingEntry(null);
    setIsFormOpen(true);
  }

  function openEdit(entry: TimeEntryRow) {
    setEditingEntry(entry);
    setIsFormOpen(true);
  }

  function handleImported(entries: TimeEntryRow[]) {
    setEntries((prev) => sortEntries([...entries, ...prev]));
    setPage(1);
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (
        clientFilter !== "ALL" &&
        entry.clientId !== clientFilter
      ) {
        return false;
      }
      if (
        memberFilter !== "ALL" &&
        entry.memberId !== memberFilter
      ) {
        return false;
      }
      if (dateFilter !== "ALL" && !matchesDateFilter(entry.workDate, dateFilter)) {
        return false;
      }
      if (!normalized) return true;
      return [
        entry.task,
        entry.clientName,
        entry.memberName,
        entry.memberEmail,
      ]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(normalized));
    });
  }, [entries, query, clientFilter, memberFilter, dateFilter]);

  const totalHours = filtered.reduce((sum, entry) => sum + entry.hours, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function handleCreated(entry: TimeEntryRow) {
    setEntries((prev) => sortEntries([entry, ...prev]));
    setPage(1);
    toast.success("Time entry created.");
  }

  function handleUpdated(entry: TimeEntryRow) {
    setEntries((prev) =>
      sortEntries(prev.map((item) => (item.id === entry.id ? entry : item))),
    );
    toast.success("Time entry updated.");
  }

  async function runDelete() {
    const target = deleteTarget;
    if (!target || pendingId) return;
    setPendingId(target.id);

    const previous = target;
    setEntries((prev) => prev.filter((item) => item.id !== target.id));

    const result = await deleteTimeEntry(target.id);
    setPendingId(null);

    if (result.ok) {
      setDeleteTarget(null);
      toast.success("Time entry deleted.");
    } else {
      setEntries((prev) => sortEntries([...prev, previous]));
      toast.error(result.error);
    }
  }

  function clearFilters() {
    setQuery("");
    setClientFilter("ALL");
    setMemberFilter("ALL");
    setDateFilter("ALL");
    setPage(1);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 2xl:flex-row 2xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search time entries…"
              aria-label="Search time entries"
              className="pl-8"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={clientFilter}
              onValueChange={(value) => {
                setClientFilter(value ?? "ALL");
                setPage(1);
              }}
              items={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
            >
              <SelectTrigger
                aria-label="Filter by client"
                className="w-full sm:w-[160px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={memberFilter}
              onValueChange={(value) => {
                setMemberFilter(value ?? "ALL");
                setPage(1);
              }}
              items={Object.fromEntries(members.map((m) => [m.id, memberLabel(m)]))}
            >
              <SelectTrigger
                aria-label="Filter by team member"
                className="w-full sm:w-[160px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All members</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {memberLabel(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={dateFilter}
              onValueChange={(value) => {
                setDateFilter(value as DateFilter);
                setPage(1);
              }}
              items={DATE_FILTER_ITEMS}
            >
              <SelectTrigger
                aria-label="Filter by date"
                className="w-full sm:w-[140px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(DATE_FILTER_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              disabled={!canLog}
              className="shrink-0"
            >
              <FileUp />
              Import
            </Button>
            <Button onClick={openCreate} disabled={!canLog} className="shrink-0">
              <Plus />
              Log Time
            </Button>
          </div>
        </div>

        {entries.length === 0 ? (
          clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Create a client before logging time so entries have somewhere to go."
              action={
                <ButtonLink href="/dashboard/clients">
                  <Plus />
                  Add a client
                </ButtonLink>
              }
            />
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members yet"
              description="Invite a team member to the workspace before logging time."
              action={
                <ButtonLink href="/settings/team">
                  <Plus />
                  Invite a member
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={Timer}
              title="No time logged yet"
              description="Log your first time entry to start tracking billable hours."
              action={
                <Button onClick={openCreate}>
                  <Plus />
                  Log time
                </Button>
              }
            />
          )
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No time entries found"
            description="No entries match your search or filters. Try adjusting the criteria."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Team member</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {formatWorkDate(entry.workDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-sm shadow-blue-900/20">
                          {getInitials(entry.clientName)}
                        </div>
                        <Link
                          href={`/dashboard/clients/${entry.clientId}`}
                          className="max-w-[180px] truncate font-medium text-foreground transition-colors rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {clientNameById.get(entry.clientId) ?? entry.clientName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback>
                            {getInitials(entry.memberName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {entry.memberName}
                          </span>
                          {entry.memberEmail && (
                            <span className="truncate text-xs text-muted-foreground">
                              {entry.memberEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-2 max-w-[280px] text-foreground">
                        {entry.task}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium tabular-nums text-foreground">
                        {formatHours(entry.hours)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <SourceBadge source={entry.source} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canEditEntry(entry) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${entry.task}`}
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(entry)}>
                              <Pencil />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(entry)}
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
              Showing {startIndex}–{endIndex} of {filtered.length} ·{" "}
              {formatHours(totalHours)} total
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

      <TimeEntryFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        entry={editingEntry}
        clients={clients}
        members={members}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
      />

      <CsvImportDialog
        key={isImportOpen ? "import-open" : "import-closed"}
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        clients={clients}
        members={members}
        onImported={handleImported}
      />

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
            <AlertDialogTitle>Delete time entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium text-foreground">
                    {formatHours(deleteTarget.hours)}
                  </span>{" "}
                  logged for{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.clientName}
                  </span>{" "}
                  will be permanently deleted. This can&apos;t be undone.
                </>
              ) : (
                "This time entry will be permanently deleted. This can't be undone."
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
    </Card>
  );
}
