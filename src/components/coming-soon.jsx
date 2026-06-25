import { Construction } from "lucide-react";

export function ComingSoon({ feature = "This feature" }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Construction className="size-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{feature} is coming soon</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        This area is part of the roadmap and isn&apos;t available yet.
      </p>
    </div>
  );
}
