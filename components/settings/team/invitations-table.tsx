"use client";

import { useTransition } from "react";
import { CheckCircle2, Clock, Inbox, Mail, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { cancelInvitation } from "@/app/(app)/settings/team/actions";
import { formatDate } from "@/lib/format";
import type { InvitationStatus, Role } from "@/lib/generated/prisma/enums";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InvitationRow = {
  id: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  expired: boolean;
};

const STATUS_META: Record<
  InvitationStatus,
  { label: string; variant: "secondary" | "outline" | "ghost"; icon: typeof Clock }
> = {
  PENDING: { label: "Pending", variant: "secondary", icon: Clock },
  ACCEPTED: { label: "Accepted", variant: "outline", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", variant: "ghost", icon: Ban },
};

export function InvitationsTable({
  invitations,
}: {
  invitations: InvitationRow[];
}) {
  const [isPending, startTransition] = useTransition();

  function onCancel(invitationId: string) {
    startTransition(async () => {
      const result = await cancelInvitation(invitationId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success) {
        toast.success(result.success);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          Invitations
          {invitations.length > 0 && (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {invitations.length}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Invite people to your workspace and track who has accepted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={Inbox}
            title="No invitations yet"
            description="Invite a teammate above and they'll show up here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const meta = STATUS_META[invitation.status];
                const expired =
                  invitation.status === "PENDING" && invitation.expired;
                return (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Mail className="size-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">
                          {invitation.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invitation.role === "OWNER" ? "Owner" : "Member"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>
                        <meta.icon className="size-3" />
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invitation.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {expired ? (
                        <span className="text-destructive">Expired</span>
                      ) : invitation.expiresAt ? (
                        formatDate(invitation.expiresAt)
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {invitation.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => onCancel(invitation.id)}
                        >
                          <X />
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}