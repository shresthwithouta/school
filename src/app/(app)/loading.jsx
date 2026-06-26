import { Skeleton } from "@/components/ui/skeleton";

// Generic fallback for (app) routes that don't ship their own loading.js
// (detail pages, task form, etc.). Route-level files like tasks/loading.jsx
// override this with a layout that matches that page exactly. Kept neutral on
// purpose so it never looks like the "wrong" page while data streams in.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-4 rounded-xl border p-6">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
