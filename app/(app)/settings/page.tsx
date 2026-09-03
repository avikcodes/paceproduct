import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { Mail, Palette, Sun } from "lucide-react";
import { AccountForm } from "@/components/settings/account-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Pace account.",
};

export default async function SettingsPage() {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "user@example.com";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              This is how your name appears across Pace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccountForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              Email address
            </CardTitle>
            <CardDescription>
              Your sign-in email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <span className="text-sm font-medium text-foreground">{email}</span>
              <Badge
                variant="outline"
                className="rounded-full border-transparent bg-muted text-muted-foreground"
              >
                Primary
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" />
              Appearance
            </CardTitle>
            <CardDescription>
              Pace currently ships in light mode for a crisp, focused workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <Sun className="size-4 text-foreground" />
              <span className="text-sm font-medium text-foreground">Light</span>
              <Badge
                variant="outline"
                className="ml-auto rounded-full border-transparent bg-muted text-muted-foreground"
              >
                Default
              </Badge>
            </div>
            <Separator className="mt-6" />
            <p className="pt-4 text-xs leading-relaxed text-muted-foreground">
              Workspace and billing settings are coming soon. Until then, your Pace
              workspace is tied to your account.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
