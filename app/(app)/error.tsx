"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="relative mb-6">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 scale-150 rounded-full bg-red-50 blur-2xl"
        />
        <div className="grid size-14 place-items-center rounded-2xl border border-border bg-background shadow-sm">
          <TriangleAlert className="size-6 text-destructive" />
        </div>
      </div>
      <Badge
        variant="outline"
        className="mb-4 rounded-full border-destructive/20 text-destructive"
      >
        500 · Something went wrong
      </Badge>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        We hit a snag
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Something unexpected happened while loading this page. Please try again.
      </p>
      {error.digest && (
        <p className="mt-4 text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <Button className="mt-8" onClick={() => unstable_retry()}>
        <RotateCcw />
        Try again
      </Button>
    </div>
  );
}
