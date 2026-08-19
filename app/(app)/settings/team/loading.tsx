import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function TeamLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading team">
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-36" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-3.5 w-72" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-40" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-3.5 w-56" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkeletonRows count={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-32" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-3.5 w-48" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkeletonRows count={3} />
        </CardContent>
      </Card>
    </div>
  );
}
