"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
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
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "You must be signed in to accept this invitation." };
  }

  const lookup = await getInvitationByToken(token);
  if (!lookup.valid || !lookup.invitation) {
    return { ok: false, error: "This invitation is no longer valid." };
  }

  const invitation = lookup.invitation;
  if (isInvitationExpired(invitation)) {
    return { ok: false, error: "This invitation has expired. Ask the workspace owner to invite you again." };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const userEmail = user.primaryEmailAddress?.emailAddress?.toLowerCase();

  if (!userEmail || userEmail !== invitation.email) {
    return {
      ok: false,
      error: `This invitation is for ${invitation.email}. Sign in with that account to accept it.`,
    };
  }

  const existingMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    },
    select: { id: true },
  });

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    }),
    prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        tokenHash: null,
        acceptedAt: new Date(),
        acceptedEmail: userEmail,
        acceptedByUserId: userId,
      },
    }),
  ];

  if (!existingMembership) {
    operations.push(
      prisma.workspaceMember.createMany({
        data: [
          {
            workspaceId: invitation.workspaceId,
            userId,
            role: invitation.role,
          },
        ],
        skipDuplicates: true,
      }),
    );
  }

  await prisma.$transaction(operations);

  for (const path of ["/settings/team", "/dashboard/admin/team"]) {
    revalidatePath(path);
  }

  return {
    ok: true,
    workspaceId: invitation.workspaceId,
    workspaceName: invitation.workspaceName,
  };
}
