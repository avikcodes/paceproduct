"use client";

import { UserRound, Users } from "lucide-react";
import type { TeamMemberNameMapping } from "@/lib/time-import";
import { memberLabel, type MemberOption } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
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

type TeamMemberMappingProps = {
  names: string[];
  members: MemberOption[];
  value: TeamMemberNameMapping;
  onChange: (next: TeamMemberNameMapping) => void;
};

export function TeamMemberMapping({
  names,
  members,
  value,
  onChange,
}: TeamMemberMappingProps) {
  const mappedCount = names.filter((name) => Boolean(value[name])).length;
  const allMapped = mappedCount === names.length;

  if (members.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground">
        <Users className="size-4 shrink-0" />
        No workspace members are available. Add a team member before importing.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Map team members</p>
        <div className="flex items-center gap-2">
          <Badge variant={allMapped ? "secondary" : "destructive"}>
            {mappedCount} of {names.length} mapped
          </Badge>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-1/2">CSV value</TableHead>
              <TableHead>Workspace member</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {names.map((name) => {
              const memberId = value[name];
              const mapped = members.some((member) => member.id === memberId);
              return (
                <TableRow
                  key={name}
                  className={cn(!mapped && "bg-destructive/[0.03]")}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserRound className="size-4 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2 max-w-[220px] text-sm text-foreground">
                        {name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={memberId}
                      onValueChange={(next) =>
                        onChange({ ...value, [name]: next ?? "" })
                      }
                      items={Object.fromEntries(
                        members.map((member) => [member.id, memberLabel(member)]),
                      )}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Workspace member for ${name}`}
                      >
                        <SelectValue placeholder="Select a member" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {memberLabel(member)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
