import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { WorkspaceHeader } from "@/components/dashboard/workspace-header";
import type { Role } from "@/lib/generated/prisma/enums";

export function Sidebar({
  role,
  workspaceName,
}: {
  role?: Role;
  workspaceName: string;
}) {
  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-sidebar">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-5">
        <Link href="/dashboard" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-4 flex items-center px-2.5">
          <WorkspaceHeader workspaceName={workspaceName} />
        </div>
        <SidebarNav role={role} />
      </div>
      <div className="border-t border-border px-3 py-3">
        <p className="px-2.5 text-xs text-muted-foreground">
          Pace · profitability suite
        </p>
      </div>
    </div>
  );
}
