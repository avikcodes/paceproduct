import "server-only";
import { cache } from "react";
import { redirect, forbidden } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  roleHasCapability,
  type Capability,
} from "@/lib/capabilities";
import type { Role } from "@/lib/generated/prisma/enums";
import { auth } from "@clerk/nextjs/server";

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

async function resolveUserId(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

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

export const getWorkspaceData = cache(async (userId?: string): Promise<WorkspaceData> => {
  const uid = await resolveUserId(userId);

  const memberships = await loadMemberships(uid);
  if (memberships.length === 0) redirect("/onboarding");

  const selected = await selectActiveMembership(uid, memberships);
  if (!selected) redirect("/onboarding");

  const current: WorkspaceContext = {
    userId: uid,
    workspaceId: selected.workspaceId,
    workspaceName: selected.workspaceName,
    role: selected.role,
  };

  return {
    userId: uid,
    current,
    workspaces: memberships.map((membership) => ({
      userId: uid,
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
  async (userId?: string): Promise<WorkspaceContext> => {
    const data = await getWorkspaceData(userId);
    return data.current;
  },
);

export const getWorkspaceList = cache(async (userId?: string): Promise<WorkspaceSummary[]> => {
  const data = await getWorkspaceData(userId);
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
  async (capability: Capability, userId?: string): Promise<WorkspaceContext> => {
    const workspace = await getCurrentWorkspace(userId);
    if (!roleHasCapability(workspace.role, capability)) forbidden();
    return workspace;
  },
);

export async function getWorkspaceIfHasCapability(
  capability: Capability,
  userId?: string,
): Promise<WorkspaceContext | null> {
  const uid = await resolveUserId(userId);
  const workspace = await getWorkspaceMember(uid);
  if (!workspace || !roleHasCapability(workspace.role, capability)) return null;
  return workspace;
}

export const requireWorkspaceOwner = cache(
  async (userId?: string): Promise<WorkspaceContext> => {
    return requireCapability("manageTeam", userId);
  },
);
