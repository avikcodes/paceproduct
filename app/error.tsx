"use client";

import { useEffect } from "react";
import { RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

export default function Error({
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
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-sm font-semibold tracking-wide text-destructive uppercase">
        500 · {error.message || "Internal Server Error"}
      </p>
      <h1 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        We hit a snag.
      </h1>
      <pre className="mt-4 max-h-[60dvh] w-full max-w-3xl overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-4 text-left text-xs text-foreground">
        {error.stack || String(error)}
      </pre>
      {error.digest && (
        <p className="mt-4 text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button className="h-10 px-6" onClick={() => unstable_retry()}>
          <RotateCcw />
          Try again
        </Button>
        <ButtonLink variant="outline" className="h-10 px-6" href="/">
          <Home />
          Back to home
        </ButtonLink>
      </div>
    </div>
  );
}
