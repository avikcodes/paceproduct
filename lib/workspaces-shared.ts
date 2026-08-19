import type { Role } from "@/lib/generated/prisma/enums";

export const MAX_OWNED_WORKSPACES = 3;

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  role: Role;
};

export type WorkspaceSummary = WorkspaceContext & {
  createdAt: Date;
  memberCount: number;
  isCurrent: boolean;
};