import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the member analytics page: back link, profile header card, a row of
// four stat tiles, then the assigned-tasks list.
export default function MemberAnalyticsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36" />

      {/* Profile card */}
      <div className="rounded-xl border p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>

      {/* Assigned tasks list */}
      <div className="space-y-3 rounded-xl border p-5">
        <Skeleton className="h-5 w-32" />
        <ul className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="hidden h-4 w-16 sm:block" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
              <Skeleton className="hidden h-4 w-20 sm:block" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
