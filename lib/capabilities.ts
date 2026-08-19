import type { Role } from "@/lib/generated/prisma/enums";

export type Capability =
  | "viewDashboard"
  | "viewClients"
  | "manageClients"
  | "addTimeEntries"
  | "viewReports"
  | "manageReports"
  | "manageRetainers"
  | "viewTeam"
  | "manageTeam"
  | "manageSettings";

export const ALL_CAPABILITIES: readonly Capability[] = [
  "viewDashboard",
  "viewClients",
  "manageClients",
  "addTimeEntries",
  "viewReports",
  "manageReports",
  "manageRetainers",
  "viewTeam",
  "manageTeam",
  "manageSettings",
];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  OWNER: ALL_CAPABILITIES,
  MEMBER: [
    "viewDashboard",
    "viewClients",
    "addTimeEntries",
    "viewReports",
    "viewTeam",
  ],
};

export type CapabilityLabel = {
  name: string;
  description: string;
};

export const CAPABILITY_LABELS: Record<Capability, CapabilityLabel> = {
  viewDashboard: {
    name: "View Dashboard",
    description:
      "See the workspace dashboard, activity, alerts, and insights.",
  },
  viewClients: {
    name: "View Clients",
    description:
      "Browse clients and view their profiles, margins, and scope usage.",
  },
  manageClients: {
    name: "Manage Clients",
    description:
      "Create, edit, archive, and delete clients, and adjust margin thresholds.",
  },
  addTimeEntries: {
    name: "Add Time Entries",
    description:
      "Log time entries and import time from CSV.",
  },
  viewReports: {
    name: "View Reports",
    description:
      "View profitability reports and download generated report PDFs.",
  },
  manageReports: {
    name: "Manage Reports",
    description:
      "Generate and delete monthly report snapshots.",
  },
  manageRetainers: {
    name: "Manage Retainers",
    description:
      "Create, edit, and delete client retainers.",
  },
  viewTeam: {
    name: "View Team",
    description:
      "See the workspace team, member roles, and billing and cost rates.",
  },
  manageTeam: {
    name: "Manage Team",
    description:
      "Invite and remove members, change roles, and edit rates.",
  },
  manageSettings: {
    name: "Manage Settings",
    description:
      "Configure workspace settings, integrations, and access the Admin area.",
  },
};

export function roleHasCapability(
  role: Role,
  capability: Capability,
): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}
