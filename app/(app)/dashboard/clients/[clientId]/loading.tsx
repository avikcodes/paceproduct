import { Skeleton } from "@/components/ui/skeleton";

export default function ClientDetailLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading client"
    >
      <Skeleton className="h-4 w-28" />

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-52 sm:h-9 sm:w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {[0, 1, 2, 3, 4, 5].map((card) => (
            <div
              key={card}
              className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, item) => (
                  <div key={item} className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Skeleton className="h-4 w-28" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              {Array.from({ length: 4 }).map((_, item) => (
                <div key={item} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 4 }).map((_, item) => (
              <Skeleton key={item} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
