import { Skeleton } from "@/components/ui/skeleton";

// Mirrors Team: four stat cards, a search/tab toolbar, then the member table.
export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <Skeleton className="h-3 w-28" />
          </div>
          <ul className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="size-8" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
