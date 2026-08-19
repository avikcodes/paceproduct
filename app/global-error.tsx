"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function GlobalError({
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-sm font-semibold tracking-wide text-destructive uppercase">
            500 · {error.message || "Internal Server Error"}
          </p>
          <h1 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
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
          <button
            onClick={() => unstable_retry()}
            className="mt-8 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <RotateCcw />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
