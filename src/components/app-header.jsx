"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NAV_SECTIONS } from "@/lib/nav";
import { getInitials } from "@/lib/utils";

function titleFromPath(pathname) {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.title;
      }
    }
  }
  const seg = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function AppHeader({ user }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h1 className="text-base font-semibold tracking-tight">
        {titleFromPath(pathname)}
      </h1>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/settings"
          title="Profile & settings"
          className="rounded-full ring-offset-background transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar className="size-8">
            <AvatarImage src={user?.image || undefined} alt={user?.name || ""} />
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(user?.name || "?")}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
