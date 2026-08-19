import { UserCog } from "lucide-react";
import type { AdminMemberRow } from "@/lib/admin";
import { getInitials, formatDate } from "@/lib/format";
import type { Role } from "@/lib/generated/prisma/enums";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type AdminMemberDisplayRow = AdminMemberRow & {
  name: string | null;
  email: string | null;
  imageUrl: string | null;
};

function RoleBadge({ role }: { role: Role }) {
  const isOwner = role === "OWNER";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 rounded-full border-transparent",
        isOwner
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {isOwner ? "Owner" : "Member"}
    </Badge>
  );
}

export function AdminTeamTable({
  members,
}: {
  members: AdminMemberDisplayRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="size-4 text-muted-foreground" />
          Team
          <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {members.length}
          </span>
        </CardTitle>
        <CardDescription>
          Everyone with access to this workspace and their time activity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={UserCog}
            title="No members yet"
            description="Invite teammates to start collaborating."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Hours logged</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
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
                          <span className="font-medium text-foreground">
                            {member.name ?? "Unnamed member"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {member.email ?? member.userId}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground tabular-nums">
                        {member.totalHours.toFixed(1)}h
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.lastEntryAt
                        ? formatDate(member.lastEntryAt)
                        : "No time logged"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
