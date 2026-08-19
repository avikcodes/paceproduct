import { Skeleton } from "@/components/ui/skeleton";

export default function AdminRolesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading roles">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-full max-w-sm" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </section>
      <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
