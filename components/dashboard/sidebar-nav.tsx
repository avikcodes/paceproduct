"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Timer,
  BarChart3,
  Settings,
  LineChart,
  FileText,
  Table2,
  Activity,
  ShieldCheck,
  KeyRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  roleHasCapability,
  type Capability,
} from "@/lib/capabilities";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  capability: Capability;
  soon?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, capability: "viewDashboard" },
  {
    href: "/dashboard/activity",
    label: "Activity & alerts",
    icon: Activity,
    capability: "viewDashboard",
  },
  { href: "/dashboard/clients", label: "Clients", icon: Users, capability: "viewClients" },
  {
    href: "/dashboard/clients/overview",
    label: "Client overview",
    icon: Table2,
    capability: "viewClients",
  },
  { href: "/dashboard/time", label: "Time", icon: Timer, capability: "addTimeEntries" },
  { href: "/dashboard/insights", label: "Insights", icon: LineChart, capability: "viewDashboard" },
  { href: "/reports", label: "Reports", icon: BarChart3, capability: "viewReports" },
  { href: "/dashboard/reports", label: "Generated reports", icon: FileText, capability: "viewReports" },
  { href: "/settings/team", label: "Team", icon: UsersRound, capability: "viewTeam" },
  { href: "/settings", label: "Settings", icon: Settings, capability: "manageSettings" },
];

export const adminNavItems: NavItem[] = [
  { href: "/dashboard/admin", label: "Overview", icon: ShieldCheck, capability: "manageTeam" },
  { href: "/dashboard/admin/roles", label: "Roles", icon: KeyRound, capability: "manageTeam" },
];

function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/clients") return pathname === "/dashboard/clients";
  if (href === "/settings") return pathname === "/settings";
  // Alerts lives inside Activity & alerts.
  if (href === "/dashboard/activity") {
    return (
      pathname.startsWith("/dashboard/activity") ||
      pathname.startsWith("/dashboard/alerts")
    );
  }
  return pathname.startsWith(href);
}

function NavList({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const isActive = isNavItemActive(item.href, pathname);
        const Icon = item.icon;

        const inner = (
          <span
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                isActive
                  ? "text-accent-foreground"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="flex-1 text-left">{item.label}</span>
            {item.soon && (
              <Badge
                variant="outline"
                className="h-4.5 rounded-full border-transparent bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
              >
                Soon
              </Badge>
            )}
          </span>
        );

        if (item.soon) {
          return (
            <span key={item.href} className="cursor-default select-none">
              {inner}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            {inner}
          </Link>
        );
      })}
    </>
  );
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-2.5 text-xs font-medium tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function SidebarNav({
  onNavigate,
  role,
}: {
  onNavigate?: () => void;
  role?: Role;
}) {
  const visibleItems = navItems.filter(
    (item) => role && roleHasCapability(role, item.capability),
  );
  const visibleAdminItems = adminNavItems.filter(
    (item) => role && roleHasCapability(role, item.capability),
  );

  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      <NavList items={visibleItems} onNavigate={onNavigate} />
      {visibleAdminItems.length > 0 && (
        <>
          <SidebarLabel>Admin</SidebarLabel>
          <NavList items={visibleAdminItems} onNavigate={onNavigate} />
        </>
      )}
    </nav>
  );
}
