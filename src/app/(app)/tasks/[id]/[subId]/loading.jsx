import { Skeleton } from "@/components/ui/skeleton";

// Subtask detail: back link, header (key + badges + title), then a description
// panel beside a smaller details/status sidebar.
export default function SubtaskDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border p-5 lg:col-span-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-3 rounded-xl border p-5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}
