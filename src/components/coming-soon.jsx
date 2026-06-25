import { Hammer } from "lucide-react";

export function ComingSoon({
  feature,
  note,
}


) {
  return (
    <div className="flex min-h-[48vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Hammer className="size-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{feature} is coming soon</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {note ??
          "This module is on the roadmap. We're building the foundation first — secure login, role hierarchy, dashboards and profiles."}
      </p>
    </div>
  );
}
