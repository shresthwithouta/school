import Link from "next/link";
import { Compass, LayoutDashboard, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";

// Rendered inside the app shell (sidebar + header) for any unmatched route or a
// notFound() call, instead of dropping the user onto Next's bare error page.
export default function NotFound() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-6xl font-bold tracking-tight text-primary/70">404</p>
        <div className="mx-auto mt-4 flex size-12 items-center justify-center rounded-xl border bg-card">
          <Compass className="size-6 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
          Here are a couple of places to pick things back up.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tasks">
              <ListChecks className="size-4" />
              Tasks
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
