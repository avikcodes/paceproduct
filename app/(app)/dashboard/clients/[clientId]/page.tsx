import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability, roleHasCapability } from "@/lib/permissions";
import { clientSelect } from "@/lib/clients";
import {
  getClientMargin,
  getClientMarginThresholds,
} from "@/lib/margins";
import { retainerSelect, toRetainerRow } from "@/lib/retainers";
import { getBudgetForecast } from "@/lib/budget";
import { getScopeUsage } from "@/lib/scope";
import { ClientProfile } from "@/components/clients/client-profile";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { clientId } = await params;
  const workspace = await requireCapability("viewClients");

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.workspaceId },
    select: { name: true },
  });

  if (!client) {
    return { title: "Client not found" };
  }

  return {
    title: client.name,
    description: `Client profile for ${client.name}.`,
  };
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { clientId } = await params;
  const workspace = await requireCapability("viewClients");
  const canManageClients = roleHasCapability(workspace.role, "manageClients");
  const canManageRetainers = roleHasCapability(
    workspace.role,
    "manageRetainers",
  );

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.workspaceId },
    select: clientSelect,
  });

  if (!client) {
    notFound();
  }

  const retainers = await prisma.retainer.findMany({
    where: { clientId: client.id },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    select: retainerSelect,
  });

  const retainer = retainers.length > 0 ? toRetainerRow(retainers[0]) : null;

  const [margin, thresholds, forecast, scopeUsage] = await Promise.all([
    getClientMargin(client.id, workspace.workspaceId),
    getClientMarginThresholds(client.id, workspace.workspaceId),
    getBudgetForecast(client.id, workspace.workspaceId),
    getScopeUsage(client.id, workspace.workspaceId),
  ]);

  return (
    <ClientProfile
      client={client}
      retainer={retainer}
      margin={margin}
      thresholds={thresholds}
      forecast={forecast}
      scopeUsage={scopeUsage}
      canManageClients={canManageClients}
      canManageRetainers={canManageRetainers}
    />
  );
}
