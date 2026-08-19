"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ensureUserRecord,
  getWorkspaceMembership,
} from "@/lib/permissions";
import {
  createWorkspaceForUser,
  parseWorkspaceName,
  validateWorkspaceName,
} from "@/lib/workspaces";

export type WorkspaceActionState = {
  error?: string;
  success?: string;
};

export async function createWorkspace(
  _prevState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "You must be signed in to create a workspace." };
  }

  const name = parseWorkspaceName(formData.get("workspaceName"));
  const validated = validateWorkspaceName(name);
  if ("error" in validated) {
    return { error: validated.error };
  }

  const result = await createWorkspaceForUser(userId, validated.name);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/", "layout");
  return { success: "Workspace created." };
}

export async function switchWorkspace(
  workspaceId: string,
): Promise<WorkspaceActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "You must be signed in." };
  }

  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return { error: "You don't have access to this workspace." };
  }

  await ensureUserRecord(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { activeWorkspaceId: workspaceId },
  });

  revalidatePath("/", "layout");
  return { success: "Workspace switched." };
}

export async function renameWorkspace(
  _prevState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "You must be signed in." };
  }

  const workspaceId =
    typeof formData.get("workspaceId") === "string"
      ? (formData.get("workspaceId") as string)
      : "";

  const membership = await requireOwnership(userId, workspaceId);
  if ("error" in membership) {
    return { error: membership.error };
  }

  const name = parseWorkspaceName(formData.get("workspaceName"));
  const validated = validateWorkspaceName(name);
  if ("error" in validated) {
    return { error: validated.error };
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name: validated.name },
  });

  revalidatePath("/", "layout");
  return { success: "Workspace renamed." };
}

export async function deleteWorkspace(
  workspaceId: string,
): Promise<WorkspaceActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "You must be signed in." };
  }

  const membership = await requireOwnership(userId, workspaceId);
  if ("error" in membership) {
    return { error: membership.error };
  }

  await prisma.workspace.delete({ where: { id: workspaceId } });

  revalidatePath("/", "layout");
  return { success: "Workspace deleted." };
}

export async function leaveWorkspace(
  workspaceId: string,
): Promise<WorkspaceActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "You must be signed in." };
  }

  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return { error: "Workspace not found." };
  }

  if (membership.role === "OWNER") {
    return {
      error: "Owners can't leave their workspace. Delete it instead.",
    };
  }

  await prisma.$transaction([
    prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    }),
    prisma.user.updateMany({
      where: { id: userId, activeWorkspaceId: workspaceId },
      data: { activeWorkspaceId: null },
    }),
  ]);

  revalidatePath("/", "layout");
  return { success: "You left the workspace." };
}

async function requireOwnership(
  userId: string,
  workspaceId: string,
): Promise<{ workspaceId: string } | { error: string }> {
  if (!workspaceId) {
    return { error: "Workspace not found." };
  }

  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return { error: "Workspace not found." };
  }

  if (membership.role !== "OWNER") {
    return { error: "Only the workspace owner can do that." };
  }

  return { workspaceId };
}
