import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading activity"
    >
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-52 sm:h-9 sm:w-64" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10"
          >
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-44" />
            {Array.from({ length: 5 }).map((_, item) => (
              <div key={item} className="flex items-center gap-3 py-2">
                <Skeleton className="size-2 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-full max-w-44" />
                  <Skeleton className="mt-1.5 h-3 w-full max-w-32" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
