import { Skeleton } from "@/components/ui/skeleton";

export default function ClientMarginDetailsLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading margin details"
    >
      <Skeleton className="h-4 w-28" />

      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-52 sm:h-9 sm:w-64" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24 sm:h-7" />
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-7 w-12 rounded-lg" />
            <Skeleton className="h-7 w-12 rounded-lg" />
            <Skeleton className="h-7 w-12 rounded-lg" />
          </div>
        </div>
        <div className="flex h-72 flex-col justify-between rounded-lg border border-dashed border-border p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-px w-full"
              style={{ opacity: 1 - index * 0.15 }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-2.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="ml-auto h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="ml-auto h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
