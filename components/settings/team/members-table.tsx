"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Crown, Merge, Pencil, Users, UserMinus } from "lucide-react";
import {
  changeMemberRole,
  mergeMembers,
  removeMember,
  type TeamActionState,
} from "@/app/(app)/settings/team/actions";
import { MemberRatesEditor } from "@/components/settings/team/member-rates-editor";
import { formatMoney } from "@/lib/retainers";
import type { CurrencyCode } from "@/lib/retainers";
import { getInitials, formatDate } from "@/lib/format";
import type { Role } from "@/lib/generated/prisma/enums";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export type MemberRow = {
  id: string;
  userId: string;
  role: Role;
  billingRate: number;
  costRate: number;
  currency: string;
  createdAt: Date;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
};

function RoleSelect({
  member,
  disabled,
  onRoleChange,
}: {
  member: MemberRow;
  disabled: boolean;
  onRoleChange: (memberId: string, role: Role) => void;
}) {
  return (
    <Select
      value={member.role}
      disabled={disabled}
      items={{ OWNER: "Owner", MEMBER: "Member" }}
      onValueChange={(value) => onRoleChange(member.id, value as Role)}
    >
      <SelectTrigger size="sm" aria-label={`Role for ${member.email ?? member.userId}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="OWNER">Owner</SelectItem>
        <SelectItem value="MEMBER">Member</SelectItem>
      </SelectContent>
    </Select>
  );
}

function MergeMemberDialog({
  keeper,
  candidates,
  disabled,
}: {
  keeper: MemberRow;
  candidates: MemberRow[];
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [duplicateId, setDuplicateId] = useState<string>("");

  function confirm() {
    if (!duplicateId) return;
    startTransition(async () => {
      const result = await mergeMembers(duplicateId, keeper.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Members merged.");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            title="Merge a duplicate member into this one"
            aria-label={`Merge duplicate member into ${keeper.name ?? keeper.email ?? "member"}`}
          >
            <Merge />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Merge />
          </AlertDialogMedia>
          <AlertDialogTitle>Merge duplicate member</AlertDialogTitle>
          <AlertDialogDescription>
            Move another member&apos;s time entries into{" "}
            {keeper.name ?? keeper.email ?? "this member"} and remove that
            member. Use this to fix duplicate member records where time
            entries point to the wrong member.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Select
          value={duplicateId}
          disabled={disabled || isPending}
          items={Object.fromEntries(
            candidates.map((member) => [
              member.id,
              `${member.name ?? "Unnamed member"}${member.email ? ` — ${member.email}` : ""} (cost ${formatMoney(member.costRate, member.currency)}/hr)`,
            ]),
          )}
          onValueChange={(value) => {
            if (value) setDuplicateId(value);
          }}
        >
          <SelectTrigger size="default" className="w-full">
            <SelectValue placeholder="Select member to merge" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name ?? "Unnamed member"}
                {member.email ? ` — ${member.email}` : ""} (cost{" "}
                {formatMoney(member.costRate, member.currency)}/hr)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogCancel
            variant="destructive"
            disabled={!duplicateId || disabled || isPending}
            onClick={confirm}
          >
            Merge
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MembersTable({
  members,
  currentUserId,
  canManage,
}: {
  members: MemberRow[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const ownerCount = members.filter((member) => member.role === "OWNER").length;

  function run(action: () => Promise<TeamActionState>) {
    startTransition(async () => {
      const result = await action();
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
          <Users className="size-4 text-muted-foreground" />
          Members
          <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {members.length}
          </span>
        </CardTitle>
        <CardDescription>
          People with access to this workspace.
          {canManage
            ? " Owners can invite members and edit roles and rates."
            : " You have read-only access. Only owners can invite members and edit roles and rates."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={Users}
            title="No members yet"
            description="Invite teammates to start collaborating."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Billing rate</TableHead>
                <TableHead className="hidden md:table-cell">Internal cost rate</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const isOwner = member.role === "OWNER";
                const isLastOwner = isOwner && ownerCount === 1;
                const isEditing = editingMemberId === member.id;

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {member.imageUrl && (
                            <AvatarImage
                              src={member.imageUrl}
                              alt={member.name ?? member.email ?? "Member avatar"}
                            />
                          )}
                          <AvatarFallback>
                            {getInitials(member.name ?? member.email ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            {member.name ?? "Unnamed member"}
                            {isOwner && (
                              <Crown className="size-3.5 text-amber-500" />
                            )}
                            {isSelf && (
                              <Badge
                                variant="outline"
                                className="rounded-full border-transparent bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
                              >
                                You
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {member.email ?? member.userId}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {!canManage || isSelf || isLastOwner ? (
                        <span
                          className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm font-medium",
                            isOwner
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "bg-muted text-muted-foreground",
                          )}
                          title={
                            isLastOwner
                              ? "This is the last owner and can't be demoted."
                              : undefined
                          }
                        >
                          {isOwner && <Crown className="size-3.5 text-amber-500" />}
                          {isOwner ? "Owner" : "Member"}
                        </span>
                      ) : (
                        <RoleSelect
                          member={member}
                          disabled={isPending}
                          onRoleChange={(memberId, role) =>
                            run(() => changeMemberRole(memberId, role))
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="tabular-nums text-foreground">
                        {formatMoney(member.billingRate, member.currency)}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {member.currency}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="tabular-nums text-foreground">
                        {formatMoney(member.costRate, member.currency)}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        / hr
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {member.currency}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(member.createdAt)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {isEditing ? (
                          <span className="text-xs text-muted-foreground">
                            Editing rates
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Edit rates for ${member.name ?? member.email ?? "member"}`}
                              onClick={() => setEditingMemberId(member.id)}
                            >
                              <Pencil />
                            </Button>
                            {!isSelf && (
                              <>
                                {members.filter(
                                  (other) => other.id !== member.id,
                                ).length > 0 && (
                                  <MergeMemberDialog
                                    keeper={member}
                                    candidates={members.filter(
                                      (other) => other.id !== member.id,
                                    )}
                                    disabled={isPending}
                                  />
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={isLastOwner}
                                        title={
                                          isLastOwner
                                            ? "You can't remove the last owner."
                                            : undefined
                                        }
                                        aria-label={`Remove ${member.name ?? member.email ?? "member"}`}
                                      >
                                        <UserMinus />
                                      </Button>
                                    }
                                  />
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogMedia>
                                        <UserMinus />
                                      </AlertDialogMedia>
                                      <AlertDialogTitle>Remove member?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {member.name ?? member.email ?? "This member"} will
                                        immediately lose access to the workspace. This
                                        can&apos;t be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogCancel
                                        variant="destructive"
                                        onClick={() =>
                                          run(() => removeMember(member.id))
                                        }
                                      >
                                        Remove
                                      </AlertDialogCancel>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {editingMemberId &&
                members
                  .filter((member) => member.id === editingMemberId)
                  .map((member) => (
                    <TableRow
                      key={`${member.id}-editor`}
                      className="bg-muted/30 hover:bg-muted/30"
                    >
                      <TableCell
                        colSpan={canManage ? 6 : 5}
                        className="whitespace-normal"
                      >
                        <MemberRatesEditor
                          memberId={member.id}
                          row={{
                            billingRate: member.billingRate,
                            costRate: member.costRate,
                            currency: member.currency as CurrencyCode,
                          }}
                          onCancel={() => setEditingMemberId(null)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
