import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getClerkUserInfos } from "@/lib/clerk-users";
import { runCsvImport } from "@/lib/imports/import-runner";
import { TEAM_IMPORT_SPEC } from "@/lib/imports/team";
import { createInvitation } from "@/lib/invitations";
import type { Role } from "@/lib/generated/prisma/enums";
import type {
  ImportRefs,
  ImportRow,
} from "@/lib/imports/types";

const PATHS = [
  "/dashboard",
  "/settings/team",
  "/dashboard/admin/team",
];

async function loadRefs(workspaceId: string): Promise<ImportRefs> {
  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    }),
    prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: "PENDING" },
      select: { email: true },
    }),
  ]);

  const infos = await getClerkUserInfos(members.map((member) => member.userId));
  const existingEmails = new Set<string>();
  for (const info of infos.values()) {
    if (info.email) existingEmails.add(info.email.toLowerCase());
  }
  for (const invitation of invitations) {
    if (invitation.email) existingEmails.add(invitation.email.toLowerCase());
  }

  return { existingEmails: [...existingEmails] };
}

async function dedupe(
  workspaceId: string,
  rows: ImportRow[],
): Promise<Map<string, string>> {
  const seen = new Map<string, number>();
  const failures = new Map<string, string>();
  for (const row of rows) {
    if (!row.resolved) continue;
    const email = String(row.resolved.email).toLowerCase();
    const previous = seen.get(email);
    if (previous) {
      failures.set(row.fingerprint, `Duplicate of row ${previous}.`);
      continue;
    }
    seen.set(email, row.rowNumber);
  }
  return failures;
}

async function create(
  workspaceId: string,
  row: ImportRow,
  user: { userId: string },
): Promise<void> {
  const resolved = row.resolved;
  if (!resolved) return;
  const workspaceName = (
    await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    })
  )?.name;
  const result = await createInvitation({
    workspaceId,
    email: String(resolved.email),
    role: resolved.role as Role,
    invitedByUserId: user.userId,
    workspaceName: workspaceName ?? "the workspace",
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function revalidate(): Promise<void> {
  for (const path of PATHS) {
    revalidatePath(path);
  }
}

export async function POST(request: Request) {
  return runCsvImport(request, {
    capability: "manageTeam",
    spec: TEAM_IMPORT_SPEC,
    loadRefs,
    dedupe,
    create,
    revalidate,
  });
}
