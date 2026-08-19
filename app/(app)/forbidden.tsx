import type { Metadata } from "next";
import { ShieldX, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: "Access denied",
};

export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="relative mb-6">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 scale-150 rounded-full bg-red-50 blur-2xl"
        />
        <div className="grid size-14 place-items-center rounded-2xl border border-border bg-background shadow-sm">
          <ShieldX className="size-6 text-destructive" />
        </div>
      </div>
      <Badge
        variant="outline"
        className="mb-4 rounded-full border-destructive/20 text-destructive"
      >
        403 · Access denied
      </Badge>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        You don&apos;t have access to this page
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        This area is limited to workspace owners. If you believe this is a
        mistake, ask an owner to update your workspace permissions.
      </p>
      <ButtonLink variant="outline" className="mt-8" href="/dashboard">
        <ArrowLeft />
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
