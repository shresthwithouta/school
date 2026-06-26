"use client";

import { useLinkStatus } from "next/link";

// Renders a slim progress bar pinned to the top of the viewport while the
// nearest <Link> is navigating. Next.js only flags `pending` until prefetched
// routes are ready, so on slow/dynamic transitions this gives the instant
// "something is happening" feedback that plain link clicks lack.
//
// Must be rendered as a descendant of a <Link> — that's how `useLinkStatus`
// scopes itself. Drop one inside each primary navigation link.
export function NavProgress() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <span className="nav-progress-bar block h-full rounded-r-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
    </span>
  );
}
