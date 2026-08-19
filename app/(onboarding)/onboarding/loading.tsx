import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <div className="w-full max-w-md" aria-busy="true" aria-label="Loading onboarding">
      <div className="flex flex-col gap-4 rounded-xl p-6 ring-1 ring-foreground/10 sm:p-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <div className="flex flex-col gap-2 pt-4">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <Skeleton className="h-10 rounded-lg" />
      </div>
      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-2.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
