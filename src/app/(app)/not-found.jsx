import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

// Rendered inside the app shell (sidebar + header) for any unmatched route or a
// notFound() call, instead of dropping the user onto Next's bare error page.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <FileQuestion className="size-7 text-muted-foreground" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </Button>
    </div>
  );
}
