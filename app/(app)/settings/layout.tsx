import { SettingsNav } from "@/components/settings/settings-nav";
import { getCurrentWorkspace } from "@/lib/permissions";

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const workspace = await getCurrentWorkspace();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Manage your account, workspace, and preferences.
        </p>
      </section>

      <SettingsNav role={workspace.role} />

      {children}
    </div>
  );
}
