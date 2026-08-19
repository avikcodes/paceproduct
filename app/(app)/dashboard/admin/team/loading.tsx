import { Skeleton } from "@/components/ui/skeleton";

export default function AdminTeamLoading() {
  return (
    <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10" aria-busy="true" aria-label="Loading team">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-3.5 w-full max-w-md" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
