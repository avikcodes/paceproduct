import { Compass, Home } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 text-center">
      <div className="relative mb-6">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 scale-150 rounded-full bg-blue-50 blur-2xl"
        />
        <div className="grid size-14 place-items-center rounded-2xl border border-border bg-background shadow-sm">
          <Compass className="size-6 text-primary" />
        </div>
      </div>
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">
        404 · Page not found
      </p>
      <h1 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        This page took a wrong turn.
      </h1>
      <p className="mt-3 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get
        you back somewhere useful.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink className="h-10 px-6" href="/">
          <Home />
          Back to home
        </ButtonLink>
        <ButtonLink variant="outline" className="h-10 px-6" href="/dashboard">
          Go to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
