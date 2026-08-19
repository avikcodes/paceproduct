import { Skeleton } from "@/components/ui/skeleton";

export default function ClientOverviewLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading client overview"
    >
      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-64 sm:h-9 sm:w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </section>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton
              key={index}
              className={index === 0 ? "h-4 w-32" : "h-4 w-16"}
            />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="flex w-32 items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <Skeleton className="h-4 w-full" />
            </div>
            {Array.from({ length: 6 }).map((_, cell) => (
              <Skeleton key={cell} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
