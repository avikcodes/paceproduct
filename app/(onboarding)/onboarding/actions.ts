"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedUserId, ensurePaceUser } from "@/lib/auth";
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

  redirect("/dashboard");
}
