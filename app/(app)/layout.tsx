import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { getWorkspaceData } from "@/lib/permissions";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { current: workspace, workspaces } = await getWorkspaceData();

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
          {children}
        </main>
      </div>
    </div>
  );
}
