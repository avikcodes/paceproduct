"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWorkspaceIfHasCapability } from "@/lib/permissions";
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
  const workspace = await getWorkspaceIfHasCapability("manageTeam");
  if (!workspace) {
    return { error: "Only workspace owners can invite members." };
  }
  const workspaceId = workspace.workspaceId;

  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email) {
    return { error: "Please enter an email address." };
  }

  const client = await clerkClient();

  const [candidates, currentUser] = await Promise.all([
    client.users.getUserList({ emailAddress: [email] }),
    client.users.getUser(workspace.userId),
  ]);

  const currentUserEmail = currentUser.primaryEmailAddress?.emailAddress?.toLowerCase();

  if (email === currentUserEmail) {
    return { error: "You are already a member of this workspace." };
  }

  const candidateIds = candidates.data.map((user) => user.id);

  if (candidateIds.length > 0) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: { in: candidateIds } },
      select: { id: true },
    });

    if (member) {
      return { error: "This person is already a member of the workspace." };
    }
  }

  const workspaceName = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  const result = await createInvitation({
    workspaceId,
    email,
    role: "MEMBER",
    invitedByUserId: workspace.userId,
    inviterName:
      [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") ||
      null,
    workspaceName: workspaceName?.name ?? "the workspace",
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/settings/team");

  const state: TeamActionState = {
    success: `Invitation sent to ${email}.`,
  };
  if (result.emailStatus === "failed") {
    state.emailWarning =
      result.emailError ??
      "The email couldn't be sent. Share the link below instead.";
    state.inviteLink = result.inviteLink;
  }
  return state;
}

export async function removeMember(memberId: string): Promise<TeamActionState> {
  const workspace = await getWorkspaceIfHasCapability("manageTeam");
  if (!workspace) {
    return { error: "Only workspace owners can remove members." };
  }
  const workspaceId = workspace.workspaceId;

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, workspaceId: true, role: true },
  });

  if (!target || target.workspaceId !== workspaceId) {
    return { error: "Member not found in this workspace." };
  }

  if (target.userId === workspace.userId) {
    return { error: "You cannot remove yourself." };
  }

  if (target.role === "OWNER") {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return { error: "You can't remove the last owner." };
    }
  }

  await prisma.workspaceMember.delete({ where: { id: memberId } });

  revalidatePath("/settings/team");
  return { success: "Member removed." };
}

export async function changeMemberRole(
  memberId: string,
  role: Role,
): Promise<TeamActionState> {
  if (!ROLES.includes(role)) {
    return { error: "Invalid role." };
  }

  const workspace = await getWorkspaceIfHasCapability("manageTeam");
  if (!workspace) {
    return { error: "Only workspace owners can change roles." };
  }
  const workspaceId = workspace.workspaceId;

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, workspaceId: true, role: true },
  });

  if (!target || target.workspaceId !== workspaceId) {
    return { error: "Member not found in this workspace." };
  }

  if (target.userId === workspace.userId) {
    return { error: "You cannot change your own role." };
  }

  if (target.role === "OWNER" && role === "MEMBER") {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return { error: "You can't demote the last owner." };
    }
  }

  await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role },
  });

  revalidatePath("/settings/team");
  return { success: "Role updated." };
}

export async function cancelInvitation(
  invitationId: string,
): Promise<TeamActionState> {
  const workspace = await getWorkspaceIfHasCapability("manageTeam");
  if (!workspace) {
    return { error: "Only workspace owners can cancel invitations." };
  }
  const workspaceId = workspace.workspaceId;

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, workspaceId: true, status: true },
  });

  if (!invitation || invitation.workspaceId !== workspaceId) {
    return { error: "Invitation not found." };
  }

  if (invitation.status !== "PENDING") {
    return { error: "Only pending invitations can be cancelled." };
  }

  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: "CANCELLED", cancelledAt: new Date(), tokenHash: null },
  });

  revalidatePath("/settings/team");
  return { success: "Invitation cancelled." };
}

export async function updateMemberRates(
  memberId: string,
  values: MemberRatesFormValues,
): Promise<TeamActionState> {
  const workspace = await getWorkspaceIfHasCapability("manageTeam");
  if (!workspace) {
    return { error: "Only workspace owners can edit rates." };
  }
  const workspaceId = workspace.workspaceId;

  const parsed = parseRatesInput(values);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    select: { id: true, workspaceId: true },
  });

  if (!target || target.workspaceId !== workspaceId) {
    return { error: "Member not found in this workspace." };
  }

  try {
    await prisma.workspaceMember.update({
      where: { id: memberId },
      data: {
        billingRate: Number(parsed.data.billingRate),
        costRate: Number(parsed.data.costRate),
        currency: parsed.data.currency,
      },
    });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/settings/team");
  revalidatePath("/dashboard");
  return { success: "Rates updated." };
}

export async function mergeMembers(
  duplicateMemberId: string,
  keepMemberId: string,
): Promise<TeamActionState> {
  const workspace = await getWorkspaceIfHasCapability("manageTeam");
  if (!workspace) {
    return { error: "Only workspace owners can merge members." };
  }
  const workspaceId = workspace.workspaceId;

  if (
    !duplicateMemberId ||
    !keepMemberId ||
    duplicateMemberId === keepMemberId
  ) {
    return { error: "Choose two different members to merge." };
  }

  const members = await prisma.workspaceMember.findMany({
    where: { id: { in: [duplicateMemberId, keepMemberId] } },
    select: { id: true, userId: true, workspaceId: true, role: true },
  });

  if (members.length !== 2) {
    return { error: "Both members must exist in this workspace." };
  }

  const duplicate = members.find((member) => member.id === duplicateMemberId);
  const keep = members.find((member) => member.id === keepMemberId);

  if (
    !duplicate ||
    !keep ||
    duplicate.workspaceId !== workspaceId ||
    keep.workspaceId !== workspaceId
  ) {
    return { error: "Both members must belong to this workspace." };
  }

  if (duplicate.userId === workspace.userId) {
    return { error: "You can't merge away your own account." };
  }

  if (duplicate.role === "OWNER") {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return { error: "You can't merge away the last owner." };
    }
  }

  try {
    await prisma.$transaction([
      prisma.timeEntry.updateMany({
        where: { memberId: duplicate.id },
        data: { memberId: keep.id },
      }),
      prisma.workspaceMember.delete({ where: { id: duplicate.id } }),
    ]);
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/settings/team");
  revalidatePath("/dashboard");
  return {
    success:
      "Members merged. Time entries were reassigned to the kept member.",
  };
}
