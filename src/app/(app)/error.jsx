"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

// Error boundary for the (app) segment. Catches render/data errors so a thrown
// exception shows a recoverable screen inside the shell instead of crashing to
// Next's default error page. Must be a Client Component.
export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
      {/* Soft decorative glow behind the panel. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit an unexpected error loading this page. Trying again usually
          fixes it — if it keeps happening, head back to your dashboard.
        </p>

        {error?.digest && (
          <p className="mt-4 inline-block rounded-md border bg-muted/40 px-2.5 py-1 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => reset()}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
