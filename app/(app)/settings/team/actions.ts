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
import {
  generateInvitationToken,
  invitationLink,
  hashInvitationToken,
  invitationExpiryDate,
} from "@/lib/invitations";
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

  const member = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, workspaceId: true },
  });

  if (!member || member.workspaceId !== workspace.workspaceId) {
    return { error: "Member not found." };
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId: workspace.workspaceId, userId: member.userId } },
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

  const member = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, workspaceId: true },
  });

  if (!member || member.workspaceId !== workspace.workspaceId) {
    return { error: "Member not found." };
  }

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: workspace.workspaceId, userId: member.userId } },
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

  const member = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, workspaceId: true },
  });

  if (!member || member.workspaceId !== workspace.workspaceId) {
    return { error: "Member not found." };
  }

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: workspace.workspaceId, userId: member.userId } },
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

  const [duplicateMember, keepMember] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { id: duplicateMemberId },
      select: { id: true, userId: true, workspaceId: true },
    }),
    prisma.workspaceMember.findUnique({
      where: { id: keepMemberId },
      select: { id: true, userId: true, workspaceId: true },
    }),
  ]);

  if (
    !duplicateMember ||
    duplicateMember.workspaceId !== workspace.workspaceId
  ) {
    return { error: "Duplicate member not found." };
  }
  if (!keepMember || keepMember.workspaceId !== workspace.workspaceId) {
    return { error: "Keep member not found." };
  }

  await prisma.timeEntry.updateMany({
    where: { memberId: duplicateMember.id },
    data: { memberId: keepMember.id },
  });

  await prisma.workspaceMember.delete({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.workspaceId,
        userId: duplicateMember.userId,
      },
    },
  });

  revalidatePath("/settings/team");
  return { success: "Members merged." };
}

export type InviteLinkState = {
  error?: string;
  success?: string;
  inviteLink?: string;
};

export async function generateInviteLink(): Promise<InviteLinkState> {
  const workspace = await requireWorkspaceOwner();

  const existing = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId: workspace.workspaceId,
      email: null,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (existing) {
    return { error: "An invite link already exists. Revoke it first to generate a new one." };
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = invitationExpiryDate();

  await prisma.workspaceInvitation.create({
    data: {
      workspaceId: workspace.workspaceId,
      email: null,
      role: "MEMBER",
      tokenHash,
      expiresAt,
      invitedByUserId: workspace.userId,
    },
  });

  const inviteLinkUrl = invitationLink(token);
  revalidatePath("/settings/team");
  return { success: "Invite link generated.", inviteLink: inviteLinkUrl };
}

export async function revokeInviteLink(): Promise<InviteLinkState> {
  const workspace = await requireWorkspaceOwner();

  const existing = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId: workspace.workspaceId,
      email: null,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (!existing) {
    return { error: "No active invite link to revoke." };
  }

  await prisma.workspaceInvitation.update({
    where: { id: existing.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  revalidatePath("/settings/team");
  return { success: "Invite link revoked." };
}
