import { Skeleton } from "@/components/ui/skeleton";

export default function TimeLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading time log"
    >
      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-40 sm:h-9 sm:w-44" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </section>

      <div className="rounded-xl ring-1 ring-foreground/10">
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg sm:w-[150px]" />
          <Skeleton className="h-8 w-full rounded-lg sm:w-[150px]" />
          <Skeleton className="h-8 w-full rounded-lg sm:w-[140px]" />
          <Skeleton className="h-8 w-full rounded-lg sm:w-28" />
        </div>

        <div className="flex flex-col gap-4 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="hidden h-3.5 w-24 sm:block" />
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="hidden flex-1 flex-col gap-1.5 sm:flex">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-md" />
              <Skeleton className="size-7 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
