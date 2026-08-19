import { Compass, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="relative mb-6">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 scale-150 rounded-full bg-blue-50 blur-2xl"
        />
        <div className="grid size-14 place-items-center rounded-2xl border border-border bg-background shadow-sm">
          <Compass className="size-6 text-primary" />
        </div>
      </div>
      <Badge variant="outline" className="mb-4 rounded-full text-muted-foreground">
        404 · Page not found
      </Badge>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Nothing here
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <ButtonLink variant="outline" className="mt-8" href="/dashboard">
        <ArrowLeft />
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
