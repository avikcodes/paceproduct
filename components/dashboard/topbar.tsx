"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { WorkspaceHeader } from "@/components/dashboard/workspace-header";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Role } from "@/lib/generated/prisma/enums";
import { roleHasCapability } from "@/lib/capabilities";
import type { WorkspaceSummary } from "@/lib/workspaces-shared";

export function Topbar({
  workspaceName,
  role,
  workspaces,
}: {
  workspaceName: string;
  role?: Role;
  workspaces: WorkspaceSummary[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const canManageSettings =
    role !== undefined && roleHasCapability(role, "manageSettings");

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6 lg:px-8">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon-sm" className="lg:hidden" />}
          aria-label="Open navigation"
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center border-b border-border px-5">
            <Logo />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-4 flex items-center px-2.5">
              <WorkspaceHeader workspaceName={workspaceName} />
            </div>
            <SidebarNav onNavigate={() => setIsOpen(false)} role={role} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 items-center gap-2.5">
        <WorkspaceSwitcher workspaces={workspaces} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <UserMenu canManageSettings={canManageSettings} />
      </div>
    </header>
  );
}
