import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect, forbidden } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  roleHasCapability,
  type Capability,
} from "@/lib/capabilities";
import type { Role } from "@/lib/generated/prisma/enums";

export type { Capability };
export {
  roleHasCapability,
  ALL_CAPABILITIES,
  ROLE_CAPABILITIES,
  CAPABILITY_LABELS,
} from "@/lib/capabilities";

import type { WorkspaceContext, WorkspaceSummary } from "@/lib/workspaces-shared";

export { MAX_OWNED_WORKSPACES, type WorkspaceContext, type WorkspaceSummary } from "@/lib/workspaces-shared";

type MembershipRow = {
  workspaceId: string;
  workspaceName: string;
  role: Role;
  createdAt: Date;
  memberCount: number;
};

type WorkspaceData = {
  userId: string;
  current: WorkspaceContext;
  workspaces: WorkspaceSummary[];
};

async function loadMemberships(userId: string): Promise<MembershipRow[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      workspaceId: true,
      createdAt: true,
      workspace: {
        select: { name: true, _count: { select: { members: true } } },
      },
    },
  });

  return memberships.map((membership) => ({
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    role: membership.role,
    createdAt: membership.createdAt,
    memberCount: membership.workspace._count.members,
  }));
}

async function selectActiveMembership(
  userId: string,
  memberships: MembershipRow[],
): Promise<MembershipRow | null> {
  if (memberships.length === 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeWorkspaceId: true },
  });

  const selected =
    user?.activeWorkspaceId
      ? memberships.find(
          (membership) => membership.workspaceId === user.activeWorkspaceId,
        ) ?? memberships[0]
      : memberships[0];

  if (selected.workspaceId !== user?.activeWorkspaceId) {
    await prisma.user.upsert({
      where: { id: userId },
      update: { activeWorkspaceId: selected.workspaceId },
      create: { id: userId, activeWorkspaceId: selected.workspaceId },
    });
  }

  return selected;
}

export const getWorkspaceData = cache(async (): Promise<WorkspaceData> => {
  const { userId } = await auth.protect();
  const memberships = await loadMemberships(userId);
  if (memberships.length === 0) redirect("/onboarding");

  const selected = await selectActiveMembership(userId, memberships);
  if (!selected) redirect("/onboarding");

  const current: WorkspaceContext = {
    userId,
    workspaceId: selected.workspaceId,
    workspaceName: selected.workspaceName,
    role: selected.role,
  };

  return {
    userId,
    current,
    workspaces: memberships.map((membership) => ({
      userId,
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspaceName,
      role: membership.role,
      createdAt: membership.createdAt,
      memberCount: membership.memberCount,
      isCurrent: membership.workspaceId === selected.workspaceId,
    })),
  };
});

export const getCurrentWorkspace = cache(
  async (): Promise<WorkspaceContext> => {
    const data = await getWorkspaceData();
    return data.current;
  },
);

export const getWorkspaceList = cache(async (): Promise<WorkspaceSummary[]> => {
  const data = await getWorkspaceData();
  return data.workspaces;
});

export async function getWorkspaceMember(
  userId: string,
): Promise<WorkspaceContext | null> {
  const memberships = await loadMemberships(userId);
  const selected = await selectActiveMembership(userId, memberships);
  if (!selected) return null;

  return {
    userId,
    workspaceId: selected.workspaceId,
    workspaceName: selected.workspaceName,
    role: selected.role,
  };
}

export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceContext | null> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: {
      role: true,
      workspace: { select: { name: true } },
    },
  });

  if (!membership) return null;

  return {
    userId,
    workspaceId,
    workspaceName: membership.workspace.name,
    role: membership.role,
  };
}

export async function countOwnedWorkspaces(userId: string): Promise<number> {
  return prisma.workspaceMember.count({
    where: { userId, role: "OWNER" },
  });
}

export async function ensureUserRecord(userId: string): Promise<void> {
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
}

export const requireCapability = cache(
  async (capability: Capability): Promise<WorkspaceContext> => {
    const workspace = await getCurrentWorkspace();
    if (!roleHasCapability(workspace.role, capability)) forbidden();
    return workspace;
  },
);

export async function getWorkspaceIfHasCapability(
  capability: Capability,
): Promise<WorkspaceContext | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const workspace = await getWorkspaceMember(userId);
  if (!workspace || !roleHasCapability(workspace.role, capability)) return null;
  return workspace;
}

export const requireWorkspaceOwner = cache(
  async (): Promise<WorkspaceContext> => {
    return requireCapability("manageTeam");
  },
);
