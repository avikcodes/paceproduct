import { AdminNav } from "@/components/admin/admin-nav";
import { requireWorkspaceOwner } from "@/lib/permissions";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireWorkspaceOwner();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Admin
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Workspace administration for owners.
        </p>
      </section>

      <AdminNav />

      {children}
    </div>
  );
}
