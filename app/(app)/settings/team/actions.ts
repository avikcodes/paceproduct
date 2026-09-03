"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/auth";
import {
  requireWorkspaceOwner,
} from "@/lib/permissions";
import {
  memberRatesFormSchema,
  type MemberRatesFormValues,
} from "@/lib/member-rates";
import { createInvitation } from "@/lib/invitations";
import type { Role } from "@/lib/generated/prisma/enums";

export type TeamActionState = {
  error?: string;
  success?: string;
  inviteLink?: string;
  emailWarning?: string;
};

const ROLES: Role[] = ["OWNER", "MEMBER"];

function parseRatesInput(
  values: MemberRatesFormValues,
): { error: string } | { data: MemberRatesFormValues } {
  const parsed = memberRatesFormSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid rate values." };
  }
  return { data: parsed.data };
}

export async function inviteMember(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const workspace = await requireWorkspaceOwner();
  const email = formData.get("email") as string | null;
  if (!email || !email.trim()) {
    return { error: "Please enter an email address." };
  }

  const result = await createInvitation({
    workspaceId: workspace.workspaceId,
    email: email.trim().toLowerCase(),
    role: "MEMBER",
    invitedByUserId: workspace.userId,
    workspaceName: workspace.workspaceName,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/settings/team");
  return { inviteLink: result.inviteLink };
}

export async function removeMember(memberId: string): Promise<TeamActionState> {
  const userId = await getAuthenticatedUserId();
  const workspace = await requireWorkspaceOwner();

  if (memberId === userId) {
    return { error: "You cannot remove yourself." };
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId: workspace.workspaceId, userId: memberId } },
  });

  revalidatePath("/settings/team");
  return { success: "Member removed." };
}

export async function changeMemberRole(
  memberId: string,
  role: Role,
): Promise<TeamActionState> {
  const workspace = await requireWorkspaceOwner();

  if (memberId === workspace.userId) {
    return { error: "You cannot change your own role." };
  }

  if (!ROLES.includes(role)) {
    return { error: "Invalid role." };
  }

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: workspace.workspaceId, userId: memberId } },
    data: { role },
  });

  revalidatePath("/settings/team");
  return { success: "Role updated." };
}

export async function cancelInvitation(
  invitationId: string,
): Promise<TeamActionState> {
  const workspace = await requireWorkspaceOwner();

  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  revalidatePath("/settings/team");
  return { success: "Invitation cancelled." };
}

export async function updateMemberRates(
  memberId: string,
  values: MemberRatesFormValues,
): Promise<TeamActionState> {
  const workspace = await requireWorkspaceOwner();

  const parsed = parseRatesInput(values);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: workspace.workspaceId, userId: memberId } },
    data: {
      billingRate: parsed.data.billingRate,
      costRate: parsed.data.costRate,
      currency: parsed.data.currency,
    },
  });

  revalidatePath("/settings/team");
  return { success: "Rates updated." };
}

export async function mergeMembers(
  duplicateMemberId: string,
  keepMemberId: string,
): Promise<TeamActionState> {
  const workspace = await requireWorkspaceOwner();

  await prisma.timeEntry.updateMany({
    where: { memberId: duplicateMemberId },
    data: { memberId: keepMemberId },
  });

  await prisma.workspaceMember.delete({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.workspaceId,
        userId: duplicateMemberId,
      },
    },
  });

  revalidatePath("/settings/team");
  return { success: "Members merged." };
}
