import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { getAuthenticatedUserId, ensurePaceUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await getAuthenticatedUserId();
  await ensurePaceUser(userId);

  const data = await getWorkspaceData(userId);

  if (data.workspaces.length === 0) {
    redirect("/onboarding");
  }

  const workspace = data.current;
  const workspaces = data.workspaces;

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar role={workspace.role} workspaceName={workspace.workspaceName} />
      <div className="lg:pl-64">
        <Topbar
          workspaceName={workspace.workspaceName}
          role={workspace.role}
          workspaces={workspaces}
        />
        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <SubscriptionGuard>{children}</SubscriptionGuard>
        </main>
      </div>
    </div>
  );
}
