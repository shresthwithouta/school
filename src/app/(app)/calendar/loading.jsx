import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the calendar: month/nav toolbar above a 6×7 day grid.
export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>

        {/* Month grid */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-2 py-2">
                <Skeleton className="mx-auto h-3 w-8" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[6.5rem] border-b border-r p-1.5 last:border-r-0"
              >
                <div className="mb-1 flex justify-end">
                  <Skeleton className="size-6 rounded-full" />
                </div>
                {i % 3 === 0 && <Skeleton className="h-4 w-full rounded-md" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
