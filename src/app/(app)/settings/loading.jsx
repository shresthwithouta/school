import { Skeleton } from "@/components/ui/skeleton";

// Mirrors Settings: the profile summary card, the Details/Security tabs, then
// the form card beneath them.
export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="rounded-xl border p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Skeleton className="size-20 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-48" />
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Skeleton className="h-9 w-52 rounded-lg" />

      {/* Form card */}
      <div className="space-y-5 rounded-xl border p-6">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
