import Link from "next/link";

import { Button } from "@/components/ui/button";

// Top-level 404 for routes outside the authenticated app shell.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </main>
  );
}
