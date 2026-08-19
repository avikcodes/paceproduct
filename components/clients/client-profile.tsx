"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArrowLeft,
  BarChart3,
  Building2,
  DollarSign,
  ExternalLink,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import {
  archiveClient,
  deleteClient,
} from "@/app/(app)/dashboard/clients/actions";
import { deleteRetainer } from "@/app/(app)/dashboard/clients/[clientId]/actions";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientMarginSummaryCard } from "@/components/clients/client-margin-summary-card";
import { BudgetForecastCard } from "@/components/clients/budget-forecast-card";
import { ScopeUsageCard } from "@/components/clients/scope-usage-card";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { MarginThresholdsCard } from "@/components/clients/margin-thresholds-card";
import { MarginThresholdsFormDialog } from "@/components/clients/margin-thresholds-form-dialog";
import { RetainerFormDialog } from "@/components/clients/retainer-form-dialog";
import { PdfReportButton } from "@/components/clients/pdf-report-button";
import { clientStatusLabel, type ClientRow } from "@/lib/clients";
import type { ClientStatus } from "@/lib/generated/prisma/enums";
import { getInitials, formatDate } from "@/lib/format";
import type { MarginSummary } from "@/lib/margins";
import type { MarginThresholds } from "@/lib/margin-status";
import type { BudgetForecast } from "@/lib/budget";
import type { ScopeUsage } from "@/lib/scope";
import {
  billingCycleLabel,
  billingCycleRateLabel,
  formatMoney,
  formatRetainerDate,
  type RetainerRow,
} from "@/lib/retainers";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
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

const STATUS_DOT_STYLES: Record<ClientStatus, string> = {
  ACTIVE: "text-emerald-500",
  PAUSED: "text-amber-500",
  ARCHIVED: "text-muted-foreground",
};

function withProtocol(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <div className="min-w-0 text-sm font-medium text-foreground">
        {children}
      </div>
    </div>
  );
}

function EmptyValue() {
  return <span className="font-normal text-muted-foreground">—</span>;
}

function RetainerStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border-transparent",
        isActive
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {isActive ? "Active" : "Paused"}
    </Badge>
  );
}

function ClientInformationCard({
  client,
  onEdit,
  canEdit,
}: {
  client: ClientRow;
  onEdit: () => void;
  canEdit: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          Client information
        </CardTitle>
        {canEdit && (
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Edit client information"
              onClick={onEdit}
            >
              <Pencil />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <DetailItem label="Company">
            {client.company ? client.company : <EmptyValue />}
          </DetailItem>
          <DetailItem label="Website">
            {client.website ? (
              <a
                href={withProtocol(client.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {client.website}
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : (
              <EmptyValue />
            )}
          </DetailItem>
          <DetailItem label="Status">
            <ClientStatusBadge status={client.status} />
          </DetailItem>
          <DetailItem label="Created">
            {formatDate(client.createdAt)}
          </DetailItem>
        </div>
        {client.notes && (
          <div className="mt-6 border-t border-border pt-5">
            <SectionLabel>Notes</SectionLabel>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {client.notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrimaryContactCard({ client }: { client: ClientRow }) {
  const hasContact = Boolean(
    client.contactName || client.contactEmail || client.phone,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          Primary contact
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasContact ? (
          <div className="flex items-start gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white">
                {getInitials(client.contactName ?? client.contactEmail ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1.5">
              {client.contactName && (
                <span className="truncate font-medium text-foreground">
                  {client.contactName}
                </span>
              )}
              {client.contactEmail && (
                <a
                  href={`mailto:${client.contactEmail}`}
                  className="inline-flex items-center gap-1.5 truncate rounded-sm text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Mail className="size-3.5 shrink-0" />
                  {client.contactEmail}
                </a>
              )}
              {client.phone && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="size-3.5 shrink-0" />
                  {client.phone}
                </span>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            className="py-8"
            icon={User}
            title="No primary contact"
            description="Add a contact name, email, or phone from the client editor."
          />
        )}
      </CardContent>
    </Card>
  );
}

function RetainerInformationCard({
  retainer,
  onCreate,
  onEdit,
  onDelete,
  canManage,
}: {
  retainer: RetainerRow | null;
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="size-4 text-muted-foreground" />
          Retainer information
        </CardTitle>
        {retainer && canManage && (
          <CardAction className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Edit retainer"
              onClick={onEdit}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Delete retainer"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {retainer ? (
          <>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <DetailItem label="Billed amount">
                <span className="text-lg font-semibold text-foreground">
                  {formatMoney(retainer.monthlyBudget, retainer.currency)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {billingCycleRateLabel(retainer.billingCycle)}
                  </span>
                </span>
              </DetailItem>
              <DetailItem label="Scope hours">
                <span className="text-lg font-semibold text-foreground">
                  {retainer.scopeHours.toLocaleString("en")}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    hrs/month
                  </span>
                </span>
              </DetailItem>
              <DetailItem label="Billing cycle">
                {billingCycleLabel(retainer.billingCycle)}
              </DetailItem>
              <DetailItem label="Status">
                <RetainerStatusBadge isActive={retainer.isActive} />
              </DetailItem>
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <SectionLabel>Period</SectionLabel>
              <p className="mt-1.5 text-sm font-medium text-foreground">
                {formatRetainerDate(retainer.startDate)}
                <span className="text-muted-foreground"> – </span>
                {retainer.endDate ? (
                  formatRetainerDate(retainer.endDate)
                ) : (
                  <span className="text-muted-foreground">Present</span>
                )}
              </p>
            </div>
          </>
        ) : (
          <EmptyState
            className="py-10"
            icon={DollarSign}
            title="No retainer yet"
            description="Set up a recurring budget and scope hours for this client."
            action={
              canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCreate}
                >
                  <Plus />
                  Create retainer
                </Button>
              ) : undefined
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <div className="truncate text-lg leading-snug font-semibold text-foreground">
        {children}
      </div>
    </div>
  );
}

function QuickStatsCard({
  client,
  retainer,
}: {
  client: ClientRow;
  retainer: RetainerRow | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          Quick stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <StatTile label="Billed amount">
            {retainer ? (
              <>
                {formatMoney(retainer.monthlyBudget, retainer.currency)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {billingCycleRateLabel(retainer.billingCycle)}
                </span>
              </>
            ) : (
              <EmptyValue />
            )}
          </StatTile>
          <StatTile label="Scope hrs">
            {retainer ? retainer.scopeHours.toLocaleString("en") : <EmptyValue />}
          </StatTile>
          <StatTile label="Billing cycle">
            {retainer ? billingCycleLabel(retainer.billingCycle) : <EmptyValue />}
          </StatTile>
          <StatTile label="Status">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full bg-current",
                  STATUS_DOT_STYLES[client.status],
                )}
              />
              {clientStatusLabel(client.status)}
            </span>
          </StatTile>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsCard({
  hasRetainer,
  isArchived,
  canManageClients,
  canManageRetainers,
  onEditClient,
  onEditRetainer,
  onArchive,
  onDelete,
}: {
  hasRetainer: boolean;
  isArchived: boolean;
  canManageClients: boolean;
  canManageRetainers: boolean;
  onEditClient: () => void;
  onEditRetainer: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="size-4 text-muted-foreground" />
          Quick actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {canManageClients && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={onEditClient}
          >
            <Pencil />
            Edit client
          </Button>
        )}
        {canManageRetainers && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={onEditRetainer}
          >
            {hasRetainer ? <Pencil /> : <Plus />}
            {hasRetainer ? "Edit retainer" : "Create retainer"}
          </Button>
        )}
        {canManageClients && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={onArchive}
            disabled={isArchived}
          >
            <Archive />
            {isArchived ? "Archived" : "Archive"}
          </Button>
        )}
        {canManageClients && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 />
            Delete
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ClientProfile({
  client,
  retainer,
  margin,
  thresholds,
  forecast,
  scopeUsage,
  canManageClients,
  canManageRetainers,
}: {
  client: ClientRow;
  retainer: RetainerRow | null;
  margin: MarginSummary;
  thresholds: MarginThresholds;
  forecast: BudgetForecast | null;
  scopeUsage: ScopeUsage | null;
  canManageClients: boolean;
  canManageRetainers: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const [retainerOpen, setRetainerOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRetainerOpen, setDeleteRetainerOpen] = useState(false);

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveClient(client.id);
      if (result.ok) {
        toast.success("Client archived.");
        setArchiveOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClient(client.id);
      if (result.ok) {
        toast.success("Client deleted.");
        router.push("/dashboard/clients");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDeleteRetainer() {
    if (!retainer) return;
    startTransition(async () => {
      const result = await deleteRetainer(retainer.id);
      if (result.ok) {
        toast.success("Retainer deleted.");
        setDeleteRetainerOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex animate-in flex-col gap-6 fade-in-0 duration-200">
      <Link
        href="/dashboard/clients"
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft className="size-4" />
        Back to clients
      </Link>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar size="lg">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white shadow-sm shadow-blue-900/20">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {client.name}
              </h1>
              <ClientStatusBadge status={client.status} />
            </div>
            {client.company && (
              <p className="truncate text-sm text-muted-foreground">
                {client.company}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PdfReportButton clientId={client.id} />
          {canManageClients && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditClientOpen(true)}
            >
              <Pencil />
              Edit client
            </Button>
          )}
          {(canManageClients || canManageRetainers) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Client actions"
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManageRetainers && (
                  <DropdownMenuItem onClick={() => setRetainerOpen(true)}>
                    <DollarSign />
                    {retainer ? "Edit retainer" : "Create retainer"}
                  </DropdownMenuItem>
                )}
                {canManageClients && (
                  <DropdownMenuItem
                    onClick={() => setArchiveOpen(true)}
                    disabled={client.status === "ARCHIVED"}
                  >
                    <Archive />
                    {client.status === "ARCHIVED" ? "Archived" : "Archive"}
                  </DropdownMenuItem>
                )}
                {canManageRetainers && retainer && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteRetainerOpen(true)}
                    >
                      <Trash2 />
                      Delete retainer
                    </DropdownMenuItem>
                  </>
                )}
                {canManageClients && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ClientMarginSummaryCard clientId={client.id} margin={margin} />
          <BudgetForecastCard forecast={forecast} />
          <ScopeUsageCard usage={scopeUsage} />
          <MarginThresholdsCard
            thresholds={thresholds}
            onEdit={() => setThresholdsOpen(true)}
            canEdit={canManageClients}
          />
          <ClientInformationCard
            client={client}
            onEdit={() => setEditClientOpen(true)}
            canEdit={canManageClients}
          />
          <RetainerInformationCard
            retainer={retainer}
            onCreate={() => setRetainerOpen(true)}
            onEdit={() => setRetainerOpen(true)}
            onDelete={() => setDeleteRetainerOpen(true)}
            canManage={canManageRetainers}
          />
          <PrimaryContactCard client={client} />
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <QuickStatsCard client={client} retainer={retainer} />
          <QuickActionsCard
            hasRetainer={Boolean(retainer)}
            isArchived={client.status === "ARCHIVED"}
            canManageClients={canManageClients}
            canManageRetainers={canManageRetainers}
            onEditClient={() => setEditClientOpen(true)}
            onEditRetainer={() => setRetainerOpen(true)}
            onArchive={() => setArchiveOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        </aside>
      </div>

      <ClientFormDialog
        open={editClientOpen}
        onOpenChange={setEditClientOpen}
        client={client}
        onCreated={() => router.refresh()}
        onUpdated={() => router.refresh()}
      />

      <MarginThresholdsFormDialog
        open={thresholdsOpen}
        onOpenChange={setThresholdsOpen}
        clientId={client.id}
        thresholds={thresholds}
        onSaved={() => router.refresh()}
      />

      <RetainerFormDialog
        open={retainerOpen}
        onOpenChange={setRetainerOpen}
        clientId={client.id}
        retainer={retainer}
        onSaved={() => router.refresh()}
      />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Archive />
            </AlertDialogMedia>
            <AlertDialogTitle>Archive {client.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The client will be marked as archived and hidden from the active
              list, but its records will be kept for reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={handleArchive}
              disabled={isPending}
            >
              {isPending && <Loader2 className="animate-spin" />}
              Archive
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the client and its retainer. This action
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending && <Loader2 className="animate-spin" />}
              Delete
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteRetainerOpen}
        onOpenChange={setDeleteRetainerOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete retainer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the retainer for{" "}
              <span className="font-medium text-foreground">{client.name}</span>.
              This action can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={handleDeleteRetainer}
              disabled={isPending}
            >
              {isPending && <Loader2 className="animate-spin" />}
              Delete
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
