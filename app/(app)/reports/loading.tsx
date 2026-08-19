import { Skeleton } from "@/components/ui/skeleton";

function TableSkeleton() {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="hidden h-3.5 w-24 sm:block" />
            <Skeleton className="hidden h-3.5 w-24 md:block" />
            <Skeleton className="hidden h-3.5 w-24 md:block" />
            <Skeleton className="hidden h-3.5 w-16 lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-xl p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

export default function ReportsLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading reports"
    >
      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-36 sm:h-9 sm:w-40" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </section>

      <section className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </section>
      <TableSkeleton />

      <section className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </section>
      <CardSkeletons />
      <TableSkeleton />

      <section className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </section>
      <ChartSkeleton />
    </div>
  );
}
