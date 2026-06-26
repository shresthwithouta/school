import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the tasks board: overview banner with four stat tiles, the scope-tab
// row, the search/filter row, then the task list.
export default function TasksLoading() {
  return (
    <div className="space-y-4">
      {/* Overview banner */}
      <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg sm:h-20 sm:rounded-xl" />
          ))}
        </div>
      </div>

      {/* Scope tabs + create */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Skeleton className="h-9 flex-1" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Skeleton className="h-9 w-full sm:w-36" />
          <Skeleton className="h-9 w-full sm:w-40" />
          <Skeleton className="h-9 w-9 shrink-0" />
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden border-b bg-muted/30 px-4 py-2 md:block">
          <Skeleton className="h-3 w-24" />
        </div>
        <ul className="divide-y">
          {Array.from({ length: 7 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <Skeleton className="hidden h-4 w-16 md:block" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
              </div>
              <Skeleton className="hidden h-4 w-24 md:block" />
              <Skeleton className="h-4 w-8" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
