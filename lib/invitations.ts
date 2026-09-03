import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { InvitationStatus, Role } from "@/lib/generated/prisma/enums";

export const INVITATION_TTL_DAYS = 7;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InvitationEmailStatus = "sent" | "failed";

export type CreateInvitationResult =
  | {
      ok: true;
      invitationId: string;
      inviteLink: string;
      emailStatus: InvitationEmailStatus;
      emailError?: string;
    }
  | { ok: false; error: string };

export function generateInvitationToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationLink(token: string): string {
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${origin}/invite/${token}`;
}

export function invitationExpiryDate(): Date {
  return new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000);
}

export function isInvitationExpired(invitation: {
  expiresAt: Date | null;
}): boolean {
  if (!invitation.expiresAt) return false;
  return invitation.expiresAt.getTime() < Date.now();
}

export async function sendInvitationEmail(_input: {
  to: string;
  workspaceName: string;
  inviteLink: string;
  inviterName?: string | null;
  expiresAt: Date;
}): Promise<void> {
  // TODO: Re-implement email sending without Clerk (e.g., using Resend, SendGrid, etc.)
  console.warn("Email sending not implemented — Clerk email API removed.");
}

export async function createInvitation(input: {
  workspaceId: string;
  email: string;
  role: Role;
  invitedByUserId: string;
  inviterName?: string | null;
  workspaceName: string;
}): Promise<CreateInvitationResult> {
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const existing = await prisma.workspaceInvitation.findUnique({
    where: { workspaceId_email: { workspaceId: input.workspaceId, email } },
    select: { status: true },
  });

  if (existing) {
    if (existing.status === "PENDING") {
      return { ok: false, error: "An invitation is already pending for this email." };
    }
    if (existing.status === "ACCEPTED") {
      return { ok: false, error: "This person has already joined the workspace." };
    }
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = invitationExpiryDate();

  const invitation = await prisma.workspaceInvitation.upsert({
    where: { workspaceId_email: { workspaceId: input.workspaceId, email } },
    update: {
      role: input.role,
      status: "PENDING",
      tokenHash,
      expiresAt,
      invitedByUserId: input.invitedByUserId,
      acceptedAt: null,
      acceptedEmail: null,
      acceptedByUserId: null,
      cancelledAt: null,
    },
    create: {
      workspaceId: input.workspaceId,
      email,
      role: input.role,
      tokenHash,
      expiresAt,
      invitedByUserId: input.invitedByUserId,
    },
  });

  const inviteLink = invitationLink(token);

  try {
    await sendInvitationEmail({
      to: email,
      workspaceName: input.workspaceName,
      inviteLink,
      inviterName: input.inviterName,
      expiresAt,
    });
    return {
      ok: true,
      invitationId: invitation.id,
      inviteLink,
      emailStatus: "sent",
    };
  } catch {
    return {
      ok: true,
      invitationId: invitation.id,
      inviteLink,
      emailStatus: "failed",
      emailError:
        "The invitation was created but the email couldn't be sent. Share the link below instead.",
    };
  }
}

export type InvitationLookup = {
  status: InvitationStatus;
  valid: boolean;
  reason: string | null;
  invitation: {
    id: string;
    email: string;
    role: Role;
    workspaceId: string;
    workspaceName: string;
    expiresAt: Date | null;
  } | null;
};

export async function getInvitationByToken(
  token: string,
): Promise<InvitationLookup> {
  if (!token) {
    return { status: "PENDING", valid: false, reason: "invalid", invitation: null };
  }

  const tokenHash = hashInvitationToken(token);
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      workspaceId: true,
      workspace: { select: { name: true } },
    },
  });

  if (!invitation) {
    return { status: "PENDING", valid: false, reason: "invalid", invitation: null };
  }
  if (!invitation.email) {
    return { status: "PENDING", valid: false, reason: "invalid", invitation: null };
  }
  if (invitation.status === "ACCEPTED") {
    return {
      status: "ACCEPTED",
      valid: false,
      reason: "accepted",
      invitation: null,
    };
  }
  if (invitation.status === "CANCELLED") {
    return {
      status: "CANCELLED",
      valid: false,
      reason: "cancelled",
      invitation: null,
    };
  }
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
    return {
      status: "PENDING",
      valid: false,
      reason: "expired",
      invitation: null,
    };
  }

  return {
    status: "PENDING",
    valid: true,
    reason: null,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace.name,
      expiresAt: invitation.expiresAt,
    },
  };
}


