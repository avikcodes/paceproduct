"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId, ensurePaceUser } from "@/lib/auth";
import {
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
  const userId = await getAuthenticatedUserId();
  await ensurePaceUser(userId);

  const raw = formData.get("workspaceName");
  const parsed = parseWorkspaceName(raw);
  const result = validateWorkspaceName(parsed);

  if ("error" in result) {
    return { error: result.error };
  }

  const workspace = await createWorkspaceForUser(userId, result.name);
  if (!workspace.ok) {
    return { error: workspace.error };
  }

  revalidatePath("/");
  return { success: "Workspace created." };
}

export async function switchWorkspace(
  workspaceId: string,
): Promise<WorkspaceActionState> {
  const userId = await getAuthenticatedUserId();

  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return { error: "You are not a member of that workspace." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { activeWorkspaceId: workspaceId },
  });

  revalidatePath("/");
  return { success: "Workspace switched." };
}

export async function renameWorkspace(
  _prevState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const userId = await getAuthenticatedUserId();

  const raw = formData.get("workspaceName");
  const parsed = parseWorkspaceName(raw);
  const result = validateWorkspaceName(parsed);

  if ("error" in result) {
    return { error: result.error };
  }

  const membership = await getWorkspaceMembership(userId, "");
  if (!membership || membership.role !== "OWNER") {
    return { error: "Only the workspace owner can rename it." };
  }

  await prisma.workspace.update({
    where: { id: membership.workspaceId },
    data: { name: result.name },
  });

  revalidatePath("/");
  return { success: "Workspace renamed." };
}

export async function deleteWorkspace(
  workspaceId: string,
): Promise<WorkspaceActionState> {
  const userId = await getAuthenticatedUserId();

  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership || membership.role !== "OWNER") {
    return { error: "Only the workspace owner can delete it." };
  }

  await prisma.workspace.delete({ where: { id: workspaceId } });
  revalidatePath("/");
  return { success: "Workspace deleted." };
}

export async function leaveWorkspace(
  workspaceId: string,
): Promise<WorkspaceActionState> {
  const userId = await getAuthenticatedUserId();

  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return { error: "You are not a member of that workspace." };
  }
  if (membership.role === "OWNER") {
    return { error: "The owner cannot leave. Delete the workspace instead." };
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  revalidatePath("/");
  return { success: "You left the workspace." };
}
