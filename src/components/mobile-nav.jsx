"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Order destinations by importance; the bar shows up to 5 the role can access.
const PRIORITY = [
  "/dashboard",
  "/tasks",
  "/meetings",
  "/approvals",
  "/users",
  "/reports",
  "/profile",
];

export function MobileNav({ role }) {
  const pathname = usePathname();
  const items = navForRole(role).flatMap((s) => s.items);
  const ordered = PRIORITY.map((href) => items.find((i) => i.href === href))
    .filter(Boolean)
    .slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur md:hidden">
      {ordered.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="size-5" />
            <span className="max-w-full truncate px-1">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
