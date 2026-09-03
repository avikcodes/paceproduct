"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId, ensurePaceUser } from "@/lib/auth";
import {
  getInvitationByToken,
  isInvitationExpired,
} from "@/lib/invitations";

export type AcceptInvitationResult =
  | { ok: true; workspaceId: string; workspaceName: string }
  | { ok: false; error: string };

export async function acceptInvitation(
  token: string,
): Promise<AcceptInvitationResult> {
  const userId = await getAuthenticatedUserId();
  await ensurePaceUser(userId);

  const lookup = await getInvitationByToken(token);
  if (!lookup.valid || !lookup.invitation) {
    return { ok: false, error: "This invitation is invalid or has expired." };
  }

  const { invitation } = lookup;

  if (isInvitationExpired(invitation)) {
    return { ok: false, error: "This invitation has expired." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: userId,
          acceptedAt: new Date(),
          acceptedEmail: invitation.email,
        },
      });

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
        update: { role: invitation.role },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      });

      const membershipCount = await tx.workspaceMember.count({
        where: { userId },
      });

      if (membershipCount === 1) {
        await tx.user.update({
          where: { id: userId },
          data: { activeWorkspaceId: invitation.workspaceId },
        });
      }
    });

    revalidatePath("/");
    return {
      ok: true,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspaceName,
    };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
