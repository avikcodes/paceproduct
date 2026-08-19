import "server-only";
import { prisma } from "@/lib/prisma";
import { countOwnedWorkspaces } from "@/lib/permissions";
import { MAX_OWNED_WORKSPACES } from "@/lib/workspaces-shared";

export type CreateWorkspaceResult =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string };

export function parseWorkspaceName(
  raw: FormDataEntryValue | null,
): string {
  return typeof raw === "string" ? raw.trim() : "";
}

export function validateWorkspaceName(
  name: string,
): { error: string } | { name: string } {
  if (!name) return { error: "Please enter a workspace name." };
  if (name.length > 100) {
    return { error: "Workspace name must be 100 characters or fewer." };
  }
  return { name };
}

export async function createWorkspaceForUser(
  userId: string,
  name: string,
): Promise<CreateWorkspaceResult> {
  const owned = await countOwnedWorkspaces(userId);
  if (owned >= MAX_OWNED_WORKSPACES) {
    return {
      ok: false,
      error:
        `You've reached the maximum of ${MAX_OWNED_WORKSPACES} workspaces. ` +
        "Delete one before creating another.",
    };
  }

  try {
    const workspace = await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
      });

      const created = await tx.workspace.create({
        data: {
          name,
          members: {
            create: {
              userId,
              role: "OWNER",
            },
          },
        },
        select: { id: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: { activeWorkspaceId: created.id },
      });

      return created;
    });

    return { ok: true, workspaceId: workspace.id };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
