import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type {
  ClientStatus,
  Role,
} from "@/lib/generated/prisma/enums";
import { clientSelect, type ClientRow } from "@/lib/clients";
import type { BillingCycle } from "@/lib/generated/prisma/enums";

export type AdminOverview = {
  totalClients: number;
  totalMembers: number;
  activeRetainers: number;
  activeAlerts: number;
  pendingInvitations: number;
  clientsByStatus: Record<ClientStatus, number>;
  membersByRole: Record<Role, number>;
  recentClients: Array<{
    id: string;
    name: string;
    status: ClientStatus;
    createdAt: Date;
  }>;
};

const EMPTY_STATUS_COUNTS: Record<ClientStatus, number> = {
  ACTIVE: 0,
  PAUSED: 0,
  ARCHIVED: 0,
};

const EMPTY_ROLE_COUNTS: Record<Role, number> = {
  OWNER: 0,
  MEMBER: 0,
};

export async function getAdminOverview(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<AdminOverview> {
  const [
    totalClients,
    totalMembers,
    activeRetainers,
    activeAlerts,
    pendingInvitations,
    clientGroups,
    memberGroups,
    recentClients,
  ] = await Promise.all([
    db.client.count({ where: { workspaceId } }),
    db.workspaceMember.count({ where: { workspaceId } }),
    db.retainer.count({
      where: { isActive: true, client: { workspaceId } },
    }),
    db.alert.count({ where: { workspaceId, isResolved: false } }),
    db.workspaceInvitation.count({
      where: { workspaceId, status: "PENDING" },
    }),
    db.client.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    db.workspaceMember.groupBy({
      by: ["role"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    db.client.findMany({
      where: { workspaceId },
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
    }),
  ]);

  const clientsByStatus: Record<ClientStatus, number> = {
    ...EMPTY_STATUS_COUNTS,
  };
  for (const group of clientGroups) {
    clientsByStatus[group.status] = group._count._all;
  }

  const membersByRole: Record<Role, number> = { ...EMPTY_ROLE_COUNTS };
  for (const group of memberGroups) {
    membersByRole[group.role] = group._count._all;
  }

  return {
    totalClients,
    totalMembers,
    activeRetainers,
    activeAlerts,
    pendingInvitations,
    clientsByStatus,
    membersByRole,
    recentClients,
  };
}

export type AdminClientRow = ClientRow & {
  monthlyBudget: number | null;
  currency: string | null;
  billingCycle: BillingCycle | null;
  scopeHours: number | null;
};

export async function getAdminClients(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<AdminClientRow[]> {
  const clients = await db.client.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      ...clientSelect,
      retainers: {
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          monthlyBudget: true,
          currency: true,
          billingCycle: true,
          scopeHours: true,
        },
      },
    },
  });

  return clients.map((client) => {
    const retainer = client.retainers[0] ?? null;

    return {
      id: client.id,
      workspaceId: client.workspaceId,
      name: client.name,
      company: client.company,
      website: client.website,
      contactName: client.contactName,
      contactEmail: client.contactEmail,
      phone: client.phone,
      status: client.status,
      notes: client.notes,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      monthlyBudget: retainer ? retainer.monthlyBudget.toNumber() : null,
      currency: retainer?.currency ?? null,
      billingCycle: retainer?.billingCycle ?? null,
      scopeHours: retainer?.scopeHours ?? null,
    };
  });
}

export type AdminMemberRow = {
  id: string;
  userId: string;
  role: Role;
  createdAt: Date;
  totalHours: number;
  lastEntryAt: Date | null;
};

export async function getAdminMembers(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<AdminMemberRow[]> {
  const [members, hours] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
      },
    }),
    db.timeEntry.groupBy({
      by: ["memberId"],
      where: { workspaceId },
      _sum: { hours: true },
      _max: { workDate: true },
    }),
  ]);

  const hoursByMember = new Map(
    hours.map((group) => [
      group.memberId,
      { totalHours: group._sum.hours?.toNumber() ?? 0, lastEntryAt: group._max.workDate ?? null },
    ]),
  );

  return members.map((member) => {
    const usage = hoursByMember.get(member.id) ?? {
      totalHours: 0,
      lastEntryAt: null,
    };
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      totalHours: usage.totalHours,
      lastEntryAt: usage.lastEntryAt,
    };
  });
}

export async function getMemberRoleCounts(
  workspaceId: string,
  db: PrismaClient = prisma,
): Promise<Record<Role, number>> {
  const groups = await db.workspaceMember.groupBy({
    by: ["role"],
    where: { workspaceId },
    _count: { _all: true },
  });

  const counts: Record<Role, number> = { ...EMPTY_ROLE_COUNTS };
  for (const group of groups) {
    counts[group.role] = group._count._all;
  }
  return counts;
}
