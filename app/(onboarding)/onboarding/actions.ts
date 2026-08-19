"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createWorkspaceForUser,
  parseWorkspaceName,
  validateWorkspaceName,
} from "@/lib/workspaces";

export type OnboardingState = {
  error?: string;
};

export async function createWorkspace(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { userId } = await auth();

  if (!userId) {
    return { error: "You must be signed in to create a workspace." };
  }

  const existing = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (existing) {
    redirect("/dashboard");
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

  redirect("/dashboard");
}
