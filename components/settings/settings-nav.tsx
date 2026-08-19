"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Settings, Users, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  roleHasCapability,
  type Capability,
} from "@/lib/capabilities";
import type { Role } from "@/lib/generated/prisma/enums";

const generalItems: {
  href: string;
  label: string;
  icon: typeof Settings;
  capability?: Capability;
}[] = [
  { href: "/settings", label: "General", icon: Settings, capability: "manageSettings" },
  {
    href: "/settings/workspaces",
    label: "Workspaces",
    icon: LayoutGrid,
  },
  { href: "/settings/team", label: "Team", icon: Users, capability: "viewTeam" },
  { href: "/settings/integrations", label: "Integrations", icon: Plug, capability: "manageSettings" },
];

export function SettingsNav({ role }: { role: Role }) {
  const pathname = usePathname();

  const items = generalItems.filter(
    (item) => item.capability === undefined || roleHasCapability(role, item.capability),
  );

  return (
    <nav
      aria-label="Settings navigation"
      className="flex items-center gap-1 overflow-x-auto border-b border-border"
    >
      {items.map((item) => {
        const isActive =
          item.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 rounded-t-lg border-b-2 px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
              isActive
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
